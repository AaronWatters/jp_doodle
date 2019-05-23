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
                    "grid-gap": `2`,
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
                    "grid-gap": `10`,
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

        var result = new ND_Scatter(options, element);

        return result;
    };

    $.fn.nd_scatter.example = function(element) {

        element.empty();
        var scatter_plot = element.nd_scatter({});
        scatter_plot.make_scaffolding();

    };

})(jQuery);