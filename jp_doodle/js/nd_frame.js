/*

JQuery plugin helper n dimensional data projected onto 2d.

Assumes the element has been initialized using dual_canvas_helper.

The reference frame must be dedicated in the sense that the ND_frame
has the authority to reset the frame as needed.

Objects are ordered back to front using increasing "z" projection component if available
or decreasing "y" component if not.

If objects need to be reordered because a new object has been added
and object has been moved
or the projections have changed all objects
in the underlying frame are resorted.


Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/
"use strict";


(function($) {

    $.fn.nd_frame = function (options, element) {
        element = element || this;

        var numeric_default = function(value, default_value) {
            if ((typeof value) == "number") {
                return value;
            }
            default_value = default_value || 0;
            return default_value;
        }

        var projector_vars = {x: 1, y:2, z:3};
        var projector_var_order = ["x", "y", "z"];
        var default_3d_axes = [
            {x: 1, y:0, z:0},
            {x: 0, y:1, z:0},
            {x: 0, y:0, z:1},
        ];
        var default_4d_axes = [
            {x: 1, y:1, z:1},
            {x: -1, y:-1, z:1},
            {x: -1, y:1, z:-1},
            {x: 1, y:-1, z:-1},
        ];

        class ND_Frame {
            constructor(options, element) {
                var settings = $.extend({
                    // 2d frame to draw on.
                    dedicated_frame: null,
                    // name order for model variable conversion to/from arrays.
                    feature_names: null,
                    // mapping of variable name to x, y, z converter vectors
                    feature_axes: null,
                    // translation in model space
                    translation: null,
                    // rotates/skew etcetera from model space to 2d_projection
                    model_axes: null,
                    //is_frame: true,
                    events: true,   // by default support events
                    //shape_name: "nd_frame",
                    epsilon: 1e-5,
                }, options);
                this.is_frame = true;
                this.shape_name = "nd_frame";

                // copy settings as attributes of this.
                for (var setting in settings) {
                    this[setting] = settings[setting];
                }

                // initialize or check data structures
                if (!this.dedicated_frame.extrema) {
                    throw new Error("frame extrema are required.")
                }
                var fn = this.feature_names;
                var fa = this.feature_axes;
                var tr = this.translation;
                var ma = this.model_axes;
                // make default axes and translation as needed
                tr = tr || {};
                if (!ma) {
                    ma = {};
                    for (var v in projector_vars) {
                        var axis = {}
                        axis[v] = 1.0;
                        ma[v] = axis;
                    }
                }
                // check feature names versus feature axes
                if (fn) {
                    // yes feature names
                    if (!fa) {
                        //  no axes: invent feature axes
                        fa = {};
                        var nf = fn.length;
                        if (nf <= 3) {
                            // use canonical axes
                            for (var i=0; i<nf; i++) {
                                fa[fn[i]] = default_3d_axes[i];
                            }
                        } else if (nf == 4) {
                            // use tetrahedral axes
                            for (var i=0; i<nf; i++) {
                                fa[fn[i]] = default_4d_axes[i];
                            }
                        } else {
                            // arbitrary unit vectors if nf > 4
                            var sign = 1;
                            for (var i=0; i<nf; i++) {
                                sign = -sign;
                                var theta = i * (1.0/nf);
                                var omega = theta * 6;
                                var z = Math.sin(theta);
                                var c = Math.cos(theta);
                                var x = c * Math.sin(omega);
                                var y = c * Math.cos(omega);
                                fa[fn[i]] = {x: x, y:sign*y, z:z};
                            }
                        }
                    } // xxx should check axes match names?
                } else {
                    // no feature names: infer them from axes and sort.
                    if (!fa) {
                        // default trivial x, y, z feature axes
                        fa = {
                            x: {x:1},
                            y: {y:1},
                            z: {z:1}
                        }
                    }
                    fn = [];
                    for (var name in fa) {
                        fn.push(name);
                    }
                    fn.sort();
                }
                this.feature_names = fn;
                this.feature_axes = fa;
                this.translation = tr;
                this.model_axes = ma;
                
                this.reset();
            };
            to_json(async_callback) {
                // dump parameters as JSON compatible object
                var json_ob = {};
                json_ob.type = "ND_Frame";

                json_ob.feature_names = this.feature_names;
                json_ob.feature_axes = this.feature_axes;
                json_ob.translation = this.translation;
                json_ob.model_axes = this.model_axes;

                json_ob.extrema = this.dedicated_frame.extrema;

                if (async_callback) {
                    async_callback(json_ob);
                }

                return json_ob;
            };
            from_json(jsonob) {
                // load parameters as JSON compatible object
                if (jsonob.type !== "ND_Frame") {
                    throw new Error("type must be ND_Frame");
                }

                this.feature_names = jsonob.feature_names;
                this.feature_axes = jsonob.feature_axes;
                this.translation = jsonob.translation;
                this.model_axes = jsonob.model_axes;
                this.prepare_transform();

                dedicated_frame.set_extrema(jsonob.extrema);
            };
            on_change(options) {
                // fill in any missing numeric values in changed parameters.
                this.changed = true;
                var override = function(new_mapping, old_mapping) {
                    var result = {};
                    for (var v in old_mapping) {
                        result[v] = old_mapping[v];
                    }
                    for (var v in new_mapping) {
                        result[v] = new_mapping[v];
                    }
                    return result;
                };
                var override_axes = function(new_axes, old_axes) {
                    var result = {};
                    for (var v in old_axes) {
                        result[v] = old_axes[v];
                    }
                    for (var v in new_axes) {
                        var new_mapping = new_axes[v];
                        var old_mapping = old_axes[v] || {};
                        result[v] = override(new_mapping, old_mapping);
                    }
                    return result;
                }
                if (options.translation) {
                    options.translation = override(options.translation, this.translation);
                }
                if (options.feature_axes) {
                    options.feature_axes = override_axes(options.feature_axes, this.feature_axes);
                }
                if (options.model_axes) {
                    options.model_axes = override_axes(options.model_axes, this.model_axes);
                }
                return options;
            };
            prepare_for_redraw() {
                if (!this.changed) {
                    // leave frame alone.
                    return;
                }
                this.reset_stats();
                this.prepare_transform();
                var object_list = this.object_list.slice();
                // project the objects into canvas frame coordinates
                for (var i=0; i<object_list.length; i++) {
                    var nd_object_info = object_list[i];
                    nd_object_info.project(this);
                }
                // sort the object order by z or -y.
                var comparison = function(a, b) {
                    var a_position = a.position2d();
                    var b_position = b.position2d();
                    var a_value = numeric_default(a_position.z, -a_position.y);
                    var b_value = numeric_default(b_position.z, -b_position.y);
                    return (a_value - b_value);
                }
                object_list.sort(comparison);
                // the event rectangle should always be the first element drawn.
                object_list.unshift(this.event_rectangle);
                // reset the frame object list in place in sorted order.
                // XXXX any "other" objects in the frame will be lost.
                var frame_object_list =  [];
                var dedicated_frame = this.dedicated_frame;
                for (var i=0; i<object_list.length; i++) {
                    var object_info = object_list[i];
                    var description2d = object_info;
                    description2d.object_index = frame_object_list.length;
                    // description2d.object_nd = object_info;
                    frame_object_list.push(description2d);
                }
                dedicated_frame.object_list = frame_object_list;
                this.changed = false;   // everything is up to date.
            };
            request_redraw() {
                this.changed = true;
                this.dedicated_frame.request_redraw();
            };
            redraw_frame() {
                // Do nothing.
                // the dedicated frame should also be on the object list and it redraws the objects.
            };
            coordinate_conversion(fv, invisible) {
                if (!fv) {
                    throw new Error("falsy vector entry not allowed");
                }
                // convert from array as needed.
                var feature_vector = this.as_vector(fv);
                var matrix = this.feature_to_frame;
                var result = matrix.affine(feature_vector);
                if (!invisible) {
                    // record statistics.
                    this.min_feature = matrix.vmin(this.min_feature, feature_vector, this.feature_axes);
                    this.max_feature = matrix.vmax(this.max_feature, feature_vector, this.feature_axes);
                    this.min_vector = matrix.vmin(this.min_vector, result, this.model_axes);
                    this.max_vector = matrix.vmax(this.max_vector, result, this.model_axes);
                }
                return result;
            };
            depth_scale(minimum_value, maximum_value, vector, in_model) {
                // scale between minimum and maximum based on vector depth (transformed z)
                // used for object sizing by depth for psuedo depth perception.
                var max_z = this.max_vector.z || 0;
                var min_z = this.min_vector.z || 0;
                var converted;
                if (in_model) {
                    converted = this.frame_conversion(vector);
                } else {
                    converted = this.coordinate_conversion(vector, true);
                }
                var z = converted.z || 0;
                var extent = max_z - min_z;
                if (extent < 0.01) {
                    return minimum_value;
                }
                z = Math.max(z, min_z);
                z = Math.min(z, max_z);
                var lambda = (z - min_z) * 1.0 / extent;
                return lambda * maximum_value + (1.0 - lambda) * minimum_value;
            }
            frame_conversion(model_vector) {
                // convert from xyz model location to 2d frame location. (no statistics recorded)
                model_vector = this.as_vector(model_vector, projector_var_order);
                var matrix = this.model_transform;
                return matrix.affine(model_vector);
            }
            view_extrema() {
                // return extrema for the viewing frame
                return this.dedicated_frame.extrema;
            };
            fit(zoom) {
                // fit the dedicated frame to show all drawn points
                // preserve relative x/y scaling.
                zoom = zoom || 1.0;
                var matrix = this.feature_to_frame;
                var m = this.min_vector;
                var M = this.max_vector;
                var center = matrix.vscale(0.5, matrix.vadd(m, M));
                var shift = matrix.vscale(0.5 / zoom, matrix.vsub(M, m));
                if (shift.x > shift.y) {
                    shift.y = shift.x;
                } else {
                    shift.x = shift.y;
                }
                var lower = matrix.vsub(center, shift);
                var upper = matrix.vadd(center, shift);
                // no scaling change if too close
                var dedicated_frame = this.dedicated_frame;
                if ((upper.x - lower.x < this.epsilon) || (upper.y - lower.y < this.epsilon)) {
                    var old_extrema = dedicated_frame.extrema;
                    var diff = Math.max(old_extrema.frame_maxx - old_extrema.frame_minx, old_extrema.frame_maxy - old_extrema.frame_miny);
                    var dshift = diff * 0.5 / diff;
                    upper.x = center.x + dshift;
                    lower.x = center.x - dshift
                    upper.y = center.y + dshift;
                    lower.y = center.y - dshift;
                }
                var extrema = {
                    frame_minx: lower.x, frame_miny: lower.y,
                    frame_maxx: upper.x, frame_maxy: upper.y,
                };
                dedicated_frame.set_extrema(extrema);
                this.recalibrate_frame(false);
            };
            recalibrate_frame(except_orbit) {
                // adjust data structures after the 2d frame changes geometry parameters.
                var f = this.dedicated_frame;
                // recalculate geometry for event rectangle, preserving any event bindings.
                this.event_rectangle = f.event_region(this.event_rectangle);
                // fix the orbitter if present (?)
                var orbiter = this.orbiter;
                if ((!except_orbit) && (orbiter)) {
                    var radius = orbiter.radius;
                    this.orbit_off();
                    // xxxxx maybe this should call orbit_region sometimes?
                    this.orbit_all(radius);
                }
                f.request_redraw();
            }
            center() {
                // 3d center of visible locations.
                var matrix = this.feature_to_frame;
                var m = this.min_vector;
                var M = this.max_vector;
                return matrix.vscale(0.5, matrix.vadd(m, M));
            };
            diagonal_length() {
                // length from min visible location to max visible location in model space.
                var matrix = this.feature_to_frame;
                var m = this.min_vector;
                var M = this.max_vector;
                return matrix.vlength(matrix.vsub(m, M));
            }
            reset() {
                var f = this.dedicated_frame;
                f.reset_frame();
                this.event_rectangle = f.event_region();
                this.object_list = [];
                this.changed = false;
                // no orbiter after reset.
                this.orbit_off();
                this.reset_stats();
                this.prepare_transform();
            };
            reset_stats() {
                this.min_vector = null;
                this.max_vector = null;
                this.min_feature = null;
                this.max_feature = null;
            };
            prepare_transform() {
                var fn = this.feature_names;
                var fa = this.feature_axes;
                var tr = this.translation;
                var ma = this.model_axes;
                var ma_matrix = $.fn.nd_frame.matrix(ma, projector_var_order, projector_var_order);
                var model_transform = ma_matrix.transpose().augment(tr);
                this.model_transform = model_transform;
                var fa_matrix = $.fn.nd_frame.matrix(fa, fn, projector_var_order);
                // xxxx No translation for features?
                var feature_transform = fa_matrix.transpose().augment();
                this.feature_transform = feature_transform;
                this.feature_to_frame = model_transform.mmult(feature_transform)
                // model_vector = self.feature_to_frame.affine(feature_vector);
                // model inverse is computed as needed.
                this._model_inverse = null;
                // feature inverse is not well defined in general...
            };
            model_inverse_transform() {
                var result = this._model_inverse;
                if (!result) {
                    result = this.model_transform.invert();
                    this._model_inverse = result;
                }
                return result;
            };
            frame_position_to_model_location(frame_position) {
                // convert 2d frame coordinates to xyz model coordinates (source z assumed at 0)
                var M = this.model_inverse_transform();
                frame_position = $.extend({}, frame_position);
                frame_position.z = frame_position.z || 0;
                return M.affine(frame_position);
            };
            feature_vector_to_model_location(feature_vector) {
                // convert feature vector to xyz model position
                var M = this.feature_transform;
                return M.affine(feature_vector);
            }
            install_model_transform(model_transform) {
                // Extract transform structure from transformed model.
                var translation = model_transform.translation();
                var axes = model_transform.axes();
                this.translation = translation;
                this.model_axes = axes;
                this.model_transform = model_transform;
                this.prepare_transform();   // probably redundant.
                this.request_redraw();
            };
            store_object(object) {
                this.object_list.push(object);
            };
            rect(opt) {
                return new ND_Rect(this, opt);
            };
            frame_rect(opt) {
                return new ND_Frame_Rect(this, opt);
            };
            circle(opt) {
                return new ND_Circle(this, opt);
            };
            frame_circle(opt) {
                return new ND_Frame_Circle(this, opt);
            };
            line(opt) {
                return new ND_Line(this, opt);
            };
            text(opt) {
                return new ND_Text(this, opt);
            };
            polygon(opt) {
                return new ND_Polygon(this, opt);
            };
            named_image(opt) {
                return new ND_Named_Image(this, opt);
            };
            as_vector(descriptor, name_order) {
                // convert model array descriptor to mapping representation.
                name_order = name_order || this.feature_names;
                let n = name_order.length;
                var mapping = {};
                if (Array.isArray(descriptor)) {
                    if (descriptor.length != n) {
                        throw new Error("array descriptor length should match names length.")
                    }
                    for (var i=0; i<n; i++) {
                        mapping[name_order[i]] = descriptor[i]
                    }
                } else {
                    // copy for valid features (xxx don't check for extra slots?)
                    for (var i=0; i<n; i++) {
                        var vname = name_order[i];
                        var d = descriptor[vname];
                        if (d) {
                            mapping[vname] = d;
                        }
                    }
                }
                return mapping;
            };
            axis_scale(axis3d, shift2d) {
                // shift the axis vector by the 2d mouse move shift2d.
                var model_transform = this.model_transform;
                var origin_projection = this.frame_position_to_model_location({x:0, y:0});
                var offset_projection = this.frame_position_to_model_location(shift2d);
                var projected_shift = model_transform.vsub(offset_projection, origin_projection);
                var alength = model_transform.vlength(axis3d);
                if (alength < this.epsilon) {
                    // if axis is too short then set the axis using the shift direction.
                    return projected_shift;
                }
                // otherwise scale the axis using the projection of the shift direction.
                var axis_norm = model_transform.vunit(axis3d);
                var dot = model_transform.vdot(axis_norm, projected_shift);
                var scale_factor = 1.0 + (dot / alength);
                var scaled_axis = model_transform.vscale(scale_factor, axis3d);
                return scaled_axis;
            };
            feature_scale(feature_name, shift2d, fixed_feature_point) {
                // adjust the feature axis by the 2d mouse move shift.
                var feature_axes = this.feature_axes;
                var axis = feature_axes[feature_name];
                if (!axis) {
                    throw new Error("no such feature "+ feature_name);
                }
                var scaled_axis = this.axis_scale(axis, shift2d);
                return this.reset_axis(feature_name, scaled_axis, fixed_feature_point);
            };
            axis_rotate(axis3d, shift2d) {
                // rotate the axis vector by the 2d mous move shift2d.
                var model_transform = this.model_transform;
                var origin_projection = this.frame_position_to_model_location({x:0, y:0});
                var offset_projection = this.frame_position_to_model_location(shift2d);
                var projected_shift = model_transform.vsub(offset_projection, origin_projection);
                var alength = model_transform.vlength(axis3d);
                var offset = model_transform.vadd(axis3d, projected_shift);
                var direction = model_transform.vunit(offset);
                var rotated_axis = model_transform.vscale(alength, direction);
                return rotated_axis;
            }
            feature_rotate(feature_name, shift2d, fixed_feature_point) {
                // adjust the feature axis by the 2d mouse move shift.
                var feature_axes = this.feature_axes;
                var axis = feature_axes[feature_name];
                if (!axis) {
                    throw new Error("no such feature "+ feature_name);
                }
                var rotated_axis = this.axis_rotate(axis, shift2d);
                return this.reset_axis(feature_name, rotated_axis, fixed_feature_point);
            };
            reset_axis(feature_name, rotated_axis, fixed_feature_point) {
                var feature_axes = this.feature_axes;
                var point_before = null;
                if (fixed_feature_point) {
                    point_before = this.coordinate_conversion(fixed_feature_point);
                }
                feature_axes[feature_name] = rotated_axis;
                this.prepare_transform();
                if (fixed_feature_point) {
                    // adjust the translation so the fixed point stays in the same place.
                    var point_after = this.coordinate_conversion(fixed_feature_point);
                    var shift_translation = this.model_transform.vsub(point_before, point_after);
                    this.translation = this.model_transform.vadd(this.translation, shift_translation);
                    this.prepare_transform();
                }
                this.request_redraw();
            };
            orbit(center3d, radius, shift2d) {
                var model_transform = this.model_transform;
                var rotation = model_transform.orbit_rotation_xyz(center3d, radius, shift2d);
                var new_transform = rotation.mmult(model_transform);
                this.install_model_transform(new_transform);
                this.recalibrate_frame(true);
            };
            pan(shift2d) {
                var model_transform = this.model_transform;
                var rotation = model_transform.pan_transform_xyz(shift2d);
                var new_transform = rotation.mmult(model_transform);
                this.install_model_transform(new_transform);
                this.recalibrate_frame(true);
            };
            zoom(center3d, factor) {
                var model_transform = this.model_transform;
                var rotation = model_transform.zoom_transform_xyz(center3d, factor);
                var new_transform = rotation.mmult(model_transform);
                this.install_model_transform(new_transform);
                this.recalibrate_frame(false);
            };
            orbit_region(radius, center3d, min_x, min_y, width, height, after) {
                // create and overlay frame with orbit control over region in target frame.
                center3d = center3d || this.center();
                var e = this.dedicated_frame.extrema;
                min_x = min_x || e.frame_minx;
                min_y = min_y || e.frame_miny;
                width = width || e.frame_maxx - e.frame_minx;
                height = height || e.frame_maxy - e.frame_miny;
                var in_place = false;
                this.orbit_off();
                this.orbiter = new ND_Orbiter(
                    this, center3d, radius, min_x, min_y, width, height, in_place, after
                );
            };
            orbit_all(radius, center3d, after) {
                // orbit the whole frame in place.  
                // Other event frame bindings might interfere with orbit.
                this.orbit_off();
                var in_place = true;
                center3d = center3d || this.center();
                // min_x, min_y, width, height are not relevant
                this.orbiter = new ND_Orbiter(
                    this, center3d, radius, 0, 0, 0, 0, in_place, after
                );
            }
            orbit_off() {
                // turn off any active orbit controls.
                var orbiter = this.orbiter;
                if (orbiter) {
                    orbiter.off();
                }
                this.orbiter = null;
            }
            // delegated methods
            name_image_url(...args) {
                this.dedicated_frame.name_image_url(...args);
            };
            name_image_data(...args) {
                this.dedicated_frame.name_image_data(...args);
            };
            set_visibilities(...args) {
                this.dedicated_frame.set_visibilities(...args);
            };
            on(event_type, callback) {
                // use the event rectangle to capture events. (xxxx should attach to frame?)
                this.event_rectangle.on(event_type, callback);
            };
            off(event_type) {
                this.event_rectangle.off(event_type);
            };
            forget_objects(objects_or_infos) {
                this.dedicated_frame.forget_objects(objects_or_infos);
            };
        };

        class ND_Orbiter {
            constructor(nd_frame, center3d, radius, min_x, min_y, width, height, in_place, after) {
                this.after = after;  // call this after adjusting orbit
                var that = this;
                height = height || width;
                this.nd_frame = nd_frame;
                this.center3d = center3d;
                this.radius = radius;
                var event_target;
                if (in_place) {
                    this.is_overlay = false;
                    this.orbit_frame = nd_frame.dedicated_frame;
                    this.orbit_rect = nd_frame.event_rectangle;
                    event_target = this.orbit_frame;
                } else {
                    this.is_overlay = true;
                    this.orbit_frame = nd_frame.dedicated_frame.duplicate();
                    // invisible rectangle for capturing events.
                    this.orbit_rect = this.orbit_frame.frame_rect({
                        x:min_x, y:min_y, w:width, h:height, 
                        color:"rgba(0,0,0,0)", name:true});
                    event_target = this.orbit_rect;
                }
                var start_orbitting = function(event) {
                    if (event.model_location) {
                        that.last_location = event.model_location;
                    }
                };
                var stop_orbitting = function(event) {
                    that.last_location = null;
                };
                var orbit_if_dragging = function(event) {
                    if ((that.last_location) && (event.model_location)) {
                        var nd_frame = that.nd_frame;
                        var location = event.model_location;
                        var shift2d = nd_frame.model_transform.vsub(location, that.last_location);
                        if (event.shiftKey) {
                            nd_frame.pan(shift2d);
                        } else {
                            nd_frame.orbit(that.center3d, that.radius, shift2d);
                        }
                        if (that.after) {
                            that.after();
                        }
                        that.last_location = location;
                    }
                };
                event_target.on("mousedown", start_orbitting);
                event_target.on("mouseup", stop_orbitting);
                event_target.on("mousemove", orbit_if_dragging);
                event_target.on("click", stop_orbitting);
                this.last_location = null;
                this.event_target = event_target;
            };
            off() {
                if (this.orbit_frame) {
                    if (this.is_overlay) {
                        this.orbit_frame.forget();
                    } else {
                        this.event_target.off("mousedown");
                        this.event_target.off("mousemove");
                        this.event_target.off("mouseup");
                    }
                }
                this.orbit_frame = null;
                this.orbit_rect = null;
            };
        }

        class ND_Shape {
            constructor(nd_frame, opt) {
                // opt = $.extend({}, opt);
                // var opt2d = $.extend({}, opt);
                var shape_name = this._shape_name();
                this.shape_name = shape_name;
                var dedicated_frame = nd_frame.dedicated_frame;
                var method = dedicated_frame[shape_name];
                this.nd_frame = nd_frame;
                // store this object in place (do not copy)
                this.in_place = true;
                // by default convert from feature space not model space
                this.in_model = opt.in_model || false;
                nd_frame.changed = true;
                // store option attributes
                for (var desc in opt) {
                    this[desc] = opt[desc];
                }
                // project the object
                // this.opt = opt;
                this.project(nd_frame);
                // draw the projected object (the first time) on the canvas
                var descriptors = method(this);
                nd_frame.store_object(this);
                // store any modified descriptor elements
                for (var desc in descriptors) {
                    this[desc] = descriptors[desc];
                }
            };
            frame_conversion(location, nd_frame) {
                if (this.in_model) {
                    return nd_frame.frame_conversion(location);
                } else {
                    return nd_frame.coordinate_conversion(location);
                }
            }
            project(nd_frame) {
                //this.position = nd_frame.coordinate_conversion(this.location);
                this.position = this.frame_conversion(this.location, nd_frame);
            };
            position2d() {
                return this.position;
            };
            on_change(options) {
                this.nd_frame.changed = true;
                return options;
            };
            // delegated methods on and off are added automatically.
        };

        class ND_Rect extends ND_Shape {
            _shape_name() { return "rect"; }  // xxxx should be a class member?
        };

        class ND_Named_Image extends ND_Shape {
            _shape_name() { return "named_image"; }  // xxxx should be a class member?
        };

        class ND_Frame_Rect extends ND_Shape {
            _shape_name() { return "frame_rect"; }  // xxxx should be a class member?
        };

        class ND_Circle extends ND_Shape {
            _shape_name() { return "circle"; }  // xxxx should be a class member?
        };

        class ND_Frame_Circle extends ND_Shape {
            _shape_name() { return "frame_circle"; }  // xxxx should be a class member?
        };

        class ND_Text extends ND_Shape {
            _shape_name() { return "text"; }  // xxxx should be a class member?
        };

        class ND_Line extends ND_Shape {
            _shape_name() { return "line"; }  // xxxx should be a class member?
            project(nd_frame) {
                //this.position1 = nd_frame.coordinate_conversion(this.location1);
                //this.position2 = nd_frame.coordinate_conversion(this.location2);
                this.position1 = this.frame_conversion(this.location1, nd_frame);
                this.position2 = this.frame_conversion(this.location2, nd_frame);
            };
            position2d() {
                return this.position1;  // xxxx arbitrary choice; could use midpoint.
            };
        };

        class ND_Polygon extends ND_Shape {
            _shape_name() { return "polygon"; }  // xxxx should be a class member?
            project(nd_frame) {
                // xxx should convert cx, cy too...
                var that = this;
                var positional_xy = function(point) {
                    //var cvt = nd_frame.coordinate_conversion(point);
                    var cvt = that.frame_conversion(point, nd_frame);
                    return [cvt.x, cvt.y];
                }
                this.points = this.locations.map(positional_xy);
            };
            position2d() {
                return this.points[0];  // xxxx arbitrary choice; could use centroid.
            };
        };

        var result = new ND_Frame(options, element);
        // Add the frame object to the parent canvas in place
        element.store_object_info(result, null, true);
        return result;
    };

    $.fn.nd_frame.matrix = function(variable_to_vector, vi_order, vj_order, translator) {

        // xxxx eventually move this somewhere else...
        class Matrix {
            constructor(variable_to_vector, vi_order, vj_order, translator) {
                variable_to_vector = variable_to_vector || {};
                var get_sample = function (order) {
                    var result = {};
                    if (order) {
                        for (var i=0; i<order.length; i++) {
                            result[order[i]] = 1
                        }
                    }
                    return result;
                };
                var samplei = get_sample(vi_order);
                var samplej = get_sample(vj_order);
                var check_var = function (vname, sample, order) {
                    if (order) {
                        if (!(sample[vname])) {
                            throw new Error("var name not in order array " + vname + " " + order);
                        } 
                    } else {
                        sample[vname] = 1
                    }
                };
                var matrix = {};  // fresh copy
                for (var vi in variable_to_vector) {
                    check_var(vi, samplei, vi_order);
                    var vec = variable_to_vector[vi];
                    var row = {};
                    for (var vj in vec) {
                        check_var(vj, samplej, vj_order);
                        row[vj] = vec[vj];
                    }
                    matrix[vi] = row;
                }
                // define all vi vectors if needed
                for (var vi in samplei) {
                    matrix[vi] = matrix[vi] || {};
                }
                // define orders if needed
                var order_for = function(sample, order) {
                    if (order) {
                        return order.slice();  // fresh copy
                    }
                    var order = [];
                    for (var v in sample) {
                        order.push(v);
                    }
                    order.sort();
                    return order;
                }
                this.orderi = order_for(samplei, vi_order);
                this.orderj = order_for(samplej, vj_order);
                this.samplei = samplei;
                this.samplej = samplej;
                this.matrix = matrix;
                // set this for augmented affine matrix.
                this.translator = translator;
                // for "near 0" comparisons
                this.epsilon = 1e-10;
            };
            clone() {
                return new Matrix(this.matrix, this.orderi, this.orderj);
            };
            as_table(sep, indent) {
                // primarily for debug/test
                sep = sep || "\n";
                indent = indent || "    ";
                var result = [];
                var matrix = this.matrix;
                var orderi = this.orderi;
                var orderj = this.orderj;
                // heading
                result.push("<table border><tr><th>&nbsp;</th>")
                for (var j=0; j<orderj.length; j++) {
                    result.push(indent + "<th>" + orderj[j] + "</th>")
                }
                result.push("</tr>")
                // rows
                for (var i=0; i<orderi.length; i++) {
                    var vi = orderi[i];
                    result.push(indent + "<tr><th>" + vi + "</th>")
                    for (var j=0; j<orderj.length; j++) {
                        var vj = orderj[j];
                        result.push(indent + "<td>" + this.member(vi, vj) + "</td>")
                    }
                    result.push("</tr>")
                }
                result.push("</table>")
                return result.join(sep);
            };
            default_value(x) {
                if (x) {
                    return x;
                }
                return 0.0;
            };
            check_names(vi, vj) {
                if ((!(this.samplei[vi])) || (!(this.samplej[vj])) ) {
                    throw new Error("bad variable name(s) " + [vi, vj, this.orderi, this.orderj]);
                }
            };
            member(vi, vj, permissive) {
                if (!permissive) {
                    this.check_names(vi, vj);
                }
                var rowi = this.matrix[vi];
                if (rowi) {
                    return this.default_value(rowi[vj]);
                }
                return this.default_value();  // default
            };
            set_member(vi, vj, value, permissive) {
                if (!permissive) {
                    this.check_names(vi, vj);
                }
                var row = this.matrix[vi] || {};
                row[vj] = value;
                this.matrix[vi] = row;
            };
            vscale(scalar, vector) {
                var result = {};
                for (var v in vector) {
                    result[v] = scalar * vector[v];
                };
                return result;
            };
            vadd(v1, v2) {
                var result = {};
                var that = this;
                var addv1v2 = function(v1, v2) {
                    for (var v in v1) {
                        if (!result[v]) {
                            result[v] = v1[v] + that.default_value(v2[v]);
                        }
                    }
                }
                addv1v2(v1, v2);
                addv1v2(v2, v1);
                return result;
            };
            vmin(v1, v2, sample, fn) {
                if (!v1) {
                    return v2;
                }
                if (!v2) {
                    return v1;
                }
                fn = fn || Math.min;
                var result = {};
                for (var v in sample) {
                    result[v] = fn(this.default_value(v1[v]), this.default_value(v2[v]))
                }
                return result;
            };
            vmax(v1, v2, sample) {
                return this.vmin(v1, v2, sample, Math.max);
            }
            vsub(v1, v2) {
                return this.vadd(
                    v1,
                    this.vscale(-1, v2)
                );
            }
            vdot(v1, v2) {
                var result = 0;
                for (var v in v1) {
                    result += v1[v] * this.default_value(v2[v]);
                }
                return result;
            };
            vlength(v) {
                // euclidean length of vector v
                return Math.sqrt(this.vdot(v, v))
            };
            vunit(v) {
                // unit length vector in direction v
                var length = this.vlength(v);
                // xxxx check for length too small???
                return this.vscale(1.0/length, v);
            }
            dot(vector) {
                // matrix.dot(vector) like numpy (M.v)
                var result = {};
                var matrix = this.matrix;
                for (var vi in matrix) {
                    var row = matrix[vi];
                    result[vi] = this.vdot(row, vector);
                }
                return result;
            };
            eye(orderi, orderj, permissive) {
                // identity matrix of same shape as this.
                orderj = orderj || orderi || this.orderj;
                orderi = orderi || this.orderi;
                var leni = orderi.length;
                var lenj = orderj.length;
                if ((!permissive) && (leni != lenj)) {
                    throw new Error("cannot get identity unless dimensions are equal " + [leni, lenj]);
                }
                var result = new Matrix({}, orderi, orderj)
                var len = Math.min(leni, lenj);
                for (var i=0; i<len; i++) {
                    result.set_member(orderi[i], orderj[i], 1)
                }
                return result;
            };
            augment(translation_vector, translator) {
                // augmented affine matrix
                // https://en.wikipedia.org/wiki/Affine_transformation#Augmented_matrix
                translator = translator || "_t";
                translation_vector = translation_vector || {};
                var matrix = this.matrix;
                var orderi = this.orderi;
                var orderj = this.orderj;
                var aorderi = orderi.slice();
                var aorderj = orderj.slice();
                aorderi.push(translator);
                aorderj.push(translator);
                var augmented = new Matrix(matrix, aorderi, aorderj);
                for (var v in translation_vector) {
                    augmented.set_member(v, translator, translation_vector[v]);
                }
                augmented.translator = translator;
                augmented.set_member(translator, translator, 1);
                return augmented;
            };
            affine(vector) {
                // apply affine transform to vector
                var translator = this.translator;
                if (!translator) {
                    throw new Error("Cannot apply transform: this is not an augmented affine matrix.");
                }
                var avector = $.extend({}, vector);
                avector[translator] = 1;
                var bvector = this.dot(avector);
                var result = {};
                for (var v in this.samplei) {
                    if (v!=translator) {
                        result[v] = this.default_value(bvector[v]);
                    }
                }
                return result;
            };
            axes() {
                // get "source axes" for affine transform
                var translator = this.translator;
                if (!translator) {
                    throw new Error("Cannot get axes: this is not an augmented affine matrix.");
                }
                var matrix = this.matrix;
                var result = {};
                for (var vj in this.samplej) {
                    if (vj != translator) {
                        var vector = {};
                        for (var vi in this.samplei) {
                            if (vi != translator) {
                                var value = matrix[vi][vj];
                                if (value) {
                                    vector[vi] = value;
                                }
                            }
                        }
                        result[vj] = vector;
                    }
                }
                return result;
            };
            translation() {
                // get translation from affine transform
                var translator = this.translator;
                if (!translator) {
                    throw new Error("Cannot get axes: this is not an augmented affine matrix.");
                }
                var matrix = this.matrix;
                var vector = {};
                for (var vi in this.samplei) {
                    if (vi != translator) {
                        var value = matrix[vi][translator];
                        if (value) {
                            vector[vi] = value;
                        }
                    }
                }
                return vector
            }
            transpose(matrix, orderj, orderi) {
                orderj = orderj || this.orderj;
                orderi = orderi || this.orderi;
                var result = new Matrix({}, orderj, orderi);
                var matrix = this.matrix;
                for (var vari in matrix) {
                    var row = matrix[vari];
                    for (var varj in row) {
                        result.set_member(varj, vari, row[varj]);
                    }
                }
                return result;
            };
            swap(i, k) {
                // in place swap row i with k
                var orderi = this.orderi;
                var vari = orderi[i];
                var vark = orderi[k];
                var matrix = this.matrix;
                var rowi = matrix[vari];
                var rowk = matrix[vark];
                matrix[vari] = rowk;
                matrix[vark] = rowi;
            };
            invert(permissive) {
                var M = this.clone();
                var inverse = this.eye(permissive).transpose();
                var orderi = this.orderi;
                var orderj = this.orderj;
                var leni = orderi.length;
                var lenj = orderj.length;
                var len = Math.min(leni, lenj);
                //var inverse = this.eye(orderi, orderi, permissive);
                for (var i=0; i<len; i++) {
                    var vari = orderi[i];
                    var varj = orderj[i];
                    for (var k=i+1; k<len; k++) {
                        if (k != i) {
                            var vark = orderi[k];
                            var Mii = M.member(vari, varj);
                            var Mki = M.member(vark, varj)
                            if (Math.abs(Mii) < Math.abs(Mki)) {
                                M.swap(i, k);
                                inverse.swap(i, k);
                            }
                        }
                    }
                    var Mii = M.member(vari, varj);
                    M.normalize(vari, Mii);
                    inverse.normalize(varj, Mii)
                    for (var k=0; k<len; k++) {
                        var varik = orderi[k];
                        var varjk = orderj[k];
                        if (k != i) {
                            var Mki = M.member(varik, varj);
                            M.cancel(Mki, varik, vari);
                            inverse.cancel(Mki, varjk, varj);
                        }
                    }
                }
                // if the original matrix was augmented then so is the inverse.
                inverse.translator = this.translator;
                return inverse;
            };
            normalize(vari, factor) {
                // XXXX should error if factor near 0???
                var det = 1.0 / factor;
                var matrix = this.matrix;
                var rowi = matrix[vari];
                matrix[vari] = this.vscale(det, rowi);
            };
            cancel(factor, vark, vari) {
                // in place set M[k] -= f * M[i]
                var matrix = this.matrix;
                var rowk = matrix[vark];
                var rowi = matrix[vari];
                var shift = this.vscale(- factor, rowi);
                matrix[vark] = this.vadd(shift, rowk);
            };
            column(varj, permissive) {
                if ((!permissive) && (!this.samplej[varj])) {
                    throw new Error("no such column variable " + [varj, this.orderj]);
                }
                var result = {};
                var matrix = this.matrix;
                for (var vi in this.samplei) {
                    var value = this.member(vi, varj);
                    if (value) {
                        result[vi] = value;
                    }
                }
                return result;
            };
            mmult(other) {
                var result = new Matrix({}, this.orderi, other.orderj);
                for (var vari in this.samplei) {
                    for (var varj in other.samplej) {
                        var sum = 0;
                        for (var vark in this.samplej) {
                            sum += this.member(vari, vark) * other.member(vark, varj)
                        }
                        if (sum) {
                            result.set_member(vari, varj, sum);
                        }
                    }
                }
                result.translator = this.translator || other.translator;  // preserve affine translation slot.
                return result;
            };
            madd(other) {
                var result = new Matrix({}, this.orderi, this.orderj);
                for (var vari in this.samplei) {
                    for (var varj in this.samplej) {
                        var sum = this.member(vari, varj) + other.member(vari, varj);
                        if (sum) {
                            result.set_member(vari, varj, sum);
                        }
                    }
                }
                return result;
            };
            mscale(factor) {
                var result = new Matrix({}, this.orderi, this.orderj);
                for (var vari in this.samplei) {
                    for (var varj in this.samplej) {
                        var sum = factor * this.member(vari, varj);
                        if (sum) {
                            result.set_member(vari, varj, sum);
                        }
                    }
                }
                return result;
            };
            maxabs() {
                // primarily for testing...
                var result = 0
                for (var vari in this.samplei) {
                    for (var varj in this.samplej) {
                        result = Math.max(Math.abs(this.member(vari, varj)), result)
                    }
                }
                return result;
            };
            divergence(other) {
                // primariliy for testing whether two matrices are "close" in value.
                var diff = this.madd(other.mscale(-1));
                return diff.maxabs()
            };
            zoom_transform_xyz(center, factor) {
                // xxx could zoom the target frame instead...
                center = $.extend({}, center);
                var translator = "_t";
                var x = {x:1, y:0, z:0};
                var y = {x:0, y:1, z:0};
                var z = {x:0, y:0, z:1};
                var before = {
                    center: center,
                    x: this.vadd(x, center),
                    y: this.vadd(y, center),
                    z: this.vadd(z, center)
                };
                var after = {
                    center: center,
                    x: this.vadd(this.vscale(factor, x), center),
                    y: this.vadd(this.vscale(factor, y), center),
                    z: this.vadd(this.vscale(factor, z), center)
                };
                return this.affine_transformation(before, after, translator);
            };
            pan_transform_xyz(shift2d) {
                shift2d = $.extend({}, shift2d);
                var translator = "_t";
                var center = {x:0, y:0, z:0};
                var x = {x:1, y:0, z:0};
                var y = {x:0, y:1, z:0};
                var z = {x:0, y:0, z:1};
                var before = {
                    center: center,
                    x: x,
                    y: y,
                    z: z
                };
                var after = {
                    center: this.vadd(center, shift2d),
                    x: this.vadd(x, shift2d),
                    y: this.vadd(y, shift2d),
                    z: this.vadd(z, shift2d),
                };
                return this.affine_transformation(before, after, translator);
            };
            orbit_rotation_xyz(center3d, radius, shift2d) {
                // return an affine transform which rotates the xyz axis by shift2d at radius.
                // make fresh copies.
                center3d = $.extend({}, center3d);
                shift2d = $.extend({}, shift2d);
                var translator = "_t";
                var z_vector = {z: 1};
                if (Math.abs(this.vdot(z_vector, shift2d)) > this.epsilon) {
                    throw new Error("shift should be othogonal to z axis.");
                }
                // need to define these:
                var center_z, center_z_rotate, center_shift, center_shift_rotate, center_norm;
                center_z = this.vadd(center3d, z_vector);
                // if the shift is too small then do a trivialized "no rotation" test computation
                var shift_length = this.vlength(shift2d)
                if (Math.abs(shift_length) < this.epsilon) {
                    // this should result in an identity transform:
                    center_z_rotate = center_z;
                    center_shift = this.vadd(center3d, {x:1});
                    center_shift_rotate = center_shift;
                    center_norm = this.vadd(center3d, {y:1});
                } else {
                    var sine_theta = shift_length * (1.0 / Math.sqrt((radius * radius)+ (shift_length * shift_length)));
                    var cosine_theta = Math.sqrt(1.0 - sine_theta * sine_theta)
                    var shift_unit = this.vunit(shift2d);
                    var center_shift = this.vadd(center3d, shift_unit);
                    var shift_unit_rotate = this.vadd(
                        this.vscale(cosine_theta, shift_unit),
                        this.vscale(- sine_theta, z_vector)
                    );
                    var center_shift_rotate = this.vadd(center3d, shift_unit_rotate);
                    var z_rotate = this.vadd(
                        this.vscale(cosine_theta, z_vector),
                        this.vscale(sine_theta, shift_unit)
                    );
                    center_z_rotate = this.vadd(center3d, z_rotate);
                    var normal = {
                        x: this.default_value(shift_unit.y), 
                        y: - this.default_value(shift_unit.x), 
                        z: 0
                    };
                    var center_norm = this.vadd(center3d, normal);
                }
                // Get matrices from reference points
                var unrotated = {
                    point: center_z,
                    center_shift: center_shift,
                    center: center3d,
                    center_norm: center_norm
                };
                var rotated = {
                    point: center_z_rotate,
                    center_shift: center_shift_rotate,
                    center: center3d,
                    center_norm: center_norm
                };
                return this.affine_transformation(unrotated, rotated, translator);
            };
            affine_transformation(unrotated, rotated, translator) {
                var include_translator = function (vectors) {
                    for (var v in vectors) {
                        vectors[v][translator] = 1.0
                    }
                }
                include_translator(rotated);
                include_translator(unrotated);
                var Rmatrix = new Matrix(rotated);
                var Umatrix = new Matrix(unrotated);
                var RmatrixT = Rmatrix.transpose();
                var UmatrixT = Umatrix.transpose();
                var Uinverse = UmatrixT.invert();
                // result converts unrotated to rotated
                var Affine_result = RmatrixT.mmult(Uinverse);
                // make it an affine matrix
                Affine_result.translator = translator;
                return Affine_result;
            };
        };

        return new Matrix(variable_to_vector, vi_order, vj_order, translator);
    };

    $.fn.nd_frame.example = function(element) {
        
        var canvas_config = {
            width: 900,
            height: 700,
        };
        element.dual_canvas_helper(canvas_config);
        var frame = element.frame_region(
            0, 0, 900, 700,
            -2, -2, +2, +2);

        // Create a multidimensional frame, by default in 3d using variables x,y,z
        var nd_frame = element.nd_frame({
            dedicated_frame: frame,
        });

        // Enable orbitting.
        var center3d = {x:0.1, y:-0.1, z:-0.25};
        var radius = 3;
        //nd_frame.orbit_region(center3d, radius, -4, -4, 8)
        nd_frame.orbit_region(radius, center3d, -4, -4, 8, 8)

        // Give the frame a small initial rotation.
        var shift2d = {x:-0.3, y:-0.2};
        nd_frame.orbit(center3d, radius, shift2d);

        // Draw simple axes.
        nd_frame.line({location1: {x:1.5}, location2: {x:-1.5}, color:"red", lineWidth:3});
        nd_frame.line({location1: {y:1.5}, location2: {y:-1.5}, color:"blue", lineWidth:3});
        nd_frame.line({location1: {z:1.5}, location2: {z:-1.5}, color:"green", lineWidth:3});
        nd_frame.text({location: {x:1.9}, text: "X", font: "normal 30px Arial"});
        nd_frame.text({location: {y:1.9}, text: "Y", font: "normal 30px Arial"});
        nd_frame.text({location: {z:1.9}, text: "Z", font: "normal 30px Arial"});

        // make a spiral thingy using a function that maps indices to spiral coordinates.
        var count = 50
        var spiral_coordinates = function (index) {
            var height = (index - count) * 1.0 / count;
            var radius = Math.sqrt(1.0 - height*height);
            var radians = index / 10.0;
            return {z: Math.cos(radians) * radius, y: Math.sin(radians) * radius, x: height}
        }
        var transparent_pink = "rgba(255,200,200,0.7)"
        for (var index=0; index<2*count; index++) {
            var start = spiral_coordinates(index);
            var end = spiral_coordinates(index + 0.5);
            nd_frame.circle({location: start, r:3, color:"cyan"})
            nd_frame.polygon({
                    locations: [start, end, {z: start.z}],
                    color: transparent_pink
                });
        }

        // Also put an image in the frame:
        var mandrill_url = "static/mandrill.png"
        nd_frame.name_image_url("mandrill", mandrill_url);
        var mandrill = nd_frame.named_image({
            name: "whole mandrill",
            image_name: "mandrill", location: {z: -1.1}, w:100, h:100
        });

        var zoom_in = function() {
            nd_frame.zoom(center3d, 1.2);
        };
        var zin_button = $("<button>zoom_in</button>").appendTo(element);
        zin_button.click(zoom_in);
        var zoom_out = function() {
            nd_frame.zoom(center3d, 0.8);
        };
        var zout_button = $("<button>zoom_out</button>").appendTo(element);
        zout_button.click(zoom_out);

        $("<div>Please drag to rotate or shift-drag to translate the figure.</div>").appendTo(element);

    };

})(jQuery);
