/*

JQuery plugin helper for directed network layout.

Requires gd_graph and requirements to be loaded.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/
"use strict";

(function($) {

    $.fn.directed_network = function (options, element) {

        element = element || this;

        class NetworkVisualization {
            //

            constructor(options, element) {
                this.settings = $.extend({
                    canvas_size: 700,
                    info_height: 200,
                    selector_size: 100,
                    sidebar_size: 150,
                    gap: 10,
                }, options);
                this.element = element;
            };

            set_element_size() {
                var s = this.settings;
                var width = s.canvas_size + s.sidebar_size + 3 * s.gap;
                var height = s.canvas_size + s.selector_size + s.info_height + 5 * s.gap;
                this.element.width(width).height(height);
                this.canvas_div.width(s.canvas_size);
                this.canvas_div.height(s.canvas_size);
            };

            make_scaffolding() {
                var that = this;
                that.element.empty();
                //that.set_element_size();
                var container = $("<div/>").appendTo(that.element);
                var s = that.settings;
                container.css({
                    //"background-color": "#eed",
                    "display": "grid",
                    //"grid-template-columns": `150px ${s.canvas_size}px`,
                    "grid-template-columns": `${s.sidebar_size}px auto`,
                    "grid-template-rows": `auto ${s.info_height}px`,
                    "grid-gap": `${s.gap}`,
                });
                // misc controls on the left
                that.side_controls = $("<div/>").appendTo(container);
                that.side_controls.css({
                    "background-color": "#dfd",
                    "grid-column": "1",
                    "grid-row": "1",
                    "display": "grid",
                    "grid-template-columns": `auto`,
                    "grid-template-rows": `50px auto auto auto auto`,
                    "grid-gap": `${s.gap}`,
                });
                that.side_sliders = $("<div/>").appendTo(that.side_controls);
                //that.side_sliders.html("Size slider");
                that.side_buttons = $("<div/>").appendTo(that.side_controls);
                //that.side_buttons.html("buttons here.")
                that.side_lassos = $("<div/>").appendTo(that.side_controls);
                that.side_lassos.html("Lasso")
                that.side_layout = $("<div/>").appendTo(that.side_controls);
                that.side_layout.html("Layout")
                that.side_lists = $("<div/>").appendTo(that.side_controls);
                that.side_lists.html("List")
                // title and canvas upper right
                that.right_display = $("<div/>").appendTo(container);
                that.right_display.css({
                    "background-color": "#ffd",
                    "grid-column": "2",
                    "grid-row": "1",
                    "display": "grid",
                    "grid-template-columns": `auto`,
                    //"grid-template-rows": `auto ${s.canvas_size}px auto`,
                    "grid-template-rows": `auto auto auto`,
                    "grid-gap": `${s.gap}`,
                });
                that.title_div = $("<div/>").appendTo(that.right_display);
                that.title_div.css({
                    "background-color": "#ddd",
                })
                that.title_div.html("title here.");
                that.canvas_div = $("<div/>").appendTo(that.right_display);
                that.canvas_div.width(s.canvas_size);
                that.canvas_div.height(s.canvas_size);
                that.canvas_div.html("canvas here.");
                that.selection_div = $("<div/>").appendTo(that.right_display);
                that.selection_div.html("selections here.");
                // info at the bottom.
                that.info_container = $("<div/>").appendTo(container);
                that.info_container.css({
                    "background-color": "#dff",
                    "grid-column": "1/3",
                    //"grid-column": "2",
                    "grid-row": "2",
                    "grid-template-columns": `auto`,
                    "grid-template-rows": `${s.info_height} auto`,
                    "grid-gap": `${s.gap}`,
                });
                that.info_display = $("<div/>").appendTo(that.info_container);
                that.info_display.html("Information provided here.")
                // create side buttons
                var sb = that.side_buttons;
                that.add_button("reset", sb, function() { that.reset(); });
                that.add_button("expand", sb, function() { that.expand(); });
                that.add_button("points at", sb, function() { that.points_at(); });
                that.add_button("indicated by", sb, function() { that.indicated_by(); });
                that.add_button("sources only", sb, function() { that.sources_only(); });
                that.add_button("connected", sb, function() { that.connected(); });
                that.add_button("undo", sb, function() { that.undo(); });
                // create lassos
                var sl = that.side_lassos;
                that.add_button("focus", sl, function() { that.lasso_focus(); });
                that.add_button("ignore", sl, function() { that.lasso_ignore(); });
                // create layout actions
                var ly = that.side_layout;
                that.add_button("relax (slow)", ly, function() { that.relax_layout(); });
                that.add_button("skeleton (faster)", ly, function() { that.skeleton_layout(); });
                that.add_button("grid (fastest)", ly, function() { that.grid_layout(); });
                // create list actions
                var ls = that.side_lists
                that.add_button("nodes", ls, function() { that.list_nodes(); });
                that.add_button("edges", ls, function() { that.list_edges(); });
                // create sliders
                that.canvas_slider = $("<div/>").appendTo(that.side_sliders);
                that.canvas_slider.slider({
                    min: s.canvas_size * 0.2,
                    max: s.canvas_size * 5,
                    value: s.canvas_size,
                });
                that.canvas_size_display = $("<div/>").appendTo(that.side_sliders);
                that.canvas_size_display.html("?size?");
                var update_slider = function () {
                    s.canvas_size = that.canvas_slider.slider( "value" );
                    that.set_element_size()
                    that.canvas_size_display.html("" + s.canvas_size);
                };
                update_slider();
                that.canvas_slider.on( "slidechange", update_slider );
                // create canvas
                // create selections

                that.set_element_size();
            };

            add_button(text, container, click_callback) {
                var button_div = $("<div/>").appendTo(container);
                var button = $('<a href="#">' + text + "</a>").appendTo(button_div);
                button.click(click_callback);
            };

            set_title(text) {
                this.title_div.html(text);
            }

            configure_node(name, config) {
                // add a node with a configuration.
            };

            configure_edge(source, destination, config) {
                // configure an edge
            }

            display(name_to_node, key_to_edge) {
                // present current nodes and edges in the canvas area
            };

            reset(recalculate_layout) {
                // display all nodes and edges
            }

            layout(method_name) {
                // assign positions for currently visible nodes and edges.
            };

        };

        return new NetworkVisualization(options, element);
    };

    $.fn.directed_network.example = function(element) {
        var N = element.directed_network();
        N.make_scaffolding();
        N.set_title("A Very Interesting Network.")
    };

})(jQuery);