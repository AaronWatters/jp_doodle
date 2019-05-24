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
                }, options);
                this.element = element;
                element.empty();
                element.html("uninitialized nd_scatter plot widget.");
            };
            define_json(json_data) {
                this.reset();
                var fjson = json_data.features;
                for (var i=0; i<fjson.length; i++) {
                    this.define_feature(fjson[i]);
                }
                var cjson = json_data.configurations;
                for (var i=0; i<cjson.length; i++) {
                    this.define_configuration(cjson[i]);
                }
                var pjson = json_data.points;
                for (var i=0; i<pjson.length; i++) {
                    // keep points as arrays -- convert when needed
                    var a = pjson[i];
                    this.point_arrays.push(a.slice());
                }
            };
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
            }
            define_feature(fdescr) {
                var feature = new Feature(fdescr.name, fdescr.color, fdescr.index);
                this.feature_names.push(feature.name);
                this.features[feature.name] = feature;
            };
            define_configuration(cdescr) {
                var config = new Configuration(cdescr.name, cdescr.projectors, cdescr.colorizer);
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
            };
            make_scaffolding() {
                var s = this.settings;
                var container = this.element;
                container.empty();
                container.css({
                    //"background-color": "#eed",
                    "display": "grid",
                    "grid-template-columns": `${s.scatter_size}px ${s.axis_size}px`,
                    "grid-template-rows": `${s.header_size} ${s.scatter_size}px ${s.info_height}`,
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
                    "grid-template-columns": `auto auto auto auto`,
                    "grid-template-rows": `auto`,
                    "grid-gap": `${s.gap}`,
                });
                //mode_area.html("Mode selections here.");
                //this.mode_area = mode_area;

                var add_mode = function(label) {
                    var span = $('<span/>').appendTo(mode_area);
                    span.css({
                        "background-color": "#fee",
                    });
                    var cb = $('<input type="checkbox"/>').appendTo(span);
                    $('<span> ' + label + ' </span>').appendTo(span);
                    return cb
                };
                this.dots_cb = add_mode("dots");
                this.projections_cb = add_mode("projections");
                this.axes_cb = add_mode("axes");
                this.lasso_cb = add_mode("lasso");
        
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
                this.x_area = add_3d_coord_area("Y", 4, 0);
                this.x_area = add_3d_coord_area("Z", 4, 0);

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

        class Feature {
            constructor(name, color, index) {
                this.name = name;
                this.color = color;
                this.index = index;
            };
        };

        class Configuration {
            constructor(name, projectors, colorizer) {
                this.name = name;
                this.projectors = projectors;
                this.colorizer = colorizer;
            };
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
                    "color": "brown"
                },
                {
                    "name": "sepal width",
                    "index": 1,
                    "color": "purple"
                },
                {
                    "name": "petal length",
                    "index": 2,
                    "color": "orange"
                },
                {
                    "name": "petal width",
                    "index": 3,
                    "color": "seagreen"
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