/*

JQuery plugin helper for building widgets that use 2d canvas displays.
This widget uses 2 canvases -- a visible display canvas
and an invisible index canvas used to find objects associated with
mouse events by pseudocolor.

Uses canvas_2d_widget_helper 

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/

(function($) {

    $.fn.dual_canvas_helper = function (target, options) {
        var settings = $.extend({
            // need to add stuff for coordinate conversion!
            width: 500,
            height: 500,
            lineWidth: 1,
            fillColor: "black",
            strokeStyle: "black",
            translate_scale: {x: 0.0, y:0.0, w:1.0, h:1.0},
            font: "normal 10px Arial",
        }, options);

        for (var key in settings) {
            target["canvas_" + key] = settings[key];
        }

        target.reset_canvas = function () {
            target.empty();
            var settings_overrides = {};
            for (var key in settings) {
                settings_overrides[key] = target["canvas_" + key];
            }
            // make visible and invisible dual canvases
            target.visible_canvas = $("<div/>").appendTo(target);
            target.invisible_canvas = $("<div/>").appendTo(target);
            target.invisible_canvas.hide();
            target.canvas_2d_widget_helper(target.visible_canvas);
            target.canvas_2d_widget_helper(target.invisible_canvas);
            // object list for redraws
            target.object_list = [];
            // lookup structures for named objects
            target.name_to_object_info = {};
            target.color_index_to_name = {};
            target.event_types = {};
            target.default_event_handlers = {};
        };

        target.redraw = function () {
            target.visible_canvas.clear_canvas();
            target.invisible_canvas.clear_canvas();
            var drawn_objects = [];
            var object_list = target.object_list;
            var name_to_object_info = target.name_to_object_info;
            for (var i=0; i<object_list.length; i++) {
                var object_info = object_list[i];
                if (object_info) {
                    // only draw objects with no name or with known names
                    var name = object_info.name;
                    if ((!name) || (name_to_object_info[name])) {
                        // draw and save
                        target.draw_object_info(object_info);
                        var object_index = drawn_objects.length;
                        object_info.index = object_index;
                        drawn_object[object_index] = object_info;
                    }
                }
            }
            // keep only the drawn objects
            target.object_list = drawn_objects;
        }

        target.store_object_info = function(name, color, draw_with_color_on_canvas_fn) {
            var object_list = target.object_list;
            var object_index = object_list.length;
            object_info = {};
            object_info.name = name;
            object_info.draw_fn = draw_with_color_on_canvas_fn;
            object_info.color = color;
            if (name) {
                var pseudocolor_array = null;
                var old_object_info = target.name_to_object_info[name];
                if (old_object_info) {
                    // this prevents saving 2 objects with same name -- xxxx is this what we want?
                    //object_index = object_info.index;  -- if you want delete, use delete...?
                    pseudocolor_array = object_info.pseudocolor_array;
                }
                if (!pseudocolor_array) {
                    pseudocolor_array = target.next_pseudocolor();
                }
                object_info.pseudocolor_array = pseudocolor_array;
                object_info.pseudocolor = target.array_to_color(pseudocolor_array);
                var color_index = target.color_array_to_index(pseudocolor_array);
                target.name_to_object_info[name] = object_info;
                target.color_index_to_name[color_index] = name;
            }
            object_info.index = object_index;
            object_list[object_index] = object_info;
            return object_info;
        };
        
        target.forget_objects = function(names) {
            for (var i=0; i<names.length; i++) {
                var name = names[i];
                var object_info = target.name_to_object_info[name];
                if (object_info) {
                    var index = object_info.index;
                    var pseudocolor_array = object_info.pseudocolor_array;
                    var color_index = target.color_array_to_index(pseudocolor_array);
                    target.object_list[index] = null;
                    delete target.name_to_object_info[name];
                    delete target.color_index_to_name[color_index];
                }
            }
        };

        target.draw_object_info = function(object_info) {
            var draw_fn = object_info.draw_fn;
            draw_fn(target.visible_canvas, object_info.color);
            if (object_info.name) {
                draw_fn(target.invisible_canvas, object_info.pseudocolor);
            }
        }

        target.reset_canvas();

        target.garish_pseudocolor_array = function(integer) {
            // Try to choose sequence of colors not likely to interpolate into eachother.
            // Intended to be used to identify objects using pixels drawn for those objects.
            var rgb = [0, 0, 0]
            for (var i=0; i<8; i++) {
                for (var j=0; j<3; j++) {
                    rgb[j] = (rgb[j] << 1) | (integer & 1);
                    integer = (integer >> 1);
                }
            }
            return rgb;
        };

        target.array_to_color = function(rgb) {
            return "rgb(" + rgb.join(",") + ")";
        }

        target.color_counter = 0;

        target.next_pseudocolor = function () {
            // XXX this wraps after about 16M elements.
            target.color_counter++;
            return target.garish_pseudocolor_array(target.color_counter);
        }

        target.color_array_to_index = function(color_array) {
            // convert a color to a mapping key for storage and look ups
            return ((color_array[0] << 16) | (color_array[1] << 8) | (color_array[2]));
        };

        target.circle = function(name, cx, cy, r, fill, atts, style) {
            var draw = function(canvas, color) {
                canvas.circle(name, cx, cy, r, color, atts, style);
            };
            var object_info = target.store_object_info(name, fill, draw);
            target.draw_object_info(object_info);
        };

        target.line = function(name, x1, y1, x2, y2, color, atts, style) {
            var draw = function(canvas, color) {
                canvas.line(name, x1, y1, x2, y2, color, atts, style);
            };
            var object_info = target.store_object_info(name, color, draw);
            target.draw_object_info(object_info);
        };

        target.text = function (name, x, y, text, fill, atts, style, degrees) {
            var draw = function(canvas, color) {
                canvas.text(name, x, y, text, color, atts, style, degrees);
            };
            var object_info = target.store_object_info(name, fill, draw);
            target.draw_object_info(object_info);
        };

        target.rect = function(name, x, y, w, h, fill, atts, style, degrees) {
            var draw = function(canvas, color) {
                canvas.rect(name, x, y, w, h, color, atts, style, degrees);
            };
            var object_info = target.store_object_info(name, fill, draw);
            target.draw_object_info(object_info);
        };

        target.watch_event = function(event_type) {
            if (!target.event_types[event_type]) {
                target.visible_canvas.canvas.on(event_type, target.generic_event_handler);
                target.event_types[event_type] = true;
            }
            // ??? no provision for forgetting events?
        };

        target.on_canvas_event = function(event_type, callback, for_name) {
            if (for_name) {
                var object_info = target.name_to_object_info[for_name];
                if (object_info) {
                    var key = "on_" + event_type;
                    target.watch_event(event_type);
                    object_info[key] = callback;
                } else {
                    console.warn("in on_canvas_event no object found with name: " + for_name);
                }
            } else {
                // no name means handle event for whole canvas.
                target.watch_event(event_type);
                target.default_event_handlers[event_type] = callback;
            }
        };

        target.off_canvas_event = function(event_type, for_name) {
            if (for_name) {
                var object_info = target.name_to_object_info[for_name];
                if (object_info) {
                    var key = "on_" + event_type;
                    object_info[key] = null;
                } else {
                    console.warn("in off_canvas_event no object found with name: " + for_name);
                }
            } else {
                target.default_event_handlers[event_type] = null;
            }
        };

        target.generic_event_handler = function(e) {
            var event_type = e.type;
            var default_handler = target.default_event_handlers[event_type];
            var object_handler = null;
            var invisible = target.invisible_canvas;
            var visible = target.visible_canvas;
            e.pixel_location = visible.event_pixel_location(e);
            e.invisible_color = invisible.color_at(e.pixel_location.x, e.pixel_location.y).data;
            e.color_index = target.color_array_to_index(e.invisible_color);
            e.canvas_name = target.color_index_to_name[e.color_index];
            if (e.canvas_name) {
                e.object_info = target.name_to_object_info[e.canvas_name];
                if (e.object_info) {
                    var key = "on_" + event_type;
                    object_handler = e.object_info[key];
                }
            }
            // No "event bubbling"?
            if (object_handler) {
                object_handler(e);
            } else if (default_handler) {
                default_handler(e);
            }
        }

        return target;
    };

    $.fn.dual_canvas_helper.example = function(element) {
        debugger;
        element.empty();
        element.css("background-color", "cornsilk").width("520px");
        var config = {
            width: 400,
            height: 200,
        }
        element.dual_canvas_helper(element, config);
        element.visible_canvas.canvas.css("background-color", "#a7a");
        element.circle("green circle", 160, 70, 20, "green");
        element.rect("a rect", 10, 50, 10, 120, "salmon", null, null, -15);
        element.text("some text", 40, 40, "Canvas", "#f4d", null, null, 45);
        element.line("a line", 100, 100, 150, 130, "brown");
        var info = $("<div>Information area here.</div>").appendTo(element);
        var click_handler = function(e) {
            info.html(
                "<div>click at " + e.pixel_location.x +
                " "+e.pixel_location.y +
                " "+e.canvas_name +
                " "+e.invisible_color +
                "</div>");
        }
        var mouse_over_circle_handler = function(e) {
            info.html(
                "<div>rect mouse over at " + e.pixel_location.x +
                " "+e.pixel_location.y +
                " "+e.canvas_name +
                " "+e.invisible_color +
                "</div>");
        }
        element.on_canvas_event("mousemove", mouse_over_circle_handler, "a rect");
        element.on_canvas_event("click", click_handler);
    };

})(jQuery);
