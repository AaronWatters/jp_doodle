/*

JQuery plugin helper for building widgets that use 2d canvas displays.
This widget uses 2 canvases -- a visible display canvas
and an invisible index canvas used to find objects associated with
mouse events by pseudocolor.

Uses canvas_2d_widget_helper 

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

XXXXX target.shaded_objects -- need to test for false hits!
XXXXX clean up events for forgotten objects

*/

(function($) {

    $.fn.dual_canvas_json = function (json) {
        // json deserializer...
        var target = this;
        var canvas_options = {};
        for (var attr in json) {
            if (attr.startsWith('canvas_')) {
                var suffix = attr.substring(7);
                canvas_options[suffix] = json[attr];
            }
        }
        // initialize the dual canvas
        target.dual_canvas_helper(canvas_options);
        // install all the images
        var image_urls = json.image_urls;
        for (var name in image_urls) {
            var url = image_urls[name];
            target.name_image_url(name, url);
        }
        var image_data = json.image_data;
        for (var name in image_data) {
            var d = image_data[name];
            target.name_image_data(name, d.data_array, d.width, d.height, d.low_color, d.high_color);
        }
        // create all objects (and objects in frames recursively)
        target.deserialize_json_objects(json.object_list);
        target.request_redraw();  // needed?
        return target;
    };

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

        // Use this flag to temporarily turn off element events
        target.disable_element_events = false;

        target.reset_canvas = function (keep_stats) {
            // Reinitialize the canvas -- hard reboot
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
            // Invisible canvas for event lookups
            target.invisible_canvas = $("<div/>").appendTo(target.canvas_container);
            target.invisible_canvas.hide();
            // Test canvas for event hit validation.
            target.test_canvas = $("<div/>").appendTo(target.canvas_container);
            target.test_canvas.hide();
            target.visible_canvas.canvas_2d_widget_helper(settings_overrides);
            target.no_change_conversion = target.visible_canvas.no_change_conversion;  // delegate 

            target.invisible_canvas.canvas_2d_widget_helper(settings_overrides);
            target.test_canvas.canvas_2d_widget_helper(settings_overrides);

            target.clear_canvas(keep_stats);
        }

        target.clear_canvas = function (keep_stats) {
            // Remove all visible objects from the canvas
            if (keep_stats) {
                target.visible_canvas.canvas_stats = {};
            }
            // mark any connected objects as detached from parent.
            // and also recursively detach connected frame contents.
            target.detach_objects();
            // object list for redraws
            target.object_list = [];
            // lookup structures for named objects
            target.name_to_object_info = {};
            target.color_index_to_name = {};
            target.active_transitions = {};
            target.image_urls = {};
            target.image_data = {};
            //target.event_types = {};
            //target.default_event_handlers = {};
            target.reset_events();
            target.visible_canvas.clear_canvas();
            target.invisible_canvas.clear_canvas();

            // remove all event listeners
            target.visible_canvas.canvas.off();
            target.invisible_canvas.canvas.off();   // not needed.

            // no need to clear the test_canvas now
        };

        target.local_json_data = function () {
            // top level information for serialization
            var result = {};
            result.shape_name = "canvas";
            for (var name in target) {
                if (name.startsWith('canvas_') && (name != 'canvas_container')) {
                    result[name] = target[name];
                }
            }
            // convert data arrays to JSON compatible arrays in place
            var image_data = target.image_data;
            for (var name in image_data) {
                var description = image_data[name];
                var data_array = description.data_array;
                if (!Array.isArray(data_array)) {
                    var a = [];
                    for (var i=0; i<data_array.length; i++) {
                        a.push(data_array[i]);
                    }
                    description.data_array = a;
                }
            }
            result.image_data = image_data;
            result.image_urls = target.image_urls;
            result.name_counter = target.name_counter;
            return result;
        };

        target.deserialize_frame = function(desc) {
            var frame = target.vector_frame(desc.x_vector, desc.y_vector, desc.xy_offset, desc.name);
            frame.hide = desc.hide;
            frame.deserialize_json_objects(desc.object_list);
            return frame;
        }

        target.active_region = function (default_to_view_box) {
            // This is only defined if stats have been previously computed
            var result = target.visible_canvas.stats;
            if ((default_to_view_box) && (!result)) {
                result = target.model_view_box();
            }
            return result;
        }

        target.fit = function (stats, margin) {
            // stats if defined should provide min_x, max_x, min_y, max_y
            // Adjust the translate and scale so that the visible objects are centered and visible.
            var vc = target.visible_canvas;
            var x_translate = 0.0;
            var y_translate = 0.0;
            var scale = 1.0;
            // try to use existing stats
            if (!stats) {
                stats = target.active_region();
            }
            if (!stats) {
                // get boundaries for visible objects
                target.set_translate_scale();
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
            target.visible_canvas.canvas.off();
            for (var event_type in target.event_info.event_types) {
                target.visible_canvas.canvas.on(event_type, target.generic_event_handler);
                target.event_info.event_types[event_type] = true;
            }
            target.request_redraw();
            return stats;
        };

        target.set_translate_scale = function (translate_scale) {
            if (!translate_scale) {
                translate_scale = {x: 0.0, y:0.0, w:1.0, h:1.0};
            }
            target.canvas_translate_scale = translate_scale;
            target.visible_canvas.canvas_translate_scale = translate_scale;
            target.invisible_canvas.canvas_translate_scale = translate_scale;
            target.test_canvas.canvas_translate_scale = translate_scale;
            target.visible_canvas.reset_canvas();
            target.invisible_canvas.reset_canvas();
            target.test_canvas.reset_canvas();
        }

        target.redraw = function () {
            // cancel redraw_pending if set
            target.redraw_pending = false;
            target.visible_canvas.clear_canvas();
            target.invisible_canvas.clear_canvas();
            target.prepare_for_redraw();
            target.object_list = target.objects_drawn(target.object_list);
            // perform any transitions last to allow for temporary objects
            target.do_transitions();
        };

        target.prepare_for_redraw = function () {
            // allow each of the objects in the object list to do bookkeeping before a redraw.
            // This is used for example by n-d frames to recalculate draw order
            var object_list = target.object_list;
            for (var i=0; i<object_list.length; i++) {
                var object_info = object_list[i];
                if ((object_info) && (object_info.prepare_for_redraw)) {
                    object_info.prepare_for_redraw();
                }
            }
        };

        // stuff for assemblies (like stars, arrows...)
        target.assembly_draw_functions = {};
        target.assembly_target = null;

        target.define_assembly = function (name, draw_on_target) {
            target.assembly_draw_functions[name] = draw_on_target;
        };

        target.install_assembly = function(name, draw_on_target, canvas) {
            // attach assembly creator as canvas.name.
            canvas = canvas || target;
            if (draw_on_target) {
                target.define_assembly(name, draw_on_target);
            }
            if (!target.assembly_draw_functions[name]) {
                throw new Error("unknown assembly " + name);
            }
            canvas[name] = function(options) {
                var settings = $.extend({
                    assembly: name,
                }, options)
                return canvas.assembly(settings);
            };
        };

        target.assembly = function(options) {
            var settings = $.extend({
                shape_name: "assembly",
                assembly: null, // must be defined.
            }, options);
            var draw_function = target.assembly_draw_functions[settings.assembly];
            if (!draw_function) {
                throw new Error("no such assembly defined: ", settings.assembly);
            }
            var draw_on_canvas = function (canvas, s) {
                target.assembly_target = canvas;
                target.assembler.reset();
                target.assembly.options = options;
                var info = draw_function(target.assembler, s);
                // draw accumulated objects on the canvas now
                //var objects = target.assembler.object_list;
                //for (var i=0; i<objects.length; i++) {
                //    var object_info = objects[i];
                //    target.draw_object_info(object_info)
                //}
                target.assembly_target = null;
                $.extend(s, info);   // as is done in assign_shape_factory.
            };
            settings = target.store_object_info(settings, draw_on_canvas);
            target.request_redraw();
            return settings;
        };

        target.assembler = {};

        target.assembler.reset = function () {
            //target.assembler.object_list = [];
            target.assembler.options = null;
        };

        var assign_assembler_factory = function(shape_name) {
            target.assembler[shape_name] = function(opt) {
                // configure the shape using the options on the assembly target, and store the configuration.
                var settings = $.extend({}, opt);
                var assembly_options = target.assembly.options;
                settings.frame = assembly_options.frame;
                settings.coordinate_conversion = assembly_options.coordinate_conversion;
                settings.assembly_component = true;
                var method = target.assembly_target[shape_name];
                if (!method) {
                    throw new Error("no such assembly method: " + shape_name);
                }
                //c.l("drawing info", settings);
                //c.l("drawing on", target.assembly_target)
                var info = method(settings);
                //c.l("factory info", info)
                //target.assembler.object_list.push(info);
            }
        };
        
        $.fn.dual_canvas_helper.draw_op_names = (
            "circle line text rect frame_rect frame_circle polygon " +
            "named_image assembly").split(" ");

        for (var i=0; i<$.fn.dual_canvas_helper.draw_op_names.length; i++) {
            var name = $.fn.dual_canvas_helper.draw_op_names[i];
            assign_assembler_factory(name);
        }

        target.objects_drawn = function (object_list) {
            // Don't draw anything on the test canvas now.
            var drawn_objects = [];
            var name_to_object_info = target.name_to_object_info;
            for (var i=0; i<object_list.length; i++) {
                var object_info = object_list[i];
                if (object_info) {
                    var name = object_info.name;
                    var object_index = drawn_objects.length;
                    if (object_info.is_frame) {
                        var frame = object_info;
                        frame.redraw_frame();
                        //if (frame.is_empty()) {
                            // forget empty frames
                            ////c.l("forgetting empty frame " + object_info.name)
                            //object_index = null;
                        //}
                    } else {
                        // only draw objects with no name or with known names
                        //var name = object_info.name;
                        if ((!name) || (name_to_object_info[name])) {
                            // draw and save
                            target.draw_object_info(object_info);
                        } else {
                            // forget it
                            object_index = null;
                        }
                    }
                    if (object_index != null) {
                        object_info.object_index = object_index;
                        drawn_objects[object_index] = object_info;
                    } else {
                        if (name_to_object_info[name]) {
                            // don't keep names for undrawn objects
                            delete name_to_object_info[name];
                        }
                    }
                }
            }
            // keep only the drawn objects
            return drawn_objects;
        };

        target.redraw_pending = false;
        target.disable_auto_redraw = false;

        // Call this after modifying the object collection to request an eventual redraw.
        target.request_redraw = function() {
            if (!target.redraw_pending) {
                if (!target.disable_auto_redraw) {
                    requestAnimationFrame(target.redraw);
                }
                target.redraw_pending = true;
            }
        };

        // enable or disable auto redraw on animation frame.
        // Temporary disable prevents redraws during large or slow scene updates as an optimization for better speed and visual effect.
        target.allow_auto_redraw = function(enabled) {
            ////c.l("allow_auto_redraw", enabled);
            var disabled_before = target.disable_auto_redraw;
            target.disable_auto_redraw = !enabled;
            // if it was previously disabled and there is a redraw pending then request a redraw
            if ((enabled) && (disabled_before) && (target.redraw_pending)) {
                target.redraw_pending = false;
                ////c.l("requesting redraw afer delay")
                target.request_redraw();
            }
        };

        target.store_object_info = function(info, draw_on_canvas, in_place) {
            // xxxx don't need to assign psuedocolors to frames???
            var name = info.name;
            // automatically assign name if needed
            if ((name === true) || ((!name) && (info.events))) {
                var prefix = info.shape_name || "anon";
                name = target.fresh_name(prefix);
                info.name = name;
            }
            var store_target = info.frame || target;
            var object_list = store_target.object_list;
            // By default append the new object.
            var object_index = object_list.length;
            var object_info = info;
            if ((!in_place) && (!info.in_place)) {
                // make a shallow copy of the object
                object_info = $.extend({}, info);
            }
            //object_info.draw_on_canvas = object_info.draw_on_canvas || draw_on_canvas;
            object_info.draw_on_canvas = draw_on_canvas || object_info.draw_on_canvas;
            //c.l("store object info", object_info);
            if (name) {
                // Set up color indexing
                var pseudocolor_array = null;
                var old_object_info = target.name_to_object_info[name];
                if (old_object_info) {
                    // Replace the existing object with the same naem.
                    // this prevents saving 2 objects with same name -- xxxx is this what we want?
                    object_index = old_object_info.object_index; //  -- if you want delete, use delete...?
                    pseudocolor_array = old_object_info.pseudocolor_array;
                    // request a redraw because the object changed
                    target.request_redraw();
                }
                // assign pseudocolor unless the object is a frame
                if (!info.is_frame) {
                    if (!pseudocolor_array) {
                        pseudocolor_array = target.next_pseudocolor();
                    }
                    // bookkeeping for event look ups.
                    object_info.pseudocolor_array = pseudocolor_array;
                    object_info.pseudocolor = target.array_to_color(pseudocolor_array);
                    var color_index = target.color_array_to_index(pseudocolor_array);
                    target.color_index_to_name[color_index] = name;
                }
                target.name_to_object_info[name] = object_info;
                // For named objects also attach api conveniences
                object_info.change = object_info.change || (function(options) {
                    target.change(object_info.name, options);
                });
                object_info.forget = object_info.forget || (function() {
                    target.forget_objects([object_info.name]);
                });
                object_info.visible = object_info.visible || (function(visibility) {
                    target.set_visibilities([object_info.name], visibility);
                });
                object_info.on = object_info.on || (function(event_type, callback) {
                    target.on_canvas_event(event_type, callback, object_info.name);
                });
                object_info.off = object_info.off || (function(event_type) {
                    target.off_canvas_event(event_type, object_info.name);
                });
                object_info.transition = object_info.transition || (function(to_values, seconds_duration) {
                    target.transition(object_info.name, to_values, seconds_duration);
                });
            }
            // store the object unless it is an assembly component
            if (!object_info.assembly_component){
                object_info.object_index = object_index;
                object_list[object_index] = object_info;
            }
            return object_info;
        };

        target.change = function (name_or_info, opt, no_redraw) {
            var object_info = target.get_object_info(name_or_info);
            if (object_info) {
                // call the on_change callback if defined
                if (object_info.on_change) {
                    opt = object_info.on_change(opt);
                }
                // in place update object description
                $.extend(object_info, opt);
                if (!no_redraw) {
                    // schedule a redraw automatically
                    target.request_redraw();
                }
            } else {
                console.warn("change: no such element with name " + name_or_info);
            }
        };
        
        target.forget_objects = function(names_or_infos) {
            // modify to remove all frame members.... xxxxxx
            var object_infos = [];
            for (var i=0; i<names_or_infos.length; i++) {
                // skip over any undefines or other false values
                var object_info = names_or_infos[i];
                if (object_info) {
                    var name = object_info;
                    if ((typeof name) == "string") {
                        object_info = target.name_to_object_info[name];
                    } else if (object_info) {
                        name = object_info.name;
                    }
                    if ((name) && (object_info) && (target.name_to_object_info[name])) {
                        object_infos.push(object_info);
                    }  // ignore request to forget unknown object
                }
            }
            target.forget_object_descriptions(object_infos);
        };

        target.forget_object_descriptions = function(object_infos) {
            for (var i=0; i<object_infos.length; i++) {
                var object_info = object_infos[i];
                if (object_info) {
                    var index = object_info.object_index;
                    var owner = object_info.frame || target;
                    owner.object_list[index] = null;
                    var name = object_info.name;
                    if (name) {
                        delete target.name_to_object_info[name];
                        var pseudocolor_array = object_info.pseudocolor_array;
                        if (pseudocolor_array) {
                            var color_index = target.color_array_to_index(pseudocolor_array);
                            if (target.color_index_to_name[color_index]) {
                                delete target.color_index_to_name[color_index];
                            }
                        }
                        if (target.active_transitions[name]) {
                            delete target.active_transitions[name];
                        }
                        if (target.event_info.name2type2handler[name]) {
                            delete target.event_info.name2type2handler[name]
                        }
                    }
                    if (object_info.is_frame) {
                        object_info.clear_frame();
                    }
                    target.request_redraw();
                }
            }
        };

        target.set_visibilities = function (names_or_infos, visibility) {
            for (var i=0; i<names_or_infos.length; i++) {
                var name_or_info = names_or_infos[i];
                var object_info = target.get_object_info(name_or_info);
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
            //c.l("object_info", object_info)
            var draw_fn = object_info.draw_on_canvas;
            var draw_info = draw_fn(target.visible_canvas, object_info);
            // store additional information attached during the draw operation
            $.extend(object_info, draw_info);
            if ((object_info.name) && (object_info.events !== false)) {
                // also draw invisible object using psuedocolor for event lookups
                target.draw_mask(object_info, target.invisible_canvas);
                // Don't draw on the test canvas now.
            }
        };

        target.draw_mask = function(object_info, invisible_canvas) {
            // for now do not draw mask for whole frame objects
            if (object_info.is_frame) {
                return;
            }
            var draw_fn = object_info.draw_on_canvas;
            var info2 = $.extend({}, object_info);
            if (object_info.draw_mask) {
                // convert visible object to invisible mask object (text becomes rectangle, eg)
                draw_fn = object_info.draw_mask;
            }
            info2.color = object_info.pseudocolor;
            draw_fn(invisible_canvas, info2);
        };

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
            // keep seeking for free color
            var result = null;
            for (var i=0; i<10; i++) {
                target.color_counter++;
                result = target.garish_pseudocolor_array(target.color_counter);
                var color_index = target.color_array_to_index(result);
                if (!(target.color_index_to_name[color_index])) {
                    return result;
                }
                // on collision, scramble the counter
                target.color_counter = result[0] + (result[1] << 8) + (result[2] << 16) + (target.color_counter & 1023);
            }
            // punt
            return result;
        };

        target.name_counter = 0;

        target.fresh_name = function(prefix) {
            prefix = prefix || "object_name_";
            target.name_counter++;
            return prefix + target.name_counter;
        };

        target.color_array_to_index = function(color_array) {
            // convert a color to a mapping key for storage and look ups
            if (color_array.length > 3) {
                // Do not index any color unless alpha channel is 255 (fully opaque)
                if (color_array[3] < 255) {
                    return null;
                }
            }
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
                object_info.shape_name = shape_name;
                if (!wait) {
                    // draw the object now.
                    target.draw_object_info(object_info);
                }
                return object_info;
            };
        };
        assign_shape_factory("circle");
        assign_shape_factory("line");
        assign_shape_factory("text");
        assign_shape_factory("rect");
        assign_shape_factory("frame_rect");
        assign_shape_factory("frame_circle");
        assign_shape_factory("polygon");
        assign_shape_factory("named_image");

        target.image_urls = {};

        target.name_image_url = function(image_name, url, no_redraw) {
            target.image_urls[image_name] = url;
            // load an image url
            var the_image = new Image();
            the_image.src = url;
            target.visible_canvas.add_image(image_name, the_image);
            if (!no_redraw) {
                // request a reload when the image arrives
                the_image.onload = function () {
                    target.request_redraw();
                };
            }
        };

        target.image_data = {};

        target.name_image_data = function(image_name, data_array, width, height, low_color, high_color) {
            // Create a named image from byte RGBA data.
            // https://stackoverflow.com/questions/21300921/how-to-convert-byte-array-to-image-in-javascript/21301006#21301006
            // Data must be linearized rgba values of the right size
            // low color and high color are interpolation points for grey scale images
            target.image_data[image_name] = {
                data_array: data_array,
                width: width,
                height: height,
                low_color: low_color || null,
                high_color: high_color || null,
            }
            var wh = width * height;
            var size = wh * 4;
            var length = data_array.length;
            var grey_scale = true;
            if (length != wh) {
                grey_scale = false;
                if (length != size) {
                    throw new Error("array length " + length + " doesn't match dimensions 4 X " + width +" X "+height);
                }
            }
            var context = target.visible_canvas.canvas_context;
            var imgdata = context.createImageData(width, height);
            var data = imgdata.data;
            if (grey_scale) {
                low_color = low_color || [0, 0, 0, 255];
                high_color = high_color || [255, 255, 255, 0];
                for (var i=0; i<wh; i++) {
                    // interpolate grey image
                    var lambda = data_array[i]/255;
                    var lambda1 = 1.0 - lambda;
                    for (var j=0; j<4; j++) {
                        var index = i * 4 + j;
                        data[index] = Math.floor(lambda1 * low_color[j] + lambda * high_color[j]);
                    }
                }
            } else {
                for (var i=0; i<size; i++) {
                    data[i] = data_array[i];
                }
            }
            // put the image into a canvas
            var container_canvas = $('<canvas width="'+width+'px" height="'+height+'px"/>');
            var container_context = container_canvas[0].getContext("2d");
            container_context.putImageData(imgdata, 0, 0);
            // store the container canvas as an image source
            target.visible_canvas.add_image(image_name, container_canvas[0]);
        };

        target.converted_location = function (x, y) {
            return target.visible_canvas.converted_location(x, y);
        };

        target.event_pixel_location = function (e) {
            return target.visible_canvas.event_pixel_location(e);
        };

        target.pixel_offset = function(target_x, target_y) {
            return target.visible_canvas.model_to_pixel(target_x, target_y);
        };

        target.watch_event = function(event_type) {
            if (!target.event_info.event_types[event_type]) {
                target.visible_canvas.canvas.on(event_type, target.generic_event_handler);
                target.event_info.event_types[event_type] = true;
                //if (!(target.event_info.object_event_handlers[event_type])) {
                //    target.event_info.object_event_handlers[event_type] = {};
                //}
            }
            // mouseover and mouseout events are emulated using mousemove
            if ((event_type == "mouseover") || (event_type == "mouseout")) {
                target.watch_event("mousemove");
            }
            // ??? no provision for cancelling events on the visible canvas?
        };

        target.get_object_info = function(for_name_or_info) {
            // get the stored object info for a name or a possibly old version of object info.
            var for_name = for_name_or_info;
            if ((typeof for_name) != "string") {
                for_name = for_name_or_info.name;
                if (!for_name) {
                    throw new Error("cannot retrieve info for unnamed object.");
                }
            }
            return target.name_to_object_info[for_name];
        }

        // Delayed events: designed to prevent event flooding across a communications connection
        // like a Jupyter communications link, for example.
        // Register of delayed events
        target.type_to_delayed_event = {};
        target.delayed_events_pending = false;
        target.event_delay_ms = 50;
        
        target.delay_event = function(event_type, callback, event_object) {
            // delay event -- only the last event of this type will be preserved when the timeout arrives.
            var event_info = {callback: callback, event_object: event_object};
            // override any existing event of this type.
            target.type_to_delayed_event[event_type] = event_info;
            target.request_drain_delayed_events();
        }
        target.request_drain_delayed_events = function () {
            if (!target.delayed_events_pending) {
                setTimeout(target.drain_delayed_events, target.event_delay_ms)
                target.delayed_events_pending = true;
            }
        }
        target.drain_delayed_events = function () {
            // execute the delayed events
            target.delayed_events_pending = false;
            var pending = target.type_to_delayed_event;
            target.type_to_delayed_event = {};
            for (var type in pending) {
                var event_info = pending[type];
                event_info.callback(event_info.event_object);
            }
        }

        target.abbreviated_on_canvas_event = function(event_type, callback, for_name_or_info, delayed) {
            // Intended for use with Jupyter. Abbreviate the size of the event sent to the callback
            // to reduce message sizes sent to the Python kernel.
            var callback_wrapper = function(event) {
                var abbrev = $.extend({}, event);
                abbrev.originalEvent = null;
                abbrev.currentTarget = null
                abbrev.toElement = null;
                abbrev.target = null;
                abbrev.delegateTarget = null;
                abbrev.view = null;
                if (delayed) {
                    target.delay_event(event_type, callback, abbrev);
                } else {
                    callback(abbrev);
                }
            }
            return target.on_canvas_event(event_type, callback_wrapper, for_name_or_info)
        };

        target.on_canvas_event = function(event_type, callback, for_name_or_info) {
            if (for_name_or_info) {
                var object_info = target.get_object_info(for_name_or_info);
                var for_name = object_info.name;
                if (object_info) {
                    if (object_info.events === false) {
                        throw new Error("object " + name + " has events disabled.");
                    }
                    //var key = "on_" + event_type;
                    target.watch_event(event_type);
                    //object_info[key] = callback;
                    //target.event_info.object_event_handlers[event_type][for_name] = callback;
                    var n2t2h = target.event_info.name2type2handler;
                    if (!n2t2h[for_name]) {
                        n2t2h[for_name] = {};
                    }
                    n2t2h[for_name][event_type] = callback;
                } else {
                    console.warn("in on_canvas_event no object found with name: " + for_name);
                }
            } else {
                // no name means handle event for whole canvas.
                target.watch_event(event_type);
                target.event_info.default_event_handlers[event_type] = callback;
            }
        };

        target.on = function(event_type, callback) {
            return target.on_canvas_event(event_type, callback);
        };

        target.off_canvas_event = function(event_type, for_name_or_info) {
            if (for_name_or_info) {
                var object_info =  target.get_object_info(for_name_or_info);
                var for_name = object_info.name;
                //if ((object_info) && (target.event_info.object_event_handlers[event_type]) &&
                //        (target.event_info.object_event_handlers[event_type][for_name])) {
                //    delete target.event_info.object_event_handlers[event_type][for_name];
                //} else {
                //    console.warn("in off_canvas_event no object found with name: " + for_name);
                //}
                var n2t2h = target.event_info.name2type2handler;
                if ((object_info) && (n2t2h[for_name]) && (n2t2h[for_name][event_type])) {
                    delete n2t2h[for_name][event_type];
                } else {
                    console.warn("in off_canvas_event no bound object found with name: " + for_name);
                }
            } else {
                target.event_info.default_event_handlers[event_type] = null;
            }
        };

        target.off = function(event_type) {
            return target.off_canvas_event(event_type);
        };

        target.event_canvas_location = function(e) {
            return target.visible_canvas.event_canvas_location(e);
        };

        target.event_model_location = function(e) {
            return target.visible_canvas.event_model_location(e);
        };

        target.color_index_at = function(canvas, pixel_x, pixel_y) {
            var invisible_color = canvas.color_at(pixel_x, pixel_y).data;
            return target.color_array_to_index(invisible_color);
        };

        target.object_name_at_position = function (event, pixel_x, pixel_y) {
            // Find named object at position and validate it using the test canvas.
            var color_index = target.color_index_at(target.invisible_canvas,
                pixel_x, pixel_y);
            var canvas_name = target.color_index_to_name[color_index];
            var object_info = target.name_to_object_info[canvas_name];
            if ((canvas_name) && (object_info)) {
                // Validate the object hit by drawing on the test canvas.
                var test_canvas = target.test_canvas;
                test_canvas.clear_canvas();
                target.draw_mask(object_info, test_canvas);
                var test_index = target.color_index_at(test_canvas, pixel_x, pixel_y);
                if (test_index != color_index) {
                    // Bogus object hit probably caused by anti-aliasing.
                    canvas_name = null;
                }
            }
            if ((canvas_name) && (event)) {
                event.canvas_name = canvas_name;
                event.color_index = color_index;
                event.object_info = object_info;
            };
            return canvas_name;
        };

        target.generic_event_handler = function(e) {
            var visible = target.visible_canvas;
            // for testing allow test case to override pixel location.
            if (!e.pixel_location) {
                e.pixel_location = visible.event_pixel_location(e);
            }
            e.canvas_name = target.object_name_at_position(
                e, e.pixel_location.x, e.pixel_location.y);
            var last_event = target.last_canvas_event;
            var process_event = function(e, no_default) {
                var event_type = e.type;
                var default_handler = null;
                var object_handler = null;
                var reference_frame = target;
                if (!no_default) {
                    default_handler = target.event_info.default_event_handlers[event_type];
                }
                // object specific handling for registered objects
                if ((e.canvas_name) && (!target.disable_element_events) && (target.name_to_object_info[e.canvas_name])) {
                    var object_name = e.canvas_name
                    e.object_info = target.name_to_object_info[e.canvas_name];
                    // if the object has a frame, override the reference frame
                    if ((e.object_info) && (e.object_info.frame)) {
                        reference_frame = e.object_info.frame;
                        e.reference_frame = reference_frame;
                    }
                    //var object_handlers = target.event_info.object_event_handlers[event_type];
                    //if ((e.object_info) && (object_handlers)) {
                    //    // look for a handler specific to this object
                    //    object_handler = object_handlers[e.canvas_name];
                    //    if ((!object_handler) && (e.object_info.frame)) {
                    //        // otherwise, look for a handler specific to this frame
                    //        object_handler = object_handlers[e.object_info.frame.name];
                    //    }
                    //}
                    var n2t2h = target.event_info.name2type2handler;
                    // look for a event handler specific to this name
                    if ((n2t2h[object_name]) && (n2t2h[object_name][event_type])) {
                        object_handler = n2t2h[object_name][event_type];
                    }
                    // otherwise look for a handler bound to the frame
                    if ((!object_handler) && (e.object_info) && (e.object_info.frame)) {
                        var fname = e.object_info.frame.name;
                        if ((n2t2h[fname]) && (n2t2h[fname][event_type])) {
                            object_handler = n2t2h[fname][event_type];
                        }
                    }
                }
                // attach the model location relative to the reference frame (unless overridden by testing)
                if (!e.model_location) {
                    e.model_location = reference_frame.event_model_location(e);
                }
                // No "event bubbling"?
                if (object_handler) {
                    object_handler(e);
                } else if (default_handler) {
                    default_handler(e);
                }
                target.last_canvas_event = e;
            };
            // "normal" event handling
            //process_event(e);
            // mouseover and mouseout simulation:
            ////c.l("check emulations: ", [e.type, e.canvas_name,  ((!last_event) || last_event.canvas_name)]); //debug only.
            //if ((last_event) && (e.type == "mousemove") && (last_event.canvas_name != e.canvas_name)) {
            //if (e.type == "mousemove") {
                ////c.l("doing transition emulations " + last_event.canvas_name)
                if ((last_event) && (last_event.canvas_name) && ((!e.canvas_name) || (e.canvas_name!=last_event.canvas_name))) {
                    ////c.l("emulating mouseout");
                    var mouseout_event = $.extend({}, e);
                    mouseout_event.type = "mouseout";
                    mouseout_event.canvas_name = last_event.canvas_name;
                    mouseout_event.object_info = last_event.object_info;
                    // attempt a mouseout with no default
                    process_event(mouseout_event);
                }
                if ((e.canvas_name) && ((!last_event) || (!last_event.canvas_name) || (last_event.canvas_name!=e.canvas_name))) {
                    var mouseover_event = $.extend({}, e);
                    mouseover_event.type = "mouseover"
                    // attempt a mouseover with no default
                    process_event(mouseover_event, true);
                }
            //}
            // "normal" event handling -- after emulations!
            process_event(e);
            // do not allow event to propagate
            e.stopPropagation();
        };

        target.reset_events = function() {
            var old_event_info = target.event_info;
            target.event_info = {
                event_types: {},   // Is event enabled? type --> boolean.
                default_event_handlers: {},  // type --> global event handler.
                //object_event_handlers: {},  // type --> (name --> handler)
                name2type2handler: {},  // name --> (type --> handler) for events bound to an object by event
            };
            // turn off object events and defaults
            //target.disable_element_events = true;
            // return event handlers for later possible restoration
            return old_event_info;
        }

        target.restore_events = function(event_info) {
            var old_event_info = target.event_info;
            target.event_info = event_info;
            // turn events back on
            //target.disable_element_events = false;
            return old_event_info;
        };

        target.focus_canvas = function () {
            // set the focus to the visible canvas so the canvas can receive keyboard events.
            target.visible_canvas.canvas.attr("tabindex", "0");
            target.visible_canvas.canvas.focus();
        }

        target.do_lasso = function(names_callback, config, delete_after) {
            // Use a lasso to surround elements.  Return names of elements under lassoed rectangle
            // XXXX Need to change this to choose a color that is not in the original canvas for lasso tool.
            var options = $.extend({
                name: "polygon_lasso",
                color: "red",
                lineWidth: 1,
                fill: false,
                close: false,
                points: [],
            }, config);
            var saved_event_handlers = target.reset_events();
            var points = [];
            var lassoing = false;
            var mouse_down_handler = function(event) {
                lassoing = true;
                var loc = target.event_model_location(event)
                points = [[loc.x, loc.y]];
                options.points = points;
                target.polygon(options);
            };
            target.on_canvas_event("mousedown", mouse_down_handler);
            var mouse_move_handler = function(event) {
                if (!lassoing) {
                    return;
                }
                var loc = target.event_model_location(event);
                points.push([loc.x, loc.y]);
                target.change(options.name, {points: points});
            };
            target.on_canvas_event("mousemove", mouse_move_handler);
            var mouse_up_handler = function(event) {
                lassoing = false;
                // determine the names lassoed
                target.change(options.name, {fill: true, close: true});
                var name_to_object = target.shaded_objects(options.name);
                // clean up:
                // delete the lasso polygon if requested
                if (delete_after) {
                    target.forget_objects([options.name]);
                } else {
                    // otherwise unfill it
                    target.change(options.name, {fill: false});
                }
                target.restore_events(saved_event_handlers);
                // callback with the names found mapped to descriptions
                names_callback(name_to_object);
            }
            target.on_canvas_event("mouseup", mouse_up_handler);
            return options.name;
        }

        target.vector_frame = function(
            x_vector,
            y_vector,
            xy_offset,
            name) {
            return target.dual_canvas_helper.reference_frame(
                target,
                x_vector,
                y_vector,
                xy_offset,
                name
            );
        };

        // XXXX move frame parameter config to frame methods to enable frame config transitions

        target.rframe = function(scale_x, scale_y, translate_x, translate_y, name) {
            var result = target.vector_frame(null, null, null, name);
            result.set_rframe(scale_x, scale_y, translate_x, translate_y);
            return result;
            // xxxx could add special methods like model_to_pixel.
        };

        target.frame_region = function(minx, miny, maxx, maxy, frame_minx, frame_miny, frame_maxx, frame_maxy, name) {
            // Convenience: map frame region into the canvas region
            var result = target.vector_frame(null, null, null, name);
            result.set_region(minx, miny, maxx, maxy, frame_minx, frame_miny, frame_maxx, frame_maxy);
            return result;
        }

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

        target.shaded_objects = function(shading_name_or_info) {
            // determine the names of named objects underneith the shading object "paint".
            // Used for example to implement "lasso" selected objects under a polygon.
            // xxx This could be optimized: it is a brute force scan of the whole canvas 2x right now.
            // xxx This method will not find shaded objects that are obscured by other objects.
            // XXXX need to use the test_canvas here!!!
            // XXXX rework to remove duplicated code someday...
            var object_info = target.get_object_info(shading_name_or_info);
            var shading_name = object_info.name;
            if (!object_info) {
                throw new Error("can't find object with name " + shading_name);
            }
            var pseudocolor = object_info.pseudocolor;
            var shader_hidden_before = object_info.hide
            // get a hidden canvas pixel snapshot with the object hidden
            object_info.hide = true;
            target.redraw();
            var shaded_info = target.invisible_canvas.pixels();
            var shaded_pixels = shaded_info.data;
            // get a hidden canvas pixel snapshot with the object visible
            object_info.hide = false;
            target.redraw();
            var shading_pixels = target.invisible_canvas.pixels().data;
            // scan pixels to find named objects
            var name_to_shaded_objects = {};
            var shaded_object_evidence = {};
            for (var i=0; i<shaded_pixels.length; i += 4) {
                var shading_color_array = shading_pixels.slice(i, i+3);
                // var shading_color_index = target.color_array_to_index(shading_color_array);
                var shading_color = target.array_to_color(shading_color_array);
                if (shading_color == pseudocolor) {
                    // record any named object "under" this shading pixel
                    var shaded_color_array = shaded_pixels.slice(i, i+4);
                    var shaded_color_index = target.color_array_to_index(shaded_color_array);
                    var shaded_object_name = target.color_index_to_name[shaded_color_index];
                    if (shaded_object_name) {
                        var shaded_object_info = target.name_to_object_info[shaded_object_name];
                        if (shaded_object_info) {
                            var pixel_offset = i / 4;
                            var pixel_y = Math.trunc(pixel_offset / shaded_info.width);
                            var pixel_x = pixel_offset % shaded_info.width;
                            //name_to_shaded_objects[shaded_object_name] = shaded_object_info;
                            if (!shaded_object_evidence[shaded_object_name]) {
                                shaded_object_evidence[shaded_object_name] = {x: pixel_x, y: pixel_y, info: shaded_object_info};
                            }
                        }
                    }
                }
            }
            // Validate objects
            object_info.hide = true;
            target.redraw();
            for (var name in shaded_object_evidence) {
                var evidence = shaded_object_evidence[name];
                if (target.object_name_at_position(null, evidence.x, evidence.y) == name) {
                    name_to_shaded_objects[name] = evidence.info;
                }
            }
            object_info.hide = false;
            // Restore previous visibility state for shading object and implicitly request a redraw.
            target.set_visibilities([shading_name], !shader_hidden_before)
            // Add named objects with sample pixel locations that are inside the region
            var pixel_in_shadow = function (px, py) {
                // xxxxx this assumes y goes up...
                var row = shaded_info.height - 1 - py;
                if ((row >= 0) && (row < shaded_info.height) && (px >= 0) && (px < shaded_info.width)) {
                    var index = 4 * (shaded_info.width * row + px);
                    var shading_color_array = shading_pixels.slice(index, index+3);
                    var shading_color = target.array_to_color(shading_color_array);
                    return (shading_color == pseudocolor);
                }
                return false; // default
            }
            var name_to_info = target.name_to_object_info;
            for (var name in name_to_info) {
                var info = name_to_info[name];
                var sample_pixel = info.sample_pixel;
                if ((info != object_info) && (name) && (sample_pixel)) {
                    if (pixel_in_shadow(sample_pixel.x, sample_pixel.y)) {
                        name_to_shaded_objects[name] = info;
                    }
                }
            }
            return name_to_shaded_objects;
        };

        target.model_view_box = function () {
            return target.visible_canvas.model_view_box();
        };

        target.pixels = function(x, y, h, w) {
            return  target.visible_canvas.pixels(x, y, h, w);
        };

        target.model_location = function(mx, my) {
            // for consistency with reference frames -- model location is unchanged
            return {x: mx, y: my};
        }

        // color utilities
        target.color_string_to_array = function(color_string) {
            color_string = color_string.trim();
            if (color_string.startsWith("rgba")) {
                // try to parse rgba(r,g,b,a)
                try {
                    var parenthesized = color_string.substring(4).trim();
                    var last = parenthesized.length - 1;
                    if ((parenthesized.substring(0,1)=="(") && (parenthesized.substring(last, last+1)==")")) {
                        var comma_separated = parenthesized.substring(1,last);
                        var number_strings = comma_separated.split(",");
                        var numbers = number_strings.map(x => +x);
                        var ok = (numbers.length==4);
                        // for consistency scale alpha to 255
                        numbers[3] = numbers[3] * 255;
                        for (var i=0; i<4; i++) {
                            var n = numbers[i];
                            if (isNaN(n) || (n<0) || (n>256)) {
                                ok = false;
                            }
                        }
                        if (ok) {
                            return numbers;
                        }
                    }
                } catch (err) {
                    console.warn("error parsing rgba format " + color_string + " " + err);
                }
                console.warn("failed parsing rgba format " + color_string);
                return null;
            }
            var bbox = target.model_view_box();
            // draw a test rectangle of that color
            // XXX probably we need a much smaller rectangle, but KISS for now.
            var test_canvas = target.test_canvas;
            test_canvas.clear_canvas();
            test_canvas.rect({
                x: bbox.min_x, y: bbox.min_y,
                w: bbox.max_x - bbox.min_x, h: bbox.max_y - bbox.min_y,
                color: color_string
            });
            // find the color in the middle
            var p = target.pixel_offset(0.5 * (bbox.min_x + bbox.max_x), 0.5 * (bbox.max_y + bbox.min_y));
            var color_info = target.test_canvas.color_at(p.x, p.y);
            // rgba as byte values
            return color_info.data;
        };

        // transition mechanism
        target.active_transitions = {};

        target.do_transitions = function () {
            ////c.l("doing transitions");
            var active = target.active_transitions;
            var remaining = {};
            var redraw = false;
            for (var name in active) {
                var transition = active[name];
                transition.interpolate();
                if (transition.finished()) {
                    // xxxx any termination actions?
                    ////c.l("done transitioning " + name);
                    redraw = true;  // redraw for final interpolation
                } else {
                    ////c.l("continuing transitions for " + name);
                    remaining[name] = transition;
                    redraw = true;
                }
            }
            if (redraw) {
                ////c.l("requesting redraw for continuing transitions");
                target.request_redraw();
            }
            target.active_transitions = remaining;
        };

        target.transition = function(object_name_or_info, to_values, seconds_duration, mode) {
            var object_info = target.get_object_info(object_name_or_info);
            var object_name = object_info.name;
            mode = mode || "linear";
            seconds_duration = seconds_duration || 1;
            var start = (new Date()).getTime();
            var end = start + 1000 * seconds_duration;
            var from_values = $.extend({}, object_info);
            var transition = {
                start: start,
                end: end,
                object_name: object_name,
                from_values: from_values,
                to_values: to_values,
                lmd: function () {
                    //return 0.5; // DEBUG
                    var time = (new Date()).getTime();
                    var result = (time - transition.start) * 1.0 / (transition.end - transition.start);
                    return Math.max(0, Math.min(1.001, result));
                },
                finished: function () {
                    return transition.lmd() >= 1.0;
                },
                // interpolator may be null if there are no nontrivial changes to interpolate
                interpolator: target.linear_interpolator(object_name, from_values, to_values),
                interpolate: function () {
                    transition.interpolator(transition.lmd());
                },
            };
            //target.active_transitions.push(transition);
            if (transition.interpolator) {
                target.active_transitions[object_name] = transition;
            }
            ////c.l("requesting redraw for transition " + object_name)
            target.request_redraw();
            return transition;
        };

        target.linear_interpolator = function(object_name, from_mapping, to_mapping) {
            var map_interp = target.interpolate_mapping(from_mapping, to_mapping);
            if (!map_interp) {
                return null;   // nothing to interpolate.
            }
            var interpolator = function(lmd) {
                var mapping = map_interp(lmd);
                target.change(object_name, mapping);
            };
            return interpolator;
        };

        target.interpolate_mapping = function(from_mapping, to_mapping) {
            var map_interpolators = {};
            var trivial = true;  // until proven otherwise
            for (var attr in to_mapping) {
                var to_value = to_mapping[attr];
                var to_value_type = (typeof to_value);
                var from_value = from_mapping[attr];
                if (from_value != to_value) {
                    //trivial = false;
                    if (to_value_type == "number") {
                        // numeric value
                        from_value = from_value || 0;
                        map_interpolators[attr] = target.linear_numeric_interpolator(from_value, to_value);
                        trivial = false;
                    } else {
                        // non numeric value
                        if ((attr == "color") || (attr == "background")) {
                            map_interpolators[attr] = target.color_interpolator(from_value, to_value);
                            trivial = false;
                        } else if (attr == "points") {
                            map_interpolators[attr] = target.polygon_points_interpolator(from_value, to_value);
                            trivial = false;
                        } else if (to_value_type == "object") {
                            var interp = target.interpolate_mapping(from_value, to_value);
                            if (interp) {
                                map_interpolators[attr] = interp;
                                trivial = false;
                            }
                        } else {
                            map_interpolators[attr] = target.switch_value_interpolator(from_value, to_value);
                            trivial = false;
                        }
                    }
                }
            }
            if (trivial) {
                return null;  // nothing to interpolate
            }
            return function(lmd) {
                var mapping = {};
                for (var attr in map_interpolators) {
                    mapping[attr] = map_interpolators[attr](lmd);
                }
                return mapping;
            };
        };

        target.linear_numeric_interpolator = function(old_value, new_value) {
            ////c.l("interpolating number from ", old_value, " to ", new_value);
            return function(lmd) {
                if (lmd <= 0) {
                    return old_value;
                }
                if (lmd >= 1) {
                    return new_value;
                }
                return (1 - lmd) * old_value + lmd * new_value;
            };
        };

        target.switch_value_interpolator = function(old_value, new_value) {
            // punting on interpolation
            return function(lmd) {
                if (lmd < 0.5) {
                    return old_value;
                }
                return new_value;
            }
        };

        target.polygon_points_interpolator = function(old_points, new_points) {
            var points_interpolation = function (from_points, other_points) {
                var interval = other_points.length - 1;
                var my_interval = from_points.length - 1;
                // special cases
                if (interval < 1) {
                    return from_points;  // other list has one entry or none.
                }
                if (my_interval < 0) {
                    // no points to interpolate -- just use the other points (???)
                    return other_points;
                }
                if (my_interval == 0) {
                    // one entry: repeat it to match other points
                    return other_points.map(_ => from_points[0]);
                }
                var result = [];
                var my_cursor = 0;
                var other_cursor = 0;
                var last_point = null;
                var last_cursor = null;
                for (var index=0; index<from_points.length; index++) {
                    var this_point = from_points[index];
                    while ((last_point) && (other_cursor < my_cursor)) {
                        // add an interpolation point
                        var lambda = (other_cursor - last_cursor) * (1.0 / interval);
                        var xi = lambda * this_point[0] + (1 - lambda) * last_point[0];
                        var yi = lambda * this_point[1] + (1 - lambda) * last_point[1];
                        result.push([xi, yi])
                        other_cursor += my_interval;
                    }
                    // don't add an interpolation point at matching position.
                    if (other_cursor == my_cursor) {
                        other_cursor += my_interval;
                    }
                    result.push(this_point);
                    last_point = this_point;
                    last_cursor = my_cursor;
                    my_cursor = my_cursor + interval;
                }
                return result;
            };
            var old_int = points_interpolation(old_points, new_points);
            var new_int = points_interpolation(new_points, old_points);
            if (old_int.length != new_int.length) {
                throw new Error("point interpolation sanity check failed.");
            }
            var interpolator = function (lmd) {
                if (lmd <= 0) {
                    return old_points;
                }
                if (lmd >= 1) {
                    return new_points;
                }
                var result = []
                for (var i=0; i<new_int.length; i++) {
                    var new_p = new_int[i];
                    var old_p = old_int[i];
                    var xi = (new_p[0] * lmd) + (old_p[0] * (1 - lmd));
                    var yi = (new_p[1] * lmd) + (old_p[1] * (1 - lmd));
                    result.push([xi, yi]);
                }
                return result;
            };
            // for test and debug
            interpolator.old_int = old_int;
            interpolator.new_int = new_int;
            return interpolator;
        };

        target.color_interpolator = function(old_string, new_string) {
            ////c.l("interpolating color from ", old_string, " to ", new_string)
            old_string = old_string || "black";
            // byte values for color strings
            var old_array = target.color_string_to_array(old_string);
            var new_array = target.color_string_to_array(new_string);
            return function(lmd) {
                if (lmd <= 0) {
                    return old_string;
                }
                if (lmd >= 1) {
                    return new_string;
                }
                var mixed = [];
                for (var i=0; i<new_array.length; i++) {
                    mixed.push((1 - lmd) * old_array[i] + lmd * new_array[i]);
                }
                // round to integers
                ////c.l("interpolating " + old_string + " " + old_array + " " + new_string + " " + new_array, " at " + lmd);
                ////c.l("mixed before " + mixed);
                var alpha = mixed[3];
                mixed = mixed.map(x => Math.round(x));
                ////c.l("mixed after " + mixed);
                // last entry should be in [0..1]
                mixed[3] = alpha/255.0;
                var result =  "rgba(" + mixed.join(",") + ")";
                ////c.l("result=" + result);
                return result;
            }
        }

        target.canvas_2d_widget_helper.add_vector_ops(target);
        target.dual_canvas_helper.add_geometry_logic(target);
        target.reset_canvas();

        return target;
    };

    $.fn.dual_canvas_helper.json_attributes = {
        rect: ("close color dx dy degrees fill h w x y lineWidth").split(" "),
        frame_rect: ("close color dx dy degrees fill h w x y lineWidth").split(" "),
        circle: ("arc color fill start x y r lineWidth").split(" "),
        frame_circle: ("arc color fill start x y r lineWidth").split(" "),
        line: ("color x1 y1 x2 y2 lineWidth").split(" "),
        text: ("align background color font text valign x y").split(" "),
        named_image: ("image_name h w x y degrees sx sy sWidth sHeight dx dy").split(" "),
        polygon: ("close color cx cy dx dy degrees fill points lineWidth").split(" "),
    }

    $.fn.dual_canvas_helper.add_geometry_logic = function (target) {
        // shared functionality for frames and dual canvases

        target.has_object = function(object_info) {
            var index = object_info.object_index;
            if ((typeof index) == "number") {
                if (target.object_list[index] === object_info) {
                    return true;
                }
            }
            return false;   // default
        };

        target.detach_objects = function (owner) {
            // Remove cross references from object descriptions in owner object list to render object descriptions inactive.
            owner = owner || target;
            var object_list = owner.object_list;
            if (object_list) {
                for (var i=0; i<object_list.length; i++) {
                    var object_info = object_list[i];
                    if (object_info) {
                        // remove from named objects
                        var object_name = object_info.name;
                        if ((object_name) && (target.name_to_object_info[object_name])) {
                            delete target.name_to_object_info[object_name];
                        }
                        if ((object_name) && (target.active_transitions[object_name])) {
                            delete target.active_transitions[object_name];
                        }
                        object_info.object_index = null;
                        object_info.name = null;
                        if (object_info.is_frame) {
                            target.detach_objects(object_info);
                        }
                    }
                }
            }
        };

        target.json_serialize = function () {
            var result = target.local_json_data();
            var object_list = target.object_list;
            var objects_json = [];
            var json_attributes = $.fn.dual_canvas_helper.json_attributes;
            for (var i=0; i<object_list.length; i++) {
                var description = object_list[i];
                var object_json = {};
                var shape_name = description.shape_name;
                var atts = json_attributes[shape_name];
                if (shape_name == "frame") {
                    object_json = description.json_serialize();
                    objects_json.push(object_json);
                } else if ((shape_name) && (atts)) {
                    object_json.shape_name = shape_name;
                    object_json.hide = description.hide || false;
                    object_json.name = description.name || null;
                    if ((description.events) || (description.events===false)) {
                        object_json.events = description.events;
                    }
                    for (var j=0; j<atts.length; j++) {
                        var att = atts[j];
                        object_json[att] = description[att];  // xxxx undefines?
                    }
                    objects_json.push(object_json);
                } else {
                    console.warn("unknown shape name: " + shape_name);
                }
            }
            result.object_list = objects_json;
            return result;
        };

        target.deserialize_json_objects = function (object_list) {
            for (var i=0; i<object_list.length; i++) {
                var desc = object_list[i];
                var shape_name = desc.shape_name;
                if (shape_name == "frame") {
                    target.deserialize_frame(desc);
                } else {
                    var method = target[shape_name];
                    if (method) {
                        method(desc);
                    } else {
                        console.error("Unknown shape name: " + shape_name);
                    }
                }
            }
        }

        target.color_chooser = function(config, element) {
            var settings = $.extend({
                side: 200,
                x: 0,
                y: 0,
                font: "normal 10px Arial",
                callback: null,
                background: "cornsilk",
                outline: "black",
            }, config);
            element = element || target;

            // slots for chosen color
            element.chosen_color = null;
            element.chosen_color_array = null;

            const color_max = 255;
            // intensity is total of all colors
            const max_intensity = color_max * 3 + 15;
            var side = settings.side;
            var current_intensity = max_intensity;
        
            var right = side * 0.25;
            var left = side - right;
            var top = left;
            var bottom = right;
            
            var slider_height = 20;
            var column_width = 0.25;

            // Miscellaneous frame for positioning random elements
            var misc_frame = element.frame_region(
                settings.x, settings.y, settings.x + side, settings.y + side,
                -10, -10, side+20, side+20);

            // backgrounda and outline
            if (settings.background) {
                misc_frame.frame_rect({x: -5, y: -5, w: side+10, h: side+10, color:settings.background});
            }
            if (settings.outline) {
                misc_frame.frame_rect({x: -5, y: -5, w: side+10, h: side+10, color:settings.outline, fill:false});
            }
            
            // Intensity Frame: Adjusts the total color intensity level.
            var intensity_frame = element.frame_region(
                settings.x + left + 10, settings.y + 10, settings.x + side - 20, settings.y + side - 20, 
                0, 0, 1.0, max_intensity+slider_height);
            var gray_scale = function(intensity) {
                var third = Math.max(0, Math.min(color_max, intensity * 0.333));
                return element.array_to_color([third, third, third]);
            };
            // intensity indicator display
            for (var intensity=0; intensity<=max_intensity; intensity++) {
                intensity_frame.line({
                    x1: column_width,
                    y1: intensity,
                    x2: 2 * column_width,
                    y2: intensity,
                    color: gray_scale(intensity)
                })
            }
            // sliding intensity selector
            var islider = intensity_frame.frame_rect({
                name: true,  // assign an unused name
                x: 0,
                y: current_intensity,
                w: column_width * 3,
                h: slider_height,
                color: gray_scale(current_intensity),
            });
            // sliding selector outline
            var ibox = intensity_frame.frame_rect({
                name: true,
                x: 0,
                y: current_intensity,
                w: column_width * 3,
                h: slider_height,
                fill: false,
                color: "black",
            });
            // invisible column receiving events
            var icolumn = intensity_frame.frame_rect({
                name: true,
                color: "rgba(0,0,0,0)",  // invisible
                x: 0,
                y: 0,
                w: column_width * 3,
                h: max_intensity,
            });
            // When the mouse is over the invisible column, adjust the intensity level.
            var intensity_mouse_over = function(event) {
                var frame_location = intensity_frame.event_model_location(event);
                var intensity = Math.round(frame_location.y);
                intensity = Math.min(Math.max(0, intensity), max_intensity);
                ibox.change({y:intensity});
                islider.change({y:intensity, color:gray_scale(intensity)});
                current_intensity = intensity;
                draw_triangle_frame();
            }
            icolumn.on("mousemove", intensity_mouse_over);
            
            // Relative color computed at current intensity level.
            var color_array_at = function(r, g) {
                if ((r < 0) || (g < 0) || (r + g > 1.0)) {
                    return null;  // Out of bounds: no color.
                }
                var b = 1 - r - g;
                var sr = Math.round(Math.min(255, current_intensity * r));
                var sg = Math.round(Math.min(255, current_intensity * g));
                var sb = Math.round(Math.min(255, current_intensity * b));
                //return element.array_to_color([sr, sg, sb]);
                return [sr, sg, sb];
            };
            
            // Triangle Frame: Adjust current color choice at current intensity level.
            // X and Y range from [0..1, 0..1] mapping into [0..left, bottom..top]
            var triangle_frame = element.vector_frame(
                {x:left, y:0},
                {x:left*0.5, y:top-20},  // Y axis is slanted to the right.
                {x:settings.x+10, y:bottom + settings.y+10}
            );
            var draw_triangle_frame = function() {
                triangle_frame.reset_frame();   // remove any existing content.
                // draw colors as circles
                var delta = 0.02
                var radius = top * delta;
                for (var r=0; r<=1; r+=delta) {
                    for (var g=0; g<=1 - r; g+=delta) {
                        var color_array = color_array_at(r, g);
                        if (color_array) {
                            var color = element.array_to_color(color_array);
                            // Draw circle with radius adjusted to the triangle_frame.
                            triangle_frame.frame_circle({x:r, y:g, color:color, r:delta});
                        }
                    }
                }
                // mouse tracker circle (initially hidden)
                var color_track = triangle_frame.circle({
                    name: true, fill: false, r:radius*3,
                    x:0, y:0, color:"black", hide:true});
                    
                // When the mouse is over the color triangle, preview that color.
                var color_mouse = function(event) {
                    var frame_location = triangle_frame.event_model_location(event);
                    var r = frame_location.x;
                    var g = frame_location.y;
                    var color_array = color_array_at(r, g);
                    if (color_array) {
                        var color = element.array_to_color(color_array);
                        color_track.change({x:r, y:g, hide:false});
                        preview.change({color: color})
                        rgb.change({text: color})
                        // If the event is a click, then select the color as final.
                        if (event.type == "click") {
                            // Color selected!
                            color_choice.change({hide: false, text: color});
                            final_color.change({hide: false, color: color});
                            element.chosen_color = color;
                            element.chosen_color_array = color_array;
                            if (settings.callback) {
                                settings.callback(color_array, color);
                            }
                        }
                    } else {
                        color_track.change({hide:true});
                    }
                }
                // invisible triangle covering the color area to receive events
                var color_choices = triangle_frame.polygon({
                    points: [[0,0], [0,1], [1,0]],
                    name: true,
                    color: "rgba(0,0,0,0)",
                });
                color_choices.on("mousemove", color_mouse);
                color_choices.on("click", color_mouse);
            };
            draw_triangle_frame();
            
            // Preview swatch circle.
            var swatch_offset = bottom * 0.5;
            var preview = misc_frame.circle({name: true, x:swatch_offset, y:side-swatch_offset,
                r: swatch_offset, color: "white"})
            // Outline for preview swatch.
            misc_frame.circle({fill:false, x:swatch_offset, y:side-swatch_offset,
                r: swatch_offset, color: "black"})
            // Text representation of color over the preview swatch.
            var rgb = misc_frame.text({name: true, x:swatch_offset, y:side-swatch_offset,
                font:settings.font, text:" ", valign:"center", align:"center",
                background: "white"});
                
            // Final color selection rectangle.
            var final_color = misc_frame.rect({name: true, hide:true,
                x:10, y:10, w:left-20, h: bottom*0.6
            });
            // Final color selection text representaiton.
            var color_choice = misc_frame.text({name: true, x:10+(left-20)*0.5, y:bottom*0.3+10, 
                text: "click to select color", font: settings.font,
                align: "center", valign: "center", background: "white"})
            element.reset_color_choice = function () {
                color_choice.change({hide: true});
                final_color.change({hide: true});
                element.chosen_color = null;
                element.chosen_color_array = null;
            }
        };
        
        target.right_axis = function(config) {
            return target.bottom_axis(config, {x: 1, y: 0}, {x: 0, y: 1}, 0, "y")
        };

        target.left_axis = function(config) {
            return target.bottom_axis(config, {x: -1, y: 0}, {x: 0, y: 1}, 0, "y", "right")
        };

        target.top_axis = function(config) {
            return target.bottom_axis(config, {x: 0, y: 1}, {x: 1, y: 0}, 90, "x")
        };

        target.lower_left_axes = function(config) {
            var stats = target.active_region(true); 
            var params = $.extend({
                add_end_points: true,
                skip_anchor: true,
            }, stats, config);
            // choose anchors
            var choose_anchor = function (min_value, max_value, anchor_parameter) {
                // use the parameter if it is given as a number
                if ((typeof anchor_parameter) == "number") {
                    return anchor_parameter;
                }
                // prefer 0 if possible
                var result = 0;
                if ((min_value > result) || (max_value < result)) {
                    // choose an anchor in the center of appropriate tick choices
                    var choices = target.axis_ticklist(min_value, max_value, 10);
                    //var index = Math.floor(0.5 * choices.length);
                    //result = choices[index];
                    result = choices[0];
                }
                return result;
            };
            var x_anchor = choose_anchor(params.min_x, params.max_x, params.x_anchor);
            var y_anchor = choose_anchor(params.min_y, params.max_y, params.y_anchor);
            var bottom_config = $.extend({
                anchor: x_anchor,
                axis_origin: {x: 0, y: y_anchor},
                //axis_origin: {x: 0, y: params.min_y},
                skip_anchor: true,
                min_value: params.min_x,
                max_value: params.max_x
            }, params);
            var bottom_ticks = target.bottom_axis(bottom_config);
            var left_config = $.extend({
                anchor: y_anchor,
                axis_origin: {x: x_anchor, y:0},
                //axis_origin: {x: params.min_x, y:0},
                skip_anchor: true,
                min_value: params.min_y,
                max_value: params.max_y,
            }, params);
            var left_ticks = target.left_axis(left_config);
            return {bottom: bottom_ticks, left: left_ticks};
        }

        target.bottom_axis = function(config, tick_direction, offset_direction, degrees, coordinate, align) {
            // simplified interface
            var params = $.extend({
                min_value: null,
                max_value: null,
                max_tick_count: 10,
                anchor: null,
                skip_anchor: false,
                add_end_points: false,
            }, config);
            coordinate = coordinate || "x";
            var other_coord = "y";
            if (coordinate == "y") {
                other_coord = "x";
            }
            params.tick_direction = tick_direction || {x: 0, y: -1};
            params.offset_vector = offset_direction || {x: 1, y: 0};
            var numeric_default = function(value, default_value) {
                if ((typeof value) == "number") {
                    return value;
                }
                return default_value;
            }
            //degrees = degrees || -90;
            degrees = numeric_default(degrees, -90);
            params.tick_text_config = $.extend({
                degrees: degrees,
                align: align
            }, params.tick_text_config)
            var stats = target.active_region(true);   // drawn region or model view box
            var min_value = numeric_default(params.min_value, stats["min_" + coordinate]);
            var max_value = numeric_default(params.max_value, stats["max_" + coordinate]);
            if (!params.ticks) {
                // infer ticks from limits
                params.ticks = target.axis_ticklist(min_value, max_value, params.max_tick_count, params.anchor);
                //params.ticks = ticklist.map(x => {offset: x});
            }
            // convert numeric ticks to mappings
            params.ticks = params.ticks.map(
                function (x) {
                    if ((typeof x) == "number") {
                        return {offset: x};
                    } else {
                        return x;
                    }
                }
            )
            // if add_end_points is specified then include unlabelled end markers if absent
            if (params.add_end_points) {
                if (min_value < params.ticks[0].offset) {
                    var min_tick = {offset: min_value, text: " "};
                    params.ticks.unshift(min_tick);
                }
                if (max_value > params.ticks[params.ticks.length-1].offset) {
                    var max_tick = {offset: max_value, text: " "};
                    params.ticks.push(max_tick);
                }
            }
            if (!params.axis_origin) {
                params.axis_origin = {x: 0, y: 0};
                var other_min = stats["min_" + other_coord];
                var other_max = stats["max_" + other_coord];
                if ((other_min > 0) || (other_max < 0)) {
                    params[other_coord] = 0.5 * (other_min + other_max);
                }
            }
            if ((params.skip_anchor) && (!params.tick_transform) && (params.anchor!=null)) {
                // For double axes skip the label at the origin crossing point.
                params.tick_transform = function(tick) {
                    if (tick.offset == params.anchor) {
                        //return null;  // skip the anchor label and tick mark.
                        return {offset: tick.offset, text: " "}
                    }
                    return tick;
                }
            }
            return target.axis(params);
        };

        target.axis = function(config) {
            // Draw an axis
            var default_tick_format = function(tick) {
                if ((typeof tick.text) != "undefined") {
                    return "" + tick.text;
                }
                var offset = tick.offset;
                var result = "" + offset;
                if (offset != parseInt(offset, 10)) {
                    if (result.length > 6) {
                        result = offset.toPrecision(4);
                    }
                }
                return result;
            }
            var params = $.extend({
                name_prefix: null,
                tick_format: default_tick_format,
                tick_length: 10, // intended in pixels
                label_offset: 15, // intended in pixels
                tick_line_config: {},
                tick_text_config: {},
                tick_direction: {x: 1, y: 0},
                offset_vector: {x: 0, y: 1},
                axis_origin: {x: 0, y: 0},
                connecting_line_config: {},  // connecting line omitted if null config
                // for example purposes only
                ticks: [
                    {offset: 0, text: "0.0", name: "Zero"},
                    {offset: 10, text: "ten", name: "Ten"},
                    {offset: 15, text: "15.0", name: "fifteen"},
                ],
                tick_transform: function(x) { return x; },
            }, config);
            var ticks = params.ticks;
            var max_tick = null;
            var min_tick = null;
            // find the scale factor for convering tick direction vector to pixels
            var tick_direction_length = target.vlength(
                target.vadd(
                    target.converted_location(params.tick_direction.x, params.tick_direction.y),
                    target.vscale(-1, target.converted_location(0, 0))
                )
            );
            var tick_model_conversion = 1.0 / tick_direction_length;
            var tick_shift = target.vscale(params.tick_length * tick_model_conversion, params.tick_direction);
            var label_shift = target.vscale(params.label_offset * tick_model_conversion, params.tick_direction);
            // draw the tick marks and text.
            var transformed_ticks = [];
            for (var i=0; i<ticks.length; i++) {
                var line = $.extend({}, params.tick_line_config);
                var tick = params.tick_transform(ticks[i]);
                if (tick == null) {
                    // transformed to "ignore"
                    continue;
                }
                // automatically convert numbers to default mapping
                if ((typeof tick) == "number") {
                    tick = {offset: tick};
                } else {
                    var tick = $.extend({}, tick);  // fresh copy
                }
                tick.origin = target.vadd(
                    params.axis_origin,
                    target.vscale(tick.offset, params.offset_vector)
                );
                tick.start = target.vadd(
                    tick.origin,
                    target.vscale(-1, tick_shift)
                );
                tick.end = target.vadd(
                    tick.origin,
                    tick_shift
                );
                line.x1 = tick.start.x; line.y1 = tick.start.y;
                line.x2 = tick.end.x; line.y2 = tick.end.y;
                // draw the line mark
                target.line(line);
                // set up text values
                var label = $.extend({}, params.tick_text_config);
                label = $.extend(label, tick);
                if (!label.text) {
                    label.text = params.tick_format(label);
                }
                if (!label.name) {
                    if (params.name_prefix) {
                        label.name = params.name_prefix + label.text;
                    }
                }
                label.valign = "center";
                label.offset = target.vadd(
                    tick.origin,
                    label_shift
                )
                label.x = label.offset.x;
                label.y = label.offset.y;
                label.valign = "center";
                // draw the text label.
                target.text(label);
                // bookkeeping
                if ((!max_tick) || (max_tick.offset < tick.offset)) {
                    max_tick = tick;
                }
                if ((!min_tick) || (min_tick.offset > tick.offset)) {
                    min_tick = tick;
                }
                transformed_ticks[i] = tick;
            }
            // draw the connector if configured
            if ((min_tick) && (params.connecting_line_config)) {
                var connecting_line = $.extend({}, params.tick_line_config, params.connecting_line_config);
                connecting_line.x1 = min_tick.origin.x;
                connecting_line.y1 = min_tick.origin.y;
                connecting_line.x2 = max_tick.origin.x;
                connecting_line.y2 = max_tick.origin.y;
                target.line(connecting_line);
            }
            return transformed_ticks;
        };

        target.axis_ticklist = function(min_offset, max_offset, maxlen, anchor) {
            maxlen = maxlen || 10;
            if (min_offset >= max_offset) {
                throw new Error("bad offsets");
            }
            var anchor_provided = ((typeof anchor) == "number")
            if ((anchor_provided) && ((anchor < min_offset) || (anchor > max_offset))) {
                throw new Error("bad anchor");
            }
            var diff = max_offset - min_offset;
            var tick_length = 1.0;
            var scale = 1.0;
            // adjust tick length down
            while ((diff / tick_length) < maxlen) {
                tick_length = tick_length * 0.1;
                scale = scale * 10;
            }
            // scale tick length up
            while ((diff / tick_length) >= maxlen) {
                tick_length = tick_length * 10;
                scale = scale * 0.1;
            }
            // fix numerical drift
            if (scale >= 1) {
                scale = Math.round(scale);
                tick_length = 1.0/scale;
            } else {
                tick_length = Math.round(tick_length);
                scale = 1.0/tick_length;
            }
            // increase the number of ticks if possible 5x, 4x, or 2x
            var tick5 = tick_length / 5.0;
            if (diff / tick5 <= maxlen) {
                tick_length = tick5;
                scale = scale * 5;
            } else {
                var tick4 = tick_length / 4.0;
                if (diff / tick4 <= maxlen) {
                    tick_length = tick4;
                    scale = scale * 4;
                } else {
                    var tick2 = tick_length / 2.0;
                    if (diff / tick2 <= maxlen) {
                        tick_length = tick2;
                        scale = scale * 2;
                    }
                }
            }
            // pick an anchor if not provided
            var smin = min_offset * scale;
            var smax = max_offset * scale;
            if (!anchor_provided) {
                var M = Math.floor((smin + smax) * 0.5);
                anchor = M / scale;
            }
            // generate the list
            var result = [anchor];
            while ((result[0] - tick_length) >= min_offset) {
                result.unshift((result[0] - tick_length))
            }
            var last = anchor;
            while ((last + tick_length) <= max_offset) {
                last = last + tick_length;
                result.push(last);
            }
            // clean the list -- try to eliminate float drift
            for (var i=0; i < result.length; i++) {
                var r = result[i];
                var rs = r * scale;
                var rrs = Math.round(rs);
                if (Math.abs(rrs - rs) < 0.01) {
                    r = rrs / scale;
                }
                result[i] = r
            }
            return result;
        }
    }

    $.fn.dual_canvas_helper.reference_frame = function(
        parent_canvas, 
        x_vector, 
        y_vector, 
        xy_offset,
        name,) 
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
        var frame = {
            parent_canvas: parent_canvas,
            x_vector: x_vector,
            y_vector: y_vector,
            xy_offset: xy_offset,
            name: name,
            is_frame: true,
            events: true,   // by default support events
            shape_name: "frame",
        };

        frame.duplicate = function () {
            // make a new frame with same geometry and same parent
            result = frame.parent_canvas.vector_frame(
                $.extend({}, frame.x_vector),
                $.extend({}, frame.y_vector),
                $.extend({}, frame.xy_offset)
            );
            if (frame.extrema) {
                result.extrema = frame.extrema;
            }
            return result;
        }

        frame.local_json_data = function () {
            // top level information for serialization
            var result = {};
            result.shape_name = frame.shape_name;
            result.y_vector = frame.y_vector;
            result.x_vector = frame.x_vector;
            result.xy_offset = frame.xy_offset;
            result.name = frame.name || null;
            result.hide = frame.hide || false;
            return result;
        }

        // (Re)set operations
        frame.set_rframe = function(scale_x, scale_y, translate_x, translate_y) {
            scale_x = scale_x || 1.0;
            scale_y = scale_y || 1.0;
            translate_x = translate_x || 0;
            translate_y = translate_y || 0;
            frame.x_vector = {x: scale_x, y:0};
            frame.y_vector = {x:0, y: scale_y};
            frame.xy_offset = {x: translate_x, y: translate_y};
        };

        frame.set_region = function(minx, miny, maxx, maxy, frame_minx, frame_miny, frame_maxx, frame_maxy) {
            // Convenience: map frame region into the canvas region
            var extrema = {
                minx: minx, miny: miny, maxx:maxx, maxy:maxy,
                frame_minx: frame_minx, frame_miny: frame_miny, 
                frame_maxx: frame_maxx, frame_maxy: frame_maxy,
            };
            frame.set_extrema(extrema);
        };

        frame.set_extrema = function(extrema) {
            // set or amend extrema
            var e = {};
            if (frame.extrema) {
                e = $.extend(e, frame.extrema);
            }
            e = $.extend(e, extrema);
            frame.extrema = e;
            var scale_x = (e.maxx - e.minx) * 1.0 / (e.frame_maxx - e.frame_minx);
            var scale_y = (e.maxy - e.miny) * 1.0 / (e.frame_maxy - e.frame_miny);
            var translate_x = e.minx - e.frame_minx * scale_x;
            var translate_y = e.miny - e.frame_miny * scale_y;
            return frame.set_rframe(scale_x, scale_y, translate_x, translate_y);
        };

        frame.event_region = function(existing_rectangle, name, color, extrema) {
            // return an "invisible" rectangle to capture events within the frame active region.
            // the rectangle will hide any previously drawn elements.
            var e = extrema || frame.extrema;
            if (!e) {
                throw new Error("event_region requires frame extrema to be specified.");
            }
            name = name || true;
            color = color || "rgba(0,0,0,0)";
            var options = {
                x: e.frame_minx,
                y: e.frame_miny,
                w: e.maxx - e.minx,
                h: e.maxy - e.miny,
            };
            // modify existing rectangle with possibley new geometry, preserving event bindings.
            if (existing_rectangle) {
                existing_rectangle.change(options);
                return existing_rectangle;
            } else {
                options.name = name;
                options.color = color;
                invisible = frame.rect(options);
                return invisible;
            }
        }

        frame.install_assembly = function(name, draw_on_target) {
            // attach assembly creator to frame as frame.name.
            frame.parent_canvas.install_assembly(
                name, draw_on_target, frame
            );
        };

        // Delegate appropriate methods to parent
        var delegate_to_parent = function(name) {
            frame[name] = frame.parent_canvas[name];
        };

        // delegate_to_parent("change"); -- change will apply to frame
        delegate_to_parent("define_assembly");
        delegate_to_parent("forget_objects");
        delegate_to_parent("set_visibilities");
        // delegate_to_parent("transition");  -- transition will apply to frame
        delegate_to_parent("name_image_url");
        delegate_to_parent("name_image_data");

        frame.forget = function () {
            frame.parent_canvas.forget_objects([frame]);
        };

        frame.active_region = function (default_to_view_box) {
            var pa = frame.parent_canvas.active_region(default_to_view_box);
            var ll = frame.model_location(pa.min_x, pa.min_y);
            var ul = frame.model_location(pa.min_x, pa.max_y);
            var lr = frame.model_location(pa.max_x, pa.min_y);
            var ur = frame.model_location(pa.max_x, pa.max_y);
            return {
                min_x: Math.min(ll.x, ul.x, lr.x, ur.x),
                max_x: Math.max(ll.x, ul.x, lr.x, ur.x),
                min_y: Math.min(ll.y, ul.y, lr.y, ur.y),
                max_y: Math.max(ll.y, ul.y, lr.y, ur.y),
            };
        }

        frame.reset_frame = function () {
            frame.parent_canvas.detach_objects(frame);
            frame.object_list = [];
            frame.parent_canvas.request_redraw();
        };

        frame.request_redraw = function () {
            frame.parent_canvas.request_redraw();
        }

        frame.redraw_frame = function () {
            if (frame.hide) {
                // don't redraw hidden frame
                return;
            }
            frame.object_list = frame.parent_canvas.objects_drawn(frame.object_list);
        };

        frame.is_empty = function () {
            return (frame.object_list.length == 0);
        };

        frame.clear_frame = function () {
            frame.parent_canvas.forget_object_descriptions(frame.object_list);
            frame.object_list = [];
        };

        frame.check_registration = function () {
            if (!frame.parent_canvas.has_object(frame)) {
                // restore the frame in place
                frame.parent_canvas.store_object_info(frame, null, true)
            }
        };

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

        frame.coordinate_conversion = function (position, attribute_name, coordinate_names) {
            var nc = frame.parent_canvas.no_change_conversion(position, attribute_name, coordinate_names);
            return frame.converted_location(nc.x, nc.y);
        };

        frame.model_location = function(mx, my) {
            // Convert "model" location to "frame" location.
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
        };

        frame.pixel_offset = function(frame_x, frame_y) {
            // return the offset from the canvas upper left corner in pixels
            // of the frame location.
            var c = frame.converted_location(frame_x, frame_y);
            return frame.parent_canvas.pixel_offset(c.x, c.y)
        };

        frame.event_model_location = function(e) {
            var parent_location = frame.parent_canvas.event_model_location(e);
            //return frame.converted_location(parent_location.x, parent_location.y);
            return frame.model_location(parent_location.x, parent_location.y);
        }

        var override_positions = function(shape_name) {
            // replace the shape factory:
            // override the location conversion parameter
            frame[shape_name] = function(opt, wait) {
                // Make sure the frame exists in parent.
                frame.check_registration();
                //var s = $.extend({
                //    coordinate_conversion: frame.coordinate_conversion,
                //    frame: frame,
                //}, opt);
                // modify options in place.
                var s = opt;
                s.coordinate_conversion = s.coordinate_conversion || frame.coordinate_conversion;
                s.frame = s.frame || frame;
                if (s.temporary) {
                    // short cut optimization, step around bookkeeping for temporary object.
                    return frame.parent_canvas.visible_canvas[shape_name](s);
                }
                var method = frame.parent_canvas[shape_name];
                return method(s, wait);
            }
        };

        for (var i=0; i<$.fn.dual_canvas_helper.draw_op_names.length; i++) {
            var name = $.fn.dual_canvas_helper.draw_op_names[i];
            override_positions(name);
        }

        // define axes w.r.t the frame
        parent_canvas.dual_canvas_helper.add_geometry_logic(frame);

        // calculation conveniences
        parent_canvas.canvas_2d_widget_helper.add_vector_ops(frame);

        frame.reset_frame();
        
        // Add the frame object to the parent canvas in place
        parent_canvas.store_object_info(frame, null, true);
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
            y_up: true,
        }
        element.dual_canvas_helper(config);
        element.polygon({
            name: "polly", 
            points: [[250,100], [400,100], [280,180], [375,60], [370,180]],
            color: "#ffd",
        });
        element.axis({
            name_prefix: "axis",
            axis_origin: {x: 155, y:30},
            tick_line_config: {lineWidth: 2, color: "green"},
            connecting_line_config: {lineWidth: 5, color: "blue"},
            tick_text_config: {color: "red"},
            ticks: [
                5,  //{offset: 5},
                25.5, // {offset: 25.5},
                58, // {offset: 58}
            ]
        });
        element.bottom_axis({axis_origin: {x: 0, y: 220},});
        element.top_axis({axis_origin: {x: 0, y: 120},});
        element.right_axis({axis_origin: {x: 220, y: 0},});
        element.left_axis({axis_origin: {x: 120, y: 0},});
        element.lower_left_axes({
            x_anchor: 300,
            y_anchor: 320,
            tick_line_config: {color: "green"},
            tick_text_config: {color: "blue"},
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
            element.change("green circle", {"x":loc.x, "y":loc.y});
            info.html(
                "<div> [" + Math.round(loc.x) + ", " + Math.round(loc.y) + "] :: [" 
                + Math.round(ploc.x) + ", " + Math.round(ploc.y) 
                + "] </div>")
            // change automatically schedules a redraw
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

    $.fn.dual_canvas_helper.lasso_example = function(element) {

        element.empty();
        element.css("background-color", "cornsilk").width("520px");
        var config = {
            width: 400,
            height: 400,
            y_up: true,
        }
        element.dual_canvas_helper(config);
        for (var i=20; i<400; i+=20) {
            for (var j=20; j<400; j+=20) {
                element.circle({name: ""+i+":"+j, x:i, y:j, r:4, color:"green"});
            }
        }
        //element.rect({name: "binky", x:-10, y:-10, h:500, w:500, color: "blue"})
        var lasso_callback = function(names_mapping) {
            for (var name in names_mapping) {
                element.change(name, {color: "pink"});
            }
        };
        // lasso and delete the lasso polygon afterward
        var delete_it=true;
        element.do_lasso(lasso_callback, {}, delete_it);
        $("<div>Please lasso some circles once to turn them pink.</div>").appendTo(element);
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
        var ic = backward.model_location(c.x, c.y);
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
                var ic = frame.model_location(c.x, c.y);
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
