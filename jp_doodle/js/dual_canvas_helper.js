/*

JQuery plugin helper for building widgets that use 2d canvas displays.
This widget uses 2 canvases -- a visible display canvas
and an invisible index canvas used to find objects associated with
mouse events by pseudocolor.

Uses canvas_2d_widget_helper 

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/

// xxxx add image primatives,
// eg https://stackoverflow.com/questions/21300921/how-to-convert-byte-array-to-image-in-javascript/21301006#21301006

(function($) {

    $.fn.dual_canvas_helper = function (options) {
        var target = this;
        var settings = $.extend({
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

        target.reset_canvas = function (keep_stats) {
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
            target.visible_canvas.canvas_2d_widget_helper(settings_overrides);
            target.invisible_canvas.canvas_2d_widget_helper(settings_overrides);
            target.clear_canvas(keep_stats);
        }

        target.clear_canvas = function (keep_stats) {
            if (keep_stats) {
                target.visible_canvas.canvas_stats = {};
            }
            // object list for redraws
            target.object_list = [];
            // lookup structures for named objects
            target.name_to_object_info = {};
            target.color_index_to_name = {};
            target.event_types = {};
            target.default_event_handlers = {};
            target.visible_canvas.clear_canvas();
            target.invisible_canvas.clear_canvas();
        };

        target.fit = function (stats, margin) {
            // stats if defined should provide min_x, max_x, min_y, max_y
            // Adjust the translate and scale so that the visible objects are centered and visible.
            var x_translate = 0.0;
            var y_translate = 0.0;
            var scale = 1.0;
            // try to use existing stats
            if (!stats) {
                stats = target.visible_canvas.stats;
            }
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

        target.set_visibilities = function (names, visibility) {
            for (var i=0; i<names.length; i++) {
                var name = names[i];
                var object_info = target.name_to_object_info[name];
                if (object_info) {
                    object_info.hide = (!visibility);
                }
                target.request_redraw();
            }
        };

        target.draw_object_info = function(object_info) {
            if (object_info.hide) {
                // do not draw hidden objects
                return;
            }
            var draw_fn = object_info.draw_on_canvas;
            var draw_info = draw_fn(target.visible_canvas, object_info);
            // store additional information attached during the draw operation
            $.extend(object_info, draw_info);
            if (object_info.name) {
                // also draw invisible object using psuedocolor for event lookups
                var info2 = $.extend({}, object_info);
                if (object_info.draw_mask) {
                    // convert visible object invisible mask object (text becomes rectangle, eg)
                    draw_fn = object_info.draw_mask;
                }
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
                    var info = method(s);
                    // store additional information added during draw operation
                    $.extend(s, info);
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

        target.converted_location = function (x, y) {
            return target.visible_canvas.converted_location(x, y);
        }

        target.watch_event = function(event_type) {
            if (!target.event_types[event_type]) {
                target.visible_canvas.canvas.on(event_type, target.generic_event_handler);
                target.event_types[event_type] = true;
            }
            // mouseover and mouseout events are emulated using mousemove
            if ((event_type == "mouseover") || (event_type == "mouseout")) {
                target.watch_event("mousemove");
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
            //var event_type = e.type;
            //var default_handler = target.default_event_handlers[event_type];
            var object_handler = null;
            var invisible = target.invisible_canvas;
            var visible = target.visible_canvas;
            e.pixel_location = visible.event_pixel_location(e);
            e.invisible_color = invisible.color_at(e.pixel_location.x, e.pixel_location.y).data;
            e.color_index = target.color_array_to_index(e.invisible_color);
            e.canvas_name = target.color_index_to_name[e.color_index];
            var process_event = function(e, no_default) {
                var event_type = e.type;
                var default_handler = null;
                if (!no_default) {
                    default_handler = target.default_event_handlers[event_type];
                }
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
            };
            // "normal" event handling
            process_event(e);
            // mouseover and mouseout simulation:
            var last_event = target.last_canvas_event;
            if ((last_event) && (e.type == "mousemove") && (last_event.canvas_name != e.canvas_name)) {
                if (last_event.canvas_name) {
                    var mouseout_event = $.extend({}, e);
                    mouseout_event.type = "mouseout";
                    mouseout_event.canvas_name = last_event.canvas_name;
                    mouseout_event.object_info = last_event.object_info;
                    // attempt a mouseout with no default
                    process_event(mouseout_event);
                }
                if (e.canvas_name) {
                    var mouseover_event = $.extend({}, e);
                    mouseover_event.type = "mouseover"
                    // attempt a mouseover with no default
                    process_event(mouseover_event, true);
                }
            }
            //var last_event = target.last_canvas_event;
            target.last_canvas_event = e;
        };

        target.vector_frame = function(
            x_vector,
            y_vector,
            xy_offset) {
            return target.dual_canvas_helper.reference_frame(
                target,
                x_vector,
                y_vector,
                xy_offset
            );
        };

        target.rframe = function(scale_x, scale_y, translate_x, translate_y) {
            return target.vector_frame(
                {x: scale_x, y:0},
                {x:0, y: scale_y},
                {x: translate_x, y: translate_y}
            );
            // xxxx could add special methods like model_to_pixel.
        };

        target.callback_with_pixel_color = function(pixel_x, pixel_y, callback, delay) {
            // For testing.  Delay finish to allow widget initialization to stabilize before testing.
            if (!delay) {
                delay = 1000;  // delay for 1 second.
            }
            var finish = function() {
                var color_data = target.visible_canvas.color_at(pixel_x, pixel_y).data;
                var result = [];
                for (var i=0; i<color_data.length; i++) { 
                    result.push(color_data[i]);
                }
                callback(result);
            };
            setTimeout(finish, delay);
        };

        target.canvas_2d_widget_helper.add_vector_ops(target);

        return target;
    };

    $.fn.dual_canvas_helper.reference_frame = function(
        parent_canvas, 
        x_vector, 
        y_vector, 
        xy_offset) 
    {
        // View into canvas with shifted and scaled positions.
        // Do not adjust rectangle w/h or orientation, text parameters, or circle radius.
        if (!x_vector) {
            x_vector = {x: 1, y: 0};
        }
        if (!y_vector) {
            y_vector = {x: 0, y: 1};
        }
        if (!xy_offset) {
            xy_offset = {x: 0, y: 0};
        }
        var frame = $.extend({
            parent_canvas: parent_canvas,
            x_vector: x_vector,
            y_vector: y_vector,
            xy_offset: xy_offset,
        }, parent_canvas);

        frame.converted_location = function (x, y) {
            // Convert shared "model" location to "frame" location.
            // "scale" then translate (?)
            var x_scale = frame.vscale(x, frame.x_vector);
            var y_scale = frame.vscale(y, frame.y_vector);
            var xy = frame.vadd(x_scale, y_scale);
            var cvt = frame.vadd(frame.xy_offset, xy);
            // now DON't convert wrt parent
            //return frame.parent_canvas.converted_location(cvt.x, cvt.y);
            return cvt;
        };

        frame.unconverted_location = function(mx, my) {
            // Convert "frame" location to shared "model" location.
            // untranslate
            var untranslated = {x: mx - frame.xy_offset.x, y: my - frame.xy_offset.y};
            // then "unscale"
            // http://www.mathcentre.ac.uk/resources/uploaded/sigma-matrices7-2009-1.pdf
            var a = frame.x_vector.x;
            var b = frame.y_vector.x;
            var c = frame.x_vector.y;
            var d = frame.y_vector.y;
            var det = a * d - b * c;
            var x_inv = {x: d / det, y: -c / det};
            var y_inv = {x: -b / det, y: a /det};
            var x_unscale = frame.vscale(untranslated.x, x_inv);
            var y_unscale = frame.vscale(untranslated.y, y_inv);
            return frame.vadd(x_unscale, y_unscale);
        }

        var override_positions = function(shape_name) {
            // replace the shape factory:
            // override the location conversion parameter
            frame[shape_name] = function(opt, wait) {
                var s = $.extend({
                    coordinate_conversion: frame.converted_location,
                    frame: frame,
                }, opt)
                var method = frame.parent_canvas[shape_name];
                return method(s, wait);
            }
        };
        override_positions("circle");
        override_positions("line");
        override_positions("text");
        override_positions("rect");
        override_positions("polygon");

        //frame.model_to_pixel = function(mx, my) {
        //    throw new Error("General frame position inversion is not implemented yet.")
        //};

        return frame;
    }

    $.fn.dual_canvas_helper.example = function(element, x, y, w, h) {
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
        element.dual_canvas_helper(config);
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

    $.fn.dual_canvas_helper.frame_example = function(element) {
        element.empty();
        element.css("background-color", "cornsilk").width("520px");
        var config = {
            width: 400,
            height: 400,
            y_up: true,
        }
        element.dual_canvas_helper(config);
        element.text({x:70, y:10, text:"Frame Test", color:"#64d", degrees:45, font: "bold 20px Arial",});
        var backward = element.rframe(-2, 2, 200, 200);
        // exercise coordinate conversion
        var x = 11;
        var y = -77;
        var c = backward.converted_location(x, y);
        var ic = backward.unconverted_location(c.x, c.y);
        $("<div>" + x + "," + y + " :: " + c.x + "," + c.y + " :: " + ic.x + "," + ic.y + "</div>").appendTo(element);
        backward.text({
            text: "Backward",
            align: "right",
            x: 20,
            y: 20,
            color: "red"
        });
        var down = element.rframe(-1, -1, 200, 200);
        down.text({
            text: "Down",
            align: "right",
            x: 20,
            y: 20,
            color: "red"
        });
        var forward = element.rframe(1, 1, 200, 200);
        forward.text({
            text: "Forward",
            align: "left",
            x: 20,
            y: 20,
            color: "red"
        });
        var rotate = element.vector_frame(
            {x:1, y:2},
            {x:1, y:-1},
            {x:240, y:160}
        )
        rotate.text({
            text: "Rotate/skew",
            align: "right",
            x: 20,
            y: 20,
            color: "red"
        });
        var frames = [element, backward, forward, down, rotate];
        for (var i=0; i<frames.length; i++) {
            //element.visible_canvas.show_debug_bbox();
            var frame = frames[i];
            for (var x=0; x<101; x+=10) {
                frame.line({
                    x1: x,
                    y1: 0,
                    x2: x,
                    y2: 100,
                    color: "#aa9"
                });
                frame.line({
                    x1: 0,
                    y1: x,
                    x2: 100,
                    y2: x,
                    color: "#aa9"
                });
            }
            var points = [
                [20, 20],
                [40, 20],
                [20, 40],
                [40, 40],
                [40, 60]
            ];
            element.visible_canvas.show_debug_bbox();
            frame.polygon({
                points: points,
                fill: false,
                close: false,
                color: "blue"
            });
            element.visible_canvas.show_debug_bbox();
            frame.circle({
                x: 40, y: 60, r: 10, color: "green"
            });
            frame.rect({
                x: 60, y:80, w:10, h:10, color: "purple"
            })
            if (frame!=element) {
                var x = 30;
                var y = 65;
                var c = frame.converted_location(x, y);
                var ic = frame.unconverted_location(c.x, c.y);
                c = frame.vint(c);
                ic = frame.vint(ic);
                element.circle({
                    x: c.x, y: c.y, r: 7, color: "#449"
                })
                frame.text({
                    text: "" + c.x + "," + c.y + " :: " + ic.x + "," + ic.y,
                    x: x, y: y, color: "#FFD"
                });
            }
        }
        element.fit();
        element.visible_canvas.show_debug_bbox(true);
        element.visible_canvas.canvas.css("background-color", "#a7a");
    }

})(jQuery);
