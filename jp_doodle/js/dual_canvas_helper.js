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
            if (target.canvas_container) {
                target.canvas_container.empty();
            } else {
                target.canvas_container = $("<div/>").appendTo(target);
            }
            var settings_overrides = {};
            for (var key in settings) {
                settings_overrides[key] = target["canvas_" + key];
            }
            // make visible and invisible dual canvases
            target.visible_canvas = $("<div/>").appendTo(target.canvas_container);
            target.invisible_canvas = $("<div/>").appendTo(target.canvas_container);
            target.invisible_canvas.hide();
            target.canvas_2d_widget_helper(target.visible_canvas, settings_overrides);
            target.canvas_2d_widget_helper(target.invisible_canvas, settings_overrides);
            // object list for redraws
            target.object_list = [];
            // lookup structures for named objects
            target.name_to_object_info = {};
            target.color_index_to_name = {};
            target.event_types = {};
            target.default_event_handlers = {};
        };

        target.fit = function (stats, margin) {
            // stats if defined should provide min_x, max_x, min_y, max_y
            // Adjust the translate and scale so that the visible objects are centered and visible.
            var x_translate = 0.0;
            var y_translate = 0.0;
            var scale = 1.0;
            if (!stats) {
                // get boundaries for visible objects
                target.set_translate_scale();
                var vc = target.visible_canvas;
                // Redraw and collect stats on visible objects
                vc.canvas_stats = {};
                target.redraw();
                stats = vc.canvas_stats;
            }
            var canvas = vc.canvas[0];
            var cwidth = canvas.width;
            var cheight = canvas.height;
            if (!margin) {
                margin = 0.01 * Math.max(stats.max_x - stats.min_x, stats.max_y - stats.min_y);   // xxxx?
            }
            var width = stats.max_x - stats.min_x + 2 * margin;
            var height = stats.max_y - stats.min_y + 2 * margin;
            // DEBUG: draw limits rectangle
            //target.rect({x: stats.min_x-2, y: stats.min_y-2, h:height+4, w:width+4, color:"yellow", fill:false});
            var wscale = cwidth * 1.0 / width;
            var hscale = cheight * 1.0 / height;
            //var scale = Math.min(wscale, hscale);
            var y_up = vc.canvas_y_up;
            if (hscale < wscale) {
                // fit y and center x
                scale = hscale;
                y_translate = - stats.min_y + margin;
                x_translate = - stats.min_x + 0.5 * (cwidth / scale - width) + margin;
            } else {
                // fit x and center y
                scale = wscale;
                x_translate = - stats.min_x + margin;
                y_translate = - stats.min_y + 0.5 * (cheight / scale - height) + margin;
            }
            var translate_scale = {x: x_translate, y: y_translate, w: scale, h: scale};
            //return;
            target.set_translate_scale(translate_scale);
            // reset the event callbacks
            for (var event_type in target.event_types) {
                target.visible_canvas.canvas.on(event_type, target.generic_event_handler);
                target.event_types[event_type] = true;
            }
            target.request_redraw();
        }

        target.set_translate_scale = function (translate_scale) {
            if (!translate_scale) {
                translate_scale = {x: 0.0, y:0.0, w:1.0, h:1.0};
            }
            target.canvas_translate_scale = translate_scale;
            target.visible_canvas.canvas_translate_scale = translate_scale;
            target.invisible_canvas.canvas_translate_scale = translate_scale;
            target.visible_canvas.reset_canvas();
            target.invisible_canvas.reset_canvas();
        }

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
                        drawn_objects[object_index] = object_info;
                    }
                }
            }
            // keep only the drawn objects
            target.object_list = drawn_objects;
            target.redraw_pending = false;
        }

        target.redraw_pending = false;

        // Call this after modifying the object collection to request an eventual redraw.
        target.request_redraw = function() {
            if (!target.redraw_pending) {
                requestAnimationFrame(target.redraw);
                target.redraw_pending = true;
            }
        }

        target.store_object_info = function(info, draw_on_canvas) {
            var name = info.name;
            var object_list = target.object_list;
            var object_index = object_list.length;
            var object_info = $.extend({
                draw_on_canvas: draw_on_canvas,
            }, info);
            if (name) {
                var pseudocolor_array = null;
                var old_object_info = target.name_to_object_info[name];
                if (old_object_info) {
                    // this prevents saving 2 objects with same name -- xxxx is this what we want?
                    object_index = object_info.index; //  -- if you want delete, use delete...?
                    pseudocolor_array = object_info.pseudocolor_array;
                }
                if (!pseudocolor_array) {
                    pseudocolor_array = target.next_pseudocolor();
                }
                // bookkeeping for event look ups.
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

        target.change_element = function (name, opt, no_redraw) {
            var object_info = target.name_to_object_info[name];
            if (object_info) {
                $.extend(object_info, opt);
                if (!no_redraw) {
                    // schedule a redraw automatically
                    target.request_redraw();
                }
            } else {
                console.warn("change_element: no such element with name " + name);
            }
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
                    target.request_redraw();
                }
                // ignore request to forget unknown object
            }
        };

        target.draw_object_info = function(object_info) {
            var draw_fn = object_info.draw_on_canvas;
            draw_fn(target.visible_canvas, object_info);
            if (object_info.name) {
                // also draw hidden object using psuedocolor for event lookups
                var info2 = $.extend({}, object_info);
                info2.color = object_info.pseudocolor;
                draw_fn(target.invisible_canvas, info2);
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

        var assign_shape_factory = function(shape_name) {
            // refactored common logic for drawing shapes
            target[shape_name] = function(opt, wait) {
                var draw = function(canvas, s) {
                    var method = canvas[shape_name];
                    method(s);
                };
                var object_info = target.store_object_info(opt, draw);
                if (!wait) {
                    // draw the object now.
                    target.draw_object_info(object_info);
                }
            };
        };
        assign_shape_factory("circle");
        assign_shape_factory("line");
        assign_shape_factory("text");
        assign_shape_factory("rect");
        assign_shape_factory("polygon");

        target.watch_event = function(event_type) {
            if (!target.event_types[event_type]) {
                target.visible_canvas.canvas.on(event_type, target.generic_event_handler);
                target.event_types[event_type] = true;
            }
            // ??? no provision for forgetting events on the visible canvas?
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

        target.event_canvas_location = function(e) {
            return target.visible_canvas.event_canvas_location(e);
        };

        target.event_model_location = function(e) {
            return target.visible_canvas.event_model_location(e);
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

    $.fn.dual_canvas_helper.example = function(element, x, y, w, h) {
        debugger;
        if (!x) { x = 0; }
        if (!y) { y = 0; }
        if (!w) { w = 1.0; }
        if (!h) { h = 1.0; }
        element.empty();
        element.css("background-color", "cornsilk").width("520px");
        var config = {
            width: 400,
            height: 400,
            translate_scale: {x: x, y:y, w:w, h:h},
            y_up: false,
        }
        element.dual_canvas_helper(element, config);
        element.polygon({
            name: "polly", 
            points: [[250,100], [400,100], [280,180], [375,60], [370,180]],
            color: "#ffd",
        });
        element.circle({name: "green circle", x:160, y:70, r:20, color:"green"});
        element.rect({name:"a rect", x:10, y:50, w:10, h:120, color:"salmon", degrees:-15});
        element.text({name:"some text", x:40, y:40, text:"Canvas", color:"#64d", degrees:45,
            font: "bold 20px Arial",});
        element.line({name:"a line", x1:100, y1:100, x2:150, y2:130, color:"brown", lineWidth: 4});
        var info = $("<div>click the circle to pick it up..</div>").appendTo(element);
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
        var put_circle = function(event) {
            var loc = element.event_model_location(event);
            var ploc = event.pixel_location;
            element.change_element("green circle", {"x":loc.x, "y":loc.y});
            info.html(
                "<div> [" + Math.round(loc.x) + ", " + Math.round(loc.y) + "] :: [" 
                + Math.round(ploc.x) + ", " + Math.round(ploc.y) 
                + "] </div>")
            // change_element automatically schedules a redraw
            //element.request_redraw();
        };
        var drop_circle = function(event) {
            debugger;
            info.html("<div>dropping circle</div>");
            element.off_canvas_event("click");
            element.off_canvas_event("mousemove");
            element.on_canvas_event("click", pick_up_circle, "green circle");
            element.on_canvas_event("click", click_handler);
        };
        var pick_up_circle = function(event) {
            info.html("<div>picking up circle</div>");
            element.on_canvas_event("mousemove", put_circle);
            element.on_canvas_event("click", drop_circle);  // automatically override other handler
            element.off_canvas_event("click", "green circle");
        };
        element.on_canvas_event("click", pick_up_circle, "green circle");
        element.fit()
        element.visible_canvas.canvas.css("background-color", "#a7a");
    };

})(jQuery);
