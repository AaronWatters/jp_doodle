/*

JQuery plugin helper for drawing pseudo-3d bar charts

Assumes the element has been initialized using dual_canvas_helper.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/

(function($) {

    $.fn.rectangle_collection = function (options) {
        var target = this;
        var settings = $.extend({
            u: {x:-1, y:0},
            v: {x:0.8, y:0.3},
            x: 0,
            y: 0,
            width_fraction: 0.75,
            u_label: "horizontal",
            v_label: "depth",
            max_rgb: {r: 255, g: 0, b:0},
            min_rgb: {r: 0, g:255, b: 255},
            transparency: 0.7,
            name_separator: "|",
            labels_scale: 30,
            fit: true,
            dialog_dw: 0.4,
            dialog_dh: 0.2,
            dtext: 0.03,
            max_width: 50,
            max_depth: 200,
            max_vertical: 200,
        }, options);
        for (var key in settings) {
            target["bar_" + key] = settings[key];
        }

        // build some data structures.
        var make_index = function(list) {
            result = {};
            for (var i=0; i<list.length; i++) {
                result[list[i]] = i;
            }
            return result;
        };

        // utility calculations
        var vscale = function(scalar, vector) {
            result = {};
            for (slot in vector){
                result[slot] = vector[slot] * scalar;
            }
            return result;
        };
        var vadd = function(v1, v2) {
            result = {};
            for (slot in v1){
                result[slot] = v1[slot] + v2[slot];
            }
            return result;
        };
        var vint = function(vector) {
            result = {};
            for (slot in vector){
                result[slot] = Math.floor(vector[slot]);
            }
            return result;
        };
        target.interpolate_color = function(lmbda) {
            lmbda = lmbda % 1.0;
            vcolor = vint(vadd(vscale(lmbda, target.bar_max_rgb), vscale(1.0-lmbda, target.bar_min_rgb)));
            return "rgba(" + vcolor.r + "," + vcolor.g + "," + vcolor.b + "," + target.bar_transparency + ")";
        }
        target.segment_offset = function(direction, count, fraction, maximum) {
            var factor = maximum * 1.0 / count;
            var offset = vscale(factor, direction);
            var width = fraction * factor;
            return {factor: factor, width: width, offset: offset};
        }

        target.focus_anchors = function(u_anchor, v_anchor) {
            // focus on anchors or defocus if both null.
            var bars = target.bars;
            for (var i=0; i<bars.length; i++) {
                var bar = bars[i];
                if ((bar.u_anchor == u_anchor) || (bar.v_anchor == v_anchor)
                     || ((!u_anchor) && (!v_anchor))) {
                    // make it visible
                    //target.set_visibilities([bar.name], true);
                    if (!bar.visible) {
                        target.transition(bar.name, {color: bar.color, h: bar.h});
                    }
                    bar.visible = true;
                } else {
                    // hide it
                    //target.set_visibilities([bar.name], false);
                    if (bar.visible) {
                        target.transition(bar.name, {color: "rgba(0,0,0,0)", h: 0});
                    }
                    bar.visible = false;
                }
            }
            if (target.u_selected) {
                target.change_element(target.u_selected + "_u_label", {color: "black"});
            }
            if (target.v_selected) {
                target.change_element(target.v_selected + "_v_label", {color: "black"});
            }
            if (u_anchor) {
                target.change_element(u_anchor + "_u_label", {color: "red"});
            }
            if (v_anchor) {
                target.change_element(v_anchor + "_v_label", {color: "red"});
            }
            target.u_selected = u_anchor;
            target.v_selected = v_anchor;
        };

        target.draw_bars = function(no_redraw) {
            if (!target.reset_canvas) {
                throw new Error("rectangle_collection requires target configured by dual_canvas_helper");
            }
            // get canvas stats before resetting the canvas and clearing the stats
            var stats = target.visible_canvas.canvas_stats;
            // reset the canvas and keep statistics.
            target.reset_canvas(true);
            target.u_index = make_index(target.bar_u_anchors);
            target.v_index = make_index(target.bar_v_anchors);
            var extent = target.bar_max_vertical;
            //var no_redraw;
            if ((stats) && (stats.count)) {
                no_redraw = true;
                var extent = Math.max((stats.max_y - stats.min_y), (stats.max_x - stats.min_x));
            }
            target.text_size = Math.ceil(extent/40.0);
            target.font = "normal " + target.text_size + "px Arial";

            // copy and extend the bars
            var bars = [];
            var original_bars = target.bar_bars;
            var heights = [];
            for (var i=0; i<original_bars.length; i++) {
                var bar = $.extend({}, original_bars[i]);
                heights.push(bar.height);
                bar.u_index = target.u_index[bar.u_anchor];
                bar.v_index = target.v_index[bar.v_anchor];
                bars.push(bar);
            }
            target.bars = bars;
            target.minheight = Math.min(...heights);
            target.maxheight = Math.max(...heights);
            target.u_selected = null;
            target.v_selected = null;
            //var bars = target.bars;
            var separator = target.bar_name_separator;
            var fraction = target.bar_width_fraction;
            var u = target.bar_u;
            var v = target.bar_v;
            var x = target.bar_x;
            var y = target.bar_y;
            var u_offset = target.segment_offset(u, target.bar_u_anchors.length, fraction, target.bar_max_width);
            var du = u_offset.offset;
            var width = u_offset.width;
            var dv = target.segment_offset(v, target.bar_v_anchors.length, fraction, target.bar_max_depth).offset;
            var interval = target.maxheight - target.minheight;
            var max_vertical = target.bar_max_vertical;
            var height_factor = max_vertical * 1.0 / interval;
            for (var i=0; i<bars.length; i++) {
                var bar = bars[i];
                var position = vadd(vscale(bar.u_index, du), vscale(bar.v_index, dv));
                bar.name = bar.u_anchor + separator + bar.v_anchor;
                bar.x = position.x + x;
                bar.y = position.y + y;
                bar.w = width;
                bar.h = bar.height * height_factor;
                bar.color = target.interpolate_color(bar.height / interval);
            }
            // sort the larger indices earlier
            bars.sort(function(bar_a, bar_b) {
                var diff = (bar_b.v_index - bar_a.v_index);
                if (diff) {
                    return diff;
                } else {
                    return bar_b.u_index - bar_a.u_index;
                }
            });
            var mouseenter_handler = function (e) {
                var u_anchor = null;
                var v_anchor = null;
                var info = e.object_info;
                if (info) {
                    u_anchor = info.u_anchor;
                    v_anchor = info.v_anchor;
                }
                target.focus_anchors(u_anchor, v_anchor);
                if (u_anchor && v_anchor) {
                    put_dialog(e);
                }
            }
            var mouseleave_handler = function (e) {
                target.focus_anchors(null, null);
                hide_dialog(e);
            };
            var u_anchors = target.bar_u_anchors;
            var v_anchors = target.bar_v_anchors;
            // position the u labels rotated
            var v_offset = vscale(v_anchors.length-1, dv);
            for (var i=0; i<u_anchors.length; i++) {
                let u_anchor = u_anchors[i];
                let position = vscale(i, du);
                let position_end = vadd(v_offset, position);
                target.line({
                    x1: position.x + x, y1: position.y + y,
                    x2: position_end.x + x, y2: position_end.y + y,
                    color: "#999"
                })
                var name = u_anchor + "_u_label";
                var text_info = {
                    name: name, 
                    font: target.font,
                    text: u_anchor, u_anchor: u_anchor,
                    x: position.x + x, y: position.y + y - 0.5 * width, degrees: -90, color:"black"}
                target.text(text_info);
                target.on_canvas_event("mouseover", mouseenter_handler, name);
                target.on_canvas_event("mouseout", mouseleave_handler, name);
            }
            // position the v labels unrotated
            var u_offset = vscale(u_anchors.length-1, du);
            for (var i=0; i<v_anchors.length; i++) {
                let v_anchor = v_anchors[i];
                let position = vscale(i, dv);
                let position_end = vadd(u_offset, position);
                target.line({
                    x1: position.x + x, y1: position.y + y,
                    x2: position_end.x + x, y2: position_end.y + y,
                    color: "#999"
                })
                // debug mark
                //target.circle({x: position.x+x, y:position.y+y, r: width*0.2, color:"red"});
                var name = v_anchor + "_v_label";
                var align = "left";
                var text_x = position.x + x;
                var x_shift = 1.5 * width
                var text_y = position.y + y;
                // flip orientation if needed
                if (v.x < 0) {
                    align = "right";
                    x_shift = -x_shift;
                }
                if (v.x * u.x > 0) {
                    // text at end
                    text_x = position_end.x + x;
                    text_y = position_end.y + y;
                }
                var text_info = {
                    name: name,
                    text: v_anchor, v_anchor: v_anchor,
                    font: target.font,
                    x: text_x + x_shift, y: text_y, align: align, color:"black"}
                target.text(text_info)
                target.on_canvas_event("mouseover", mouseenter_handler, name);
                target.on_canvas_event("mouseout", mouseleave_handler, name);
            }

            // draw the bars
            for (var i=0; i<bars.length; i++) {
                let bar = bars[i];
                bar.fill = true;
                bar.visible = true;
                target.rect(bar);
                target.on_canvas_event("mouseover", mouseenter_handler, bar.name);
                target.on_canvas_event("mouseout", mouseleave_handler, bar.name);
                // outline it
                let outline = $.extend({}, bar)
                outline.name = null;
                outline.color = "rgba(0,0,0,0.2)"; // "black"
                outline.fill = false;
                target.rect(outline);
            } 
            // add labelling if labels_position is provided
            var labels_position = target.bar_labels_position;
            if (labels_position) {
                var labels_scale = target.bar_labels_scale;
                var set_label = function (vec, name, text) {
                    label_xy = vadd(vscale(labels_scale, vec), labels_position);
                    target.line({
                        x1: labels_position.x, y1: labels_position.y,
                        x2: label_xy.x, y2: label_xy.y,
                        color: "black",
                    });
                    var align = "left";
                    if (vec.x < 0) { align = "right"; }
                    target.text({
                        name: name,
                        text: text,
                        font: target.font,
                        x: label_xy.x,
                        y: label_xy.y,
                        color: "black",
                        align: align,
                    })
                    var move_label = function(event) {
                        var loc = target.event_model_location(event);
                        target.change_element(name, {"x":loc.x, "y":loc.y});
                        var new_vec = vscale(
                            1.0 / labels_scale,
                            vadd(
                                {x: loc.x, y: loc.y},
                                vscale(-1, labels_position)
                            )
                        );
                        // modify vec in place
                        $.extend(vec, new_vec);
                        // redraw
                        target.draw_bars();
                        add_label_moving_events();
                    };
                    var drop_label = function(event) {
                        target.bar_fit = true;
                        target.off_canvas_event("mousemove");
                        target.off_canvas_event("click");
                        target.on_canvas_event("click", pick_up_label, name);
                        target.draw_bars();
                    };
                    var pick_up_label = function(event) {
                        target.bar_fit = false;
                        add_label_moving_events();
                    };
                    var add_label_moving_events = function() {
                        target.off_canvas_event("click", name);
                        target.on_canvas_event("mousemove", move_label)
                        target.on_canvas_event("click", drop_label)
                    };
                    var redden = function(event) {
                        target.change_element(name, {color: "red"});
                    };
                    var blacken = function(event) {
                        target.change_element(name, {color: "black"});
                    };
                    target.on_canvas_event("click", pick_up_label, name);
                    target.on_canvas_event("mouseover", redden, name);
                    target.on_canvas_event("mouseout", blacken, name);
                };
                set_label(u, "u_label", target.bar_u_label);
                set_label(v, "v_label", target.bar_v_label);
            }
            // click background for a defocus
            target.on_canvas_event("click", function() {target.focus_anchors();});
            if (target.bar_fit) {
                target.fit(null, target.bar_max_vertical/10.0);
            }

            // mouse over dialog
            var mouse_over_info = {
                name: "dialog",
                x: 0, y: 0, hide: true,
                w: target.bar_dialog_dw * extent,
                h: target.bar_dialog_dh * extent,
                color: "rgba(200, 200, 200, 0.7)"
            };
            target.rect(mouse_over_info);
            target.text({
                name: "dialog_u",
                font: target.font,
                x: 0, y: 0, hide: true,
                color: "black"
            });
            target.text({
                name: "dialog_v",
                font: target.font,
                x: 0, y: 0, hide: true,
                color: "black"
            });
            target.text({
                name: "dialog_h",
                font: target.font,
                x: 0, y: 0, hide: true,
                color: "black"
            });
            var put_dialog = function(event) {
                target.bar_fit = false;
                var bar_info = event.object_info;
                var loc = target.event_model_location(event);
                var shift = extent * target.bar_dialog_dh * 0.25;
                target.change_element("dialog", {
                    hide: false,
                    x: loc.x + shift,
                    y: loc.y
                });
                target.change_element("dialog_u", {
                    hide: false,
                    x: loc.x + 2 * shift,
                    y: loc.y + 0.63 * mouse_over_info.h,
                    text: target.bar_u_label+": "+bar_info.u_anchor,
                    color: "black"
                });
                target.change_element("dialog_v", {
                    hide: false,
                    x: loc.x + 2 * shift,
                    y: loc.y + 0.38 * mouse_over_info.h,
                    text: target.bar_v_label+": "+bar_info.v_anchor,
                    color: "black"
                });
                var h_text = bar_info.height.toFixed(2)
                if (h_text.length > 7) {
                    h_text = bar_info.toExponential(2);
                }
                target.change_element("dialog_h", {
                    hide: false,
                    x: loc.x + 2 * shift,
                    y: loc.y + 0.13 * mouse_over_info.h,
                    text: h_text,
                    color: "black"
                });
            };
            var hide_dialog = function(event) {
                target.bar_fit = true;
                target.change_element("dialog", {hide: true});
                target.change_element("dialog_u", {hide: true});
                target.change_element("dialog_v", {hide: true});
                target.change_element("dialog_h", {hide: true});
            };
            // redraw if needed to get proper proportions
            if (!no_redraw) {
                target.draw_bars(true);  // don't redraw again
            }
        }; 
    };

    $.fn.rectangle_collection.example = function(element) {
        var bar_config = {
            u: {x:-1, y:0},
            v: {x:0.8, y:0.3},
            x: 20,
            y: 280,
            u_label: "person type",
            u_anchors: "men women children".split(" "),
            v_label: "State",
            v_anchors: "Pennsylvania New_Jersey New_York Delaware".split(" "),
            max_vertical: 200,
            max_depth: 200,
            max_width: 50,
            labels_position: {x: 150, y: 250},
        };
        var rectangles = [];
        for (var i=0; i<bar_config.u_anchors.length; i++) {
            u_anchor = bar_config.u_anchors[i];
            for (var j=0; j<bar_config.v_anchors.length; j++) {
                var v_anchor = bar_config.v_anchors[j];
                var height = (Math.sin(i+j)+1) * 50;
                var rectangle = {
                    u_anchor: u_anchor,
                    v_anchor: v_anchor,
                    height: height,
                }
                rectangles.push(rectangle);
            }
        }
        bar_config.bars = rectangles;
        element.empty();
        var canvas_config = {
            width: 600,
            height: 400,
            //translate_scale: {x: x, y:y, w:w, h:h},
        };
        element.dual_canvas_helper(canvas_config);
        element.rectangle_collection(bar_config);
        element.draw_bars();
    };

})(jQuery);
