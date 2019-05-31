/*

JQuery plugin helper for n dimensional scatter plot.

Assumes the element has been initialized using dual_canvas_helper.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/
"use strict";

(function($) {

    $.fn.nd_scatter = function (options, element) {
        element = element || this;

        class ND_Scatter {
            constructor(options, element) {
                this.settings = $.extend({
                    // default settings:
                    scatter_size: 700,
                    axis_size: 300,
                    header_size: "30px",
                    info_height: "200px",
                    gap: "10px",
                    zoom: 0.9,
                    point_radius: 7,
                    feature_scale: 0.8,
                    square_side: 16,
                }, options);
                this.element = element;
                element.empty();
                element.html("uninitialized nd_scatter plot widget.");
                // trivial matrix for access to matrix/vector operations
                this.matrix = $.fn.nd_frame.matrix({}, [], []);
            };
            define_json(json_data) {
                this.reset();
                var fjson = json_data.features;
                for (var i=0; i<fjson.length; i++) {
                    this.define_feature(fjson[i]);
                }
                this.current_feature_name = this.feature_names[0];
                var cjson = json_data.configurations;
                for (var i=0; i<cjson.length; i++) {
                    this.define_configuration(cjson[i]);
                }
                this.current_configuration_name = this.configuration_names[0];
                var pjson = json_data.points;
                for (var i=0; i<pjson.length; i++) {
                    var a = pjson[i];
                    this.point_arrays.push(a.slice());
                    this.point_vectors.push(this.feature_vector_from_array(a));
                }
                this.draw_configuration();
            };
            draw_configuration() {
                this.title_area.html(this.current_configuration_name);
                this.draw_scatter_canvas();
                this.draw_feature_canvas();
            };
            configuration() {
                return this.configurations[this.current_configuration_name];
            };
            draw_feature_canvas() {
                var s = this.settings;
                //var matrix = this.matrix;
                var current_feature_name = this.current_feature_name
                var configuration = this.configuration();
                var matrix = this.matrix;
                var that = this;
                var axis_canvas = this.axis_canvas;
                axis_canvas.clear_canvas();
                var w = s.axis_size;
                var axis_frame = axis_canvas.frame_region(
                    0, 0, w, w,
                    -1.2, -1.2, 1.2, 1.2  // dummy values reset later.
                );
                // draw event circle and rectangle
                var event_rect = axis_frame.frame_rect({x:-1.2, y:-1.2, w:2.4, h:2.4, color: "#ffd", name:true});
                var event_circle = axis_frame.frame_circle({x:0, y:0, r:1, color: "#eed", name:true});
                // draw projectors non-current features
                var origin = {x:0, y:0};
                for (var feature_name in this.features) {
                    if (feature_name != current_feature_name) {
                        var feature = this.features[feature_name];
                        var color = feature.color;
                        // fix positions later...
                        feature.line = axis_frame.line({
                            position1: origin, 
                            position2: origin, 
                            color:color,
                            name:true,
                            events:false,
                        });
                    }
                }
                // draw selected feature on top.
                var feature = this.features[current_feature_name];
                var color = feature.color;
                // fix positions later...
                feature.line = axis_frame.line({
                    position1: origin, 
                    position2: origin, 
                    color:color,
                    name:true,
                    events:false,
                    lineWidth: 3,
                });
                this.sync_feature_lines();
                // attach canvas events to adjust the active feature.
                var is_feature_event = function (event) {
                    return (event.reference_frame == axis_frame) && (current_feature_name);
                };
                var start_dragging_feature = function (event) {
                    if (is_feature_event(event)) {
                        that.dragging_feature = true;
                        drag_feature(event);
                    }
                };
                var stop_dragging_feature = function (event) {
                    that.dragging_feature = false;
                };
                var drag_feature = function (event) {
                    if (is_feature_event(event) && (that.dragging_feature)) {
                        var selected_feature = current_feature_name;
                        var nd_frame = that.nd_frame;
                        var center_point = that.center_xyz;
                        var model_transform = nd_frame.model_transform;
                        var location = event.model_location;
                        if (model_transform.vlength(location) > 1.0) {
                            location = model_transform.vunit(location);
                        }
                        var hyp = Math.min(1.0, location.x ** 2 + location.y ** 2);
                        var zscale = Math.sqrt(1.0 - hyp);
                        location.z = 0;
                        var inv_origin = nd_frame.frame_position_to_model_location({x:0, y:0, z:0});
                        var inv_location = nd_frame.frame_position_to_model_location(location);
                        var inv_z = nd_frame.frame_position_to_model_location({x:0, y:0, z:1});
                        var inv_loc_offset = model_transform.vsub(inv_location, inv_origin);
                        var inv_z_offset = model_transform.vsub(inv_z, inv_origin);
                        var proj = nd_frame.feature_axes[selected_feature];
                        if (model_transform.vdot(proj, inv_z_offset) < 0) {
                            zscale = -zscale;  // stay on same hemisphere
                        }
                        var direction = model_transform.vadd(
                            model_transform.vscale(zscale, inv_z_offset),
                            inv_loc_offset
                        );
                        var plength = model_transform.vlength(proj);
                        var dlength = model_transform.vlength(direction);
                        var new_axis = model_transform.vscale(plength / dlength, direction);
                        nd_frame.reset_axis(selected_feature, new_axis, center_point);
                        that.sync_feature_lines();
                        that.draw_scatter_canvas();
                    }
                };
                axis_canvas.on("mousedown", start_dragging_feature);
                axis_canvas.on("mouseup", stop_dragging_feature);
                //axis_edit.on("mouseout", stop_dragging_feature);
                axis_canvas.on("mousemove", drag_feature);
                // set up the slider and output displays for current_feature
                var proj = configuration.projectors[current_feature_name];
                var length = matrix.vlength(proj);
                this.projector_reference = proj;
                this.axis_slider.slider({
                    min: length / 20.0,
                    max: length * 3,
                    step: length / 20.0,
                    value: length,
                    slide: (function (event, ui) {
                        that.slider_update(event, ui);
                    })
                });
            };
            slider_update(event, ui) {
                var value = ui.value;
                var configuration = this.configuration();
                var matrix = this.matrix;
                var current_feature_name = this.current_feature_name;
                var proj = configuration.projectors[current_feature_name];
                var length = matrix.vlength(proj);
                if (length < 0.02) {
                    proj = this.projector_reference;
                    length = matrix.vlength(proj);
                }
                if (length > 0.01) {
                    var new_axis = matrix.vscale(value * 1.0 / length, proj);
                    this.nd_frame.reset_axis(current_feature_name , new_axis, this.center_xyz);
                    this.sync_feature_lines();
                    this.draw_scatter_canvas();
                }
            }
            sync_feature_lines() {
                // set feature lines according to current configuration
                var configuration = this.configuration();
                var matrix = this.matrix;
                for (var feature_name in this.features) {
                    var feature = this.features[feature_name];
                    var line = feature.line;
                    var model_transform = this.nd_frame.model_transform;
                    var proj = configuration.projectors[feature_name];
                    var origin = model_transform.affine({});
                    var projection = model_transform.affine(proj);
                    var offset= model_transform.vsub(projection, origin);
                    var length = model_transform.vlength(offset);
                    if (length < 0.01) {
                        length = 1.0;
                        offset = {x:1, y:0};  // arbitrary...
                    }
                    offset = model_transform.vscale(1.0/length, offset);
                    line.change({position2: offset});
                }
                var current_feature_name = this.current_feature_name;
                this.feature_name_area.val(current_feature_name);
                var proj = configuration.projectors[current_feature_name];
                this.x_area.val((+proj.x).toFixed(2));
                this.y_area.val((+proj.y).toFixed(2));
                this.z_area.val((+proj.z).toFixed(2));
                var length = matrix.vlength(proj);
                this.slider_value_div.html(" " + (length.toFixed(2)));
            };
            draw_scatter_canvas() {
                // next: fixed rotation and depth-scaled circles/rects
                var s = this.settings;
                var matrix = this.matrix;
                var that = this;
                var configuration = this.configuration();
                var scatter = this.scatter;
                scatter.clear_canvas();
                var w = s.scatter_size;
                var xy_frame = scatter.frame_region(
                    0, 0, w, w,
                    -1, -1, 1, 1  // dummy values reset later.
                );
                //this.xy_frame = xy_frame;  // is this needed?
                var nd_frame = scatter.nd_frame({
                    dedicated_frame: xy_frame,
                    feature_axes: configuration.projectors,
                    //translation: this.center_xyz,
                });
                this.nd_frame = nd_frame;
                // draw the points
                var points = this.point_vectors;
                var point_arrays = this.point_arrays;
                var name = this.dots_cb.is_checked();
                var fill = this.dots_cb.is_checked();
                for (var i=0; i<points.length; i++) {
                    var point_vector = points[i];
                    var point_array = point_arrays[i];
                    var color = configuration.color(point_array);
                    var circle = nd_frame.circle({
                        location: point_vector,
                        r: s.point_radius,   // xxxxx parameterize
                        color: color,
                        name: name,
                        fill: fill,
                    })
                }
                //this.center_xyz = nd_frame.center();
                var m = nd_frame.min_feature;
                var M = nd_frame.max_feature;
                var diff = matrix.vsub(M, m);
                var centroid = matrix.vscale(0.5, matrix.vadd(m, M));
                this.center_xyz = nd_frame.feature_vector_to_model_location(centroid);
                var diag = nd_frame.diagonal_length();
                if (this.axes_cb.is_checked()) {
                    // draw x, y, z axes
                    var aliases = configuration.aliases || {x: "x", y: "y", z: "z"};
                    for (var model_coord in aliases) {
                        var alias = aliases[model_coord];
                        var unit = {}
                        unit[model_coord] = 1;
                        var endpoint = matrix.vadd(this.center_xyz, matrix.vscale(diag/6.0, unit));
                        var txtpoint = matrix.vadd(this.center_xyz, matrix.vscale(diag/4.0, unit));
                        nd_frame.line({
                            location1: this.center_xyz, 
                            location2: endpoint,
                            in_model: true,
                        });
                        nd_frame.text({
                            location: txtpoint,
                            text: alias,
                            align: "center",
                            valign: "center",
                            background: "#ddd",
                            in_model: true,
                        })
                    }
                }
                this.projection_heads = {};
                if (this.projections_cb.is_checked()) {
                    // draw projectors for each feature
                    for (var feature_name in this.features) {
                        var lineWidth = 1;
                        if (feature_name == this.current_feature_name) {
                            lineWidth = 3;
                        }
                        var feature = this.features[feature_name];
                        var shift = diff[feature_name] || 1.0;
                        var offset = {}
                        offset[feature_name] = shift;
                        var color = feature.color;
                        var endpoint = matrix.vadd(centroid, matrix.vscale(s.feature_scale, offset));
                        nd_frame.line({
                            location1: endpoint,
                            location2: centroid,
                            color:color,
                            lineWidth: lineWidth,
                        });
                        //var side = s.square_side;
                        //var side = nd_frame.depth_scale(s.square_side * 0.5, s.square_side * 1.5, endpoint);
                        //console.log("side "+side);
                        //var side2 = side * 0.5
                        var head = nd_frame.rect({location: endpoint, color:color,
                            name:true, feature:feature_name});
                        this.scale_projection_head_size(head);
                        head.on("click", this.set_current_feature_event(feature_name));
                        this.projection_heads[feature_name] = head;
                    }
                }
                // fit (zoomed out) the frame and enable orbitting
                var radius = nd_frame.diagonal_length() * 0.5;
                // This code is intended to allow redraw without resetting the rotation.
                if (this.model_transform) {
                    // use existing tranform.
                    nd_frame.install_model_transform(this.model_transform);
                    nd_frame.dedicated_frame.set_extrema(this.xy_extrema);
                    //nd_frame.fit(s.zoom);
                } else {
                    nd_frame.fit(s.zoom);
                    // rotate the frame a bit initially
                    nd_frame.orbit(this.center_xyz, radius, {x: -0.5, y: -0.8});
                }
                var after = function () {
                    that.after_orbit();
                }
                // pan to put center_xyz in frame center
                //var frame_center = nd_frame.center();
                //var pan_shift = matrix.vsub(frame_center, this.center_xyz);
                //var pan_shift = matrix.vsub(frame_center, this.center_xyz);
                //pan_shift.z = 0;
                //nd_frame.pan(pan_shift);
                var orbit_center = this.center_xyz;
                nd_frame.orbit_all(radius, orbit_center, after);
            };
            set_current_feature_event(to_feature_name) {
                var that = this;
                return function(event) {
                    that.current_feature_name = to_feature_name;
                    that.draw_feature_canvas();
                    that.draw_scatter_canvas();
                };
            };
            zoom_in() {
                this.nd_frame.zoom(this.center_xyz, 1.2);
            };
            zoom_out() {
                this.nd_frame.zoom(this.center_xyz, 0.8);
            };
            after_orbit() {
                // After orbit change adjust related displayed information.
                // Save the model transform
                this.model_transform = this.nd_frame.model_transform;
                this.sync_feature_lines();
                this.xy_extrema = $.extend({}, this.nd_frame.dedicated_frame.extrema);
                for (var feature_name in this.projection_heads) {
                    this.scale_projection_head_size(this.projection_heads[feature_name]);
                }
            };
            scale_projection_head_size(projection_head) {
                var square_side = this.settings.square_side;
                var endpoint = projection_head.location;
                var side = this.nd_frame.depth_scale(square_side * 0.8, square_side * 1.5, endpoint);
                var side2 = 0.5 * side;
                projection_head.change({
                    w: side, h:side, dx:-side2, dy:-side2
                });
            }
            feature_vector(index) {
                var a = this.point_arrays[i];
                return this.feature_vector_from_array(a);
            };
            feature_vector_from_array(a) {
                var result = {};
                var features = this.features;
                for (var feature_name in features) {
                    var f = features[feature_name];
                    result[f.name] = a[f.index];
                }
                return result;
            };
            define_feature(fdescr) {
                var feature = new Feature(fdescr.name, fdescr.color, fdescr.index, this);
                this.feature_names.push(feature.name);
                this.features[feature.name] = feature;
            };
            define_configuration(cdescr) {
                var config = new Configuration(
                    cdescr.name, cdescr.projectors, cdescr.colorizer, cdescr.aliases, this);
                this.configuration_names.push(config.name);
                this.configurations[config.name] = config;
            };
            reset() {
                // (re) initialize all data structures.
                this.feature_names = [];
                this.features = {};
                this.configuration_names = [];
                this.configurations = {};
                this.point_arrays = [];
                this.point_vectors = [];
                this.current_configuration_name = null;
                this.dragging_feature = false;
                //this.xy_frame = null;
                this.nd_frame = null;
                this.model_transform = null;
                this.xy_extrema = null;
                // temporary default
                this.center_xyz = {x:0, y:0, z:0};
            };
            make_scaffolding() {
                var that = this;
                var redraw_scatter = function () {
                    that.draw_scatter_canvas();
                };
                var s = this.settings;
                var container = this.element;
                container.empty();
                container.css({
                    //"background-color": "#eed",
                    "display": "grid",
                    "grid-template-columns": `${s.scatter_size}px ${s.axis_size}px`,
                    //"grid-template-rows": `${s.header_size} ${s.scatter_size}px ${s.info_height}`,
                    "grid-template-rows": `${s.header_size} auto ${s.info_height}`,
                    "grid-gap": `${s.gap}`,
                });

                var header = $("<div/>").appendTo(container);
                header.css({
                    "background-color": "#dfd",
                    "grid-column": "1",
                    "grid-row": "1",
                    "display": "grid",
                    "grid-template-columns": ` auto auto`,
                    "grid-template-rows": `auto`,
                    "grid-gap": `${s.gap}`,
                });
                //header.html("header here")
                var title = $("<div/>").appendTo(header);
                title.css({
                    "background-color": "#eee",
                });
                title.html("ND Scatter");
                this.title_area = title;

                var mode_area = $("<div/>").appendTo(header);
                mode_area.css({
                    "background-color": "#eea",
                    "display": "grid",
                    "grid-template-columns": `auto auto auto auto auto auto`,
                    "grid-template-rows": `auto`,
                    "grid-gap": `${s.gap}`,
                });
                //mode_area.html("Mode selections here.");
                //this.mode_area = mode_area;

                var add_mode = function(label, off) {
                    return add_checkbox(label, mode_area, redraw_scatter, off, "#fee");
                };
                this.dots_cb = add_mode("dots");
                this.projections_cb = add_mode("projections");
                this.axes_cb = add_mode("axes");
                this.lasso_cb = add_mode("lasso", true);

                var zoom_out = $("<div> \u2296 </div>").appendTo(mode_area);
                zoom_out.click(function () { that.zoom_out(); });
                var zoom_in = $("<div> \u2295 </div>").appendTo(mode_area);
                zoom_in.click(function () { that.zoom_in(); });
        
                // scatter plot area
                var scatter = $("<div/>").appendTo(container);
                scatter.css({
                    "background-color": "#efe",
                    "grid-column": "1",
                    "grid-row": "2",
                });
                //scatter.html("scatter plot here.");
                var w = s.scatter_size;
                var canvas_config = {
                    width: w,
                    height: w,
                };
                scatter.dual_canvas_helper(canvas_config);
                this.scatter = scatter;

                // XXXX debug!
                //scatter.invisible_canvas.show();
                //scatter.test_canvas.show();
        
                var sidebar = $("<div/>").appendTo(container);
                sidebar.css({
                    "background-color": "#eee",
                    "grid-column": "2",
                    "grid-row": "1 / 4",
                    "display": "grid",
                    "grid-template-columns": `auto`,
                    "grid-template-rows": `${s.axis_size}px auto auto auto`,
                    "grid-gap": `${s.gap}`,
                });
                //sidebar.html("axis and features here.");
                var axis_canvas = $("<div/>").appendTo(sidebar);
                axis_canvas.css({
                    "background-color": "#eef",
                });
                //axis_canvas.html("axis canvas here.")
                w = s.axis_size;
                var canvas_config = {
                    width: w,
                    height: w,
                };
                axis_canvas.dual_canvas_helper(canvas_config);
                this.axis_canvas = axis_canvas;

                var axis_detail = $("<div/>").appendTo(sidebar);
                axis_detail.css({
                    "background-color": "#ffe",
                });
                //axis_detail.html("axis detail here.")
                var axis_slider_div = $("<div/>").appendTo(axis_detail);
                axis_slider_div.css({
                    "background-color": "#dde",
                    "display": "grid",
                    "grid-template-columns": `auto auto 60%`,
                });
                $("<div>length</div>").appendTo(axis_slider_div);
                var slider_value_div = $("<div/>").appendTo(axis_slider_div)
                slider_value_div.html("35")
                this.slider_value_div = slider_value_div;

                var axis_slider_container = $("<div/>").appendTo(axis_slider_div);
                axis_slider_container.slider({
                    min: -100,
                    max: 100,
                    step: 5,
                    value: 35,
                    //slide: slider_update,
                });
                this.axis_slider = axis_slider_container;

                var coordinate_div = $("<div/>").appendTo(axis_detail);
                coordinate_div.css({
                    "background-color": "#fde",
                    "display": "grid",
                    "grid-template-columns": `auto auto auto auto auto auto auto auto`,
                });

                var add_3d_coord_area = function(label, size, d) {
                    $("<div> " + label + " </div>").appendTo(coordinate_div);
                    var area = $(`<input type="text" value="${d}" size="${size}" readonly>`).appendTo(coordinate_div);
                    return area;
                };
                this.feature_name_area = add_3d_coord_area("feature", 10, "f1")
                this.x_area = add_3d_coord_area("X", 4, 0);
                this.y_area = add_3d_coord_area("Y", 4, 0);
                this.z_area = add_3d_coord_area("Z", 4, 0);

                this.axis_detail = axis_detail;

                var feature_info = $("<div/>").appendTo(sidebar);
                feature_info.css({
                    "background-color": "#fef",
                    "overflow": "scroll",
                });
                var feature_table = $("<div/>").appendTo(feature_info);
                feature_table.css({
                    "background-color": "#eed",
                    "display": "grid",
                    "grid-template-columns": `auto 30% auto auto auto auto auto`,
                    "grid-gap": `2px`,
                });
                // include_check, name, x y z min max
                this.reset_feature_table = function () {
                    feature_table.empty();
                    // header row
                    $("<div>\u2713</div>").appendTo(feature_table);
                    $("<div>feature</div>").appendTo(feature_table);
                    $("<div>X</div>").appendTo(feature_table);
                    $("<div>Y</div>").appendTo(feature_table);
                    $("<div>Z</div>").appendTo(feature_table);
                    $("<div>min</div>").appendTo(feature_table);
                    $("<div>max</div>").appendTo(feature_table);
                }
                this.reset_feature_table();
                //feature_info.html("feature_info here.")
                this.feature_table = feature_table;
                //this.feature_info = feature_info;
        
                var config_info = $("<div/>").appendTo(sidebar);
                config_info.css({
                    "background-color": "#eff",
                    "overflow": "scroll",
                });
                //config_info.html("config_info here.")
                var config_table = $("<div/>").appendTo(config_info);
                config_table.css({
                    "background-color": "#eed",
                    "display": "grid",
                    "grid-template-columns": `auto 80%`,
                    "grid-gap": `10px`,
                });
                // select radio button, configuration name
                this.reset_config_table = function () {
                    config_table.empty();
                    // header row
                    $("<div>\u2713</div>").appendTo(config_table);
                    $("<div>configuration</div>").appendTo(config_table);
                }
                this.reset_config_table();
                //feature_info.html("feature_info here.")
                this.config_table = config_table;
                this.save_config_button = $("<button>save new configuration</button>").appendTo(config_info);
                //this.config_info = config_info;

                var info = $("<div/>").appendTo(container);
                info.css({
                    "title": "info",
                    "background-color": "#cce",
                    "grid-column": "1",
                    "grid-row": "3",
                });
                info.html("other information here.");
            };
        };

        var add_checkbox = function (label, to_parent, on_change, off, background) {
            var span = $('<span/>').appendTo(to_parent);
            if (background) {
                span.css({
                    "background-color": "#fee",
                });
            }
            var cb = $('<input type="checkbox"/>').appendTo(span);
            $('<span> ' + label + ' </span>').appendTo(span);
            cb.is_checked = function () {
                return cb.is(":checked");
            };
            cb.uncheck = function(off) {
                return cb.prop("checked", !off)
            };
            cb.uncheck(off);
            if (on_change) {
                cb.change(on_change);
            }
            return cb;
        };

        class Feature {
            constructor(name, color, index, nd_scatter) {
                this.name = name;
                this.color = color;
                this.index = index;
                this.nd_scatter = nd_scatter;
                this.line = null;
            };
        };

        class Configuration {
            constructor(name, projectors, colorizer, aliases, nd_scatter) {
                this.name = name;
                this.projectors = projectors;
                this.colorizer = colorizer;
                this.aliases = aliases;
                this.nd_scatter = nd_scatter;
            };
            max_length() {
                var result = 0;
                for (var v in this.projectors) {
                    var vector = this.projectors[v];
                    var length = this.nd_scatter.matrix.vlength();
                    result = Math.max(length, result);
                }
                return result;
            };
            color(point_array) {
                var colorizer = this.colorizer;
                var indicator = point_array[colorizer.index];
                return colorizer.mapping[indicator];
            }
        }

        var result = new ND_Scatter(options, element);

        return result;
    };

    $.fn.nd_scatter.example = function(element) {

        element.empty();
        var scatter_plot = element.nd_scatter({});
        scatter_plot.make_scaffolding();

        var iris20json = {
            "features": [
                {
                    "name": "sepal length",
                    "index": 0,
                    "color": "red"
                },
                {
                    "name": "sepal width",
                    "index": 1,
                    "color": "blue"
                },
                {
                    "name": "petal length",
                    "index": 2,
                    "color": "green"
                },
                {
                    "name": "petal width",
                    "index": 3,
                    "color": "cyan"
                }
            ],
            "configurations": [
                {
                    "projectors": {
                        "sepal length": {
                            "x": 0.5223716204076604,
                            "y": 0.3723183633499691,
                            "z": -0.7210168090620429
                        },
                        "sepal width": {
                            "x": -0.2633549153139399,
                            "y": 0.9255564941472947,
                            "z": 0.2420328772139411
                        },
                        "petal length": {
                            "x": 0.5812540055976481,
                            "y": 0.021094776841246592,
                            "z": 0.14089225848754244
                        },
                        "petal width": {
                            "x": 0.5656110498826491,
                            "y": 0.06541576907892803,
                            "z": 0.6338014033558228
                        }
                    },
                    "name": "3d PCA",
                    "colorizer": {
                        "index": 4,
                        "mapping": {
                            "Iris-virginica": "brown",
                            "Iris-setosa": "purple",
                            "Iris-versicolor": "orange"
                        }
                    },
                    "aliases": {
                        "x": "PCA1",
                        "y": "PCA2",
                        "z": "PCA3"
                    }
                }
            ],
            "points": [
                [
                    -0.29484181807955234,
                    -0.587763531435416,
                    0.6490272348640005,
                    1.053536733088581,
                    "Iris-virginica"
                ],
                [
                    -1.6276883929597161,
                    -1.7447783570956819,
                    -1.3981381087490836,
                    -1.1815037572407716,
                    "Iris-setosa"
                ],
                [
                    0.5533332750260068,
                    0.5692512942248498,
                    0.5352958268854957,
                    0.5276448530110863,
                    "Iris-versicolor"
                ],
                [
                    -0.4160096885232032,
                    -1.0505694616995218,
                    0.3646987149177388,
                    0.001752972933591456,
                    "Iris-versicolor"
                ],
                [
                    2.2496834612371255,
                    -0.587763531435416,
                    1.6726099066705424,
                    1.053536733088581,
                    "Iris-virginica"
                ]
            ]
        };

        scatter_plot.define_json(iris20json);
    };

})(jQuery);