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
                this.settings = $.extend({
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
                }, options);
                this.is_frame = true;
                this.shape_name = "nd_frame";
                // initialize or check data structures
                var fn = this.settings.feature_names;
                var fa = this.settings.feature_axes;
                var tr = this.settings.translation;
                var ma = this.settings.model_axes;
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
                        throw new Error("feature names or axes must be provided.")
                    }
                    fn = [];
                    for (var name in fa) {
                        fn.push(name);
                    }
                    fn.sort();
                }
                this.settings.feature_names = fn;
                this.settings.feature_axes = fa;
                this.settings.translation = tr;
                this.settings.model_axes = ma;
                
                this.reset();
            };
            prepare_for_redraw() {
                if (!this.changed) {
                    // leave frame alone.
                    return;
                }
                this.prepare_transform();
                var object_list = this.object_list;
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
                // reset the frame object list in place in sorted order.
                // XXXX any "other" objects in the frame will be lost.
                var frame_object_list =  [];
                var dedicated_frame = this.settings.dedicated_frame;
                for (var i=0; i<object_list.length; i++) {
                    var object_info = object_list[i];
                    var description2d = object_info.description2d();
                    description2d.object_index = frame_object_list.length;
                    description2d.object_nd = object_info;
                    frame_object_list.push(description2d);
                }
                dedicated_frame.object_list = frame_object_list;
                this.changed = false;   // everything is up to date.
            };
            request_redraw() {
                this.changed = true;
                this.settings.dedicated_frame.request_redraw();
            }
            redraw_frame() {
                // Do nothing.
                // the dedicated frame should also be on the object list and it redraws the objects.
            };
            coordinate_conversion(feature_vector) {
                if (!feature_vector) {
                    throw new Error("falsy vector entry not allowed");
                }
                // convert from array as needed.
                feature_vector = this.as_vector(feature_vector);
                var result = this.feature_to_model.affine(feature_vector);
                return result;
            }
            reset() {
                this.settings.dedicated_frame.reset_frame();
                this.object_list = [];
                this.changed = false;
                this.prepare_transform();
            };
            prepare_transform() {
                var fn = this.settings.feature_names;
                var fa = this.settings.feature_axes;
                var tr = this.settings.translation;
                var ma = this.settings.model_axes;
                var ma_matrix = $.fn.nd_frame.matrix(ma, projector_var_order, projector_var_order);
                var model_transform = ma_matrix.transpose().augment(tr);
                this.model_transform = model_transform;
                var fa_matrix = $.fn.nd_frame.matrix(fa, fn, projector_var_order);
                // xxxx No translation for features?
                var feature_transform = fa_matrix.transpose().augment();
                this.feature_to_model = model_transform.mmult(feature_transform)
                // model_vector = self.feature_to_model.affine(feature_vector);
            }
            install_model_transform(model_transform) {
                // Extract transform structure from transformed model.
                var translation = model_transform.translation();
                var axes = model_transform.axes();
                this.settings.translation = translation;
                this.settings.model_axes = axes;
                this.model_transform = model_transform;
                this.prepare_transform();   // probably redundant.
                this.request_redraw();
            }
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
                name_order = name_order || this.settings.feature_names;
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
            orbit(center3d, radius, shift2d) {
                var model_transform = this.model_transform;
                var rotation = model_transform.orbit_rotation_xyz(center3d, radius, shift2d);
                var new_transform = rotation.mmult(model_transform);
                this.install_model_transform(new_transform);
            };
            /* not needed?
            transform_model_axes(axes_transform) {
                var ma = this.settings.model_axes;
                var ma_matrix = $.fn.nd_frame.matrix(ma, projector_var_order, projector_var_order);
                var tf_matrix = $.fn.nd_frame.matrix(axes_transform, projector_var_order, projector_var_order);
                var combined = tf_matrix.mmult(ma_matrix);
                this.settings.model_axes = combined.matrix;
                this.request_redraw();
            }
            */
            // delegated methods
            name_image_url(...args) {
                this.settings.dedicated_frame.name_image_url(...args);
            };
            name_image_data(...args) {
                this.settings.dedicated_frame.name_image_data(...args);
            };
            set_visibilities(...args) {
                this.settings.dedicated_frame.set_visibilities(...args);
            };
        };

        class ND_Shape {
            constructor(nd_frame, opt) {
                opt = $.extend({}, opt);
                var opt2d = $.extend({}, opt);
                var shape_name = this.shape_name();
                var dedicated_frame = nd_frame.settings.dedicated_frame;
                var method = dedicated_frame[shape_name];
                this.nd_frame = nd_frame;
                nd_frame.changed = true;
                // project the object
                this.opt = opt;
                opt2d = this.project(nd_frame, opt2d, opt);
                // draw the projected object (the first time) on the canvas
                this.opt2d = method(opt2d);
                nd_frame.store_object(this);
            };
            description2d() {
                return this.opt2d;
            }
            project(nd_frame, opt2d, opt) {
                opt2d = opt2d || this.opt2d;
                opt = opt || this.opt;
                this.mutate_coordinates(opt2d, opt, nd_frame);
                return opt2d;
            };
            mutate_coordinates(opt2d, opt, nd_frame) {
                opt2d.position = nd_frame.coordinate_conversion(opt.position)
            };
            position2d() {
                return this.opt2d.position;
            };
        };

        class ND_Rect extends ND_Shape {
            shape_name() { return "rect"; }  // xxxx should be a class member?
        };

        class ND_Named_Image extends ND_Shape {
            shape_name() { return "named_image"; }  // xxxx should be a class member?
        };

        class ND_Frame_Rect extends ND_Shape {
            shape_name() { return "frame_rect"; }  // xxxx should be a class member?
        };

        class ND_Circle extends ND_Shape {
            shape_name() { return "circle"; }  // xxxx should be a class member?
        };

        class ND_Frame_Circle extends ND_Shape {
            shape_name() { return "frame_circle"; }  // xxxx should be a class member?
        };

        class ND_Text extends ND_Shape {
            shape_name() { return "text"; }  // xxxx should be a class member?
        };

        class ND_Line extends ND_Shape {
            shape_name() { return "line"; }  // xxxx should be a class member?
            mutate_coordinates(opt2d, opt, nd_frame) {
                opt2d.position1 = nd_frame.coordinate_conversion(opt.position1);
                opt2d.position2 = nd_frame.coordinate_conversion(opt.position2);
            };
            position2d() {
                return this.opt2d.position1;  // xxxx arbitrary choice; could use midpoint.
            };
        };

        class ND_Polygon extends ND_Shape {
            shape_name() { return "polygon"; }  // xxxx should be a class member?
            mutate_coordinates(opt2d, opt, nd_frame) {
                // xxx should convert cx, cy too...
                var positional_xy = function(point) {
                    var cvt = nd_frame.coordinate_conversion(point);
                    return [cvt.x, cvt.y];
                }
                opt2d.points = opt.points.map(positional_xy);
            };
            position2d() {
                return this.opt2d.points[0];  // xxxx arbitrary choice; could use centroid.
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
            }
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
                }
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
            }
        };

        return new Matrix(variable_to_vector, vi_order, vj_order, translator);
    };

    $.fn.nd_frame.example = function(element) {
    };

})(jQuery);
