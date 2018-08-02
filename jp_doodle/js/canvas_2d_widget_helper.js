/*

JQuery plugin helper for building widgets that use 2d canvas displays.
Append canvas element to jQuery container target and attach useful methods and slots to target.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/

(function($) {

    $.fn.canvas_2d_widget_helper = function (options) {
        var target = this;
        var settings = $.extend({
            // need to add stuff for coordinate conversion!
            width: 500,
            height: 500,
            lineWidth: 1,
            fillColor: "black",
            strokeStyle: "black",
            translate_scale: {x: 0.0, y:0.0, w:1.0, h:1.0},
            font: "normal 10px Arial",
            y_up: true,  // does y go up starting at the lower left corner? (default, yes.)
            style: "border:1px solid #d3d3d3;",
        }, options);

        for (var key in settings) {
            target["canvas_" + key] = settings[key];
        }

        target.reset_canvas = function () {
            target.empty();
            var w = target.canvas_width;
            var h = target.canvas_height;
            var st = target.canvas_style;
            target.canvas = $(`<canvas width="${w}px" height="${h}px" style="${st}"/>`);
            //target.canvas.width(target.canvas_width).height(target.canvas_height);
            target.canvas.appendTo(target);
            target.canvas_context = target.canvas[0].getContext("2d");
            var ctx = target.canvas_context;
            var ts = target.canvas_translate_scale;
            //ctx.translate(ts.x, ts.y);
            //ctx.scale(ts.w, ts.h);
            ts.model_height = h * 1.0 / ts.h;
            ts.model_intercept = - 2 * ts.y + ts.model_height;
            target.clear_canvas();
        };

        target.clear_canvas = function () {
            // https://stackoverflow.com/questions/2142535/how-to-clear-the-canvas-for-redrawing
            var canvas = target.canvas[0];
            var context = target.canvas_context;
            var ts = target.canvas_translate_scale;
            context.resetTransform();
            context.clearRect(0, 0, canvas.width, canvas.height)
            // first scale then translate
            context.scale(ts.w, ts.h);
            context.translate(ts.x, ts.y);
            if (target.canvas_stats) {
                target.canvas_stats = {};
            }
        };

        target.reset_canvas();

        // Some functions useful for Jupyter/proxy interface:
        /*
        target.canvas_call = function(method_name, args) {
            var context = target.canvas_context;
            var method = context[method_name];
            method.apply(context, context, args);
        };
        */

        // Set to mapping to collect stats
        target.canvas_stats = null;

        target.add_point_stats = function (x, y) {
            if (isNaN(x) || isNaN(y)) {
                throw new Error("cannot add point with NaN " + x + "," + y)
            }
            var stats = target.canvas_stats;
            if (stats) {
                if (stats.count) {
                    // add an additional point
                    stats.count += 1;
                    stats.min_x = Math.min(x, stats.min_x);
                    stats.max_x = Math.max(x, stats.max_x);
                    stats.min_y = Math.min(y, stats.min_y);
                    stats.max_y = Math.max(y, stats.max_y);
                } else {
                    // add the first point
                    stats.count = 1;
                    stats.min_x = x;
                    stats.max_x = x;
                    stats.min_y = y;
                    stats.max_y = y;
                }
            } else {
                return;   // do nothing -- could be an error?
            }
        }

        target.show_debug_bbox = function (save, color) {
            // show the current bounding box and reset stats
            if (!color) { color = "black"; }
            var stats = target.canvas_stats;
            if ((stats) && (stats.count)) {
                var mins = target.converted_location(stats.min_x, stats.min_y);
                var maxes = target.converted_location(stats.max_x, stats.max_y);
                var height = maxes.y - mins.y;
                var width = maxes.x - mins.x;
                var context = target.canvas_context;
                context.beginPath();
                context.rect(mins.x, mins.y, width, height);
                context.strokeStyle = color;
                context.stroke();
            }
            if ((!stats) || (!save)) {
                // reset the bbox stats
                target.canvas_stats = {};
            }
        }

        /*
        target.canvas_assign = function(slot_name, value) {
            target.canvas_context[slot_name] = value;
        };
        */

        var no_change_conversion = function (x, y) {
            // default frame conversion: no change
            return {x: x, y: y};
        }

        target.circle = function(opt) {
            // eg: element.circle({x: 140, y: 100, r: 10, color: "green"});
            var s = $.extend({
                color: target.canvas_fillColor,
                start: 0,
                arc: 2 * Math.PI,
                fill: true,  // if false then do a outline
                coordinate_conversion: no_change_conversion,
                frame: target,
                // lineWidth: 3,
            }, opt);
            var context = target.canvas_context;
            context.save(); 
            context.beginPath();
            //context.fillStyle = s.color;
            var fcenter = s.coordinate_conversion(s.x, s.y);
            var center = target.converted_location(fcenter.x, fcenter.y);
            // XXXX should also convert s.r?
            context.arc(center.x, center.y, s.r, s.start, s.arc);
            fill_or_stroke(context, s);
            context.restore(); 
            // update stats
            if (target.canvas_stats) {
                target.add_point_stats(fcenter.x + s.r, fcenter.y + s.r);
                target.add_point_stats(fcenter.x - s.r, fcenter.y - s.r);
            }
            return s;
        };

        target.line = function(opt) {
            // eg: element.line({name:"a line", x1:100, y1:100, x2:150, y2:130, color:"brown"});
            var s = $.extend({
                color: target.canvas_strokeStyle,
                lineWidth: target.canvas_lineWidth,
                coordinate_conversion: no_change_conversion,
                frame: target,
            }, opt);
            var context = target.canvas_context;
            context.beginPath();
            context.strokeStyle = s.color;
            context.lineWidth = s.lineWidth;
            var fp1 = s.coordinate_conversion(s.x1, s.y1);
            var fp2 = s.coordinate_conversion(s.x2, s.y2);
            var p1 = target.converted_location(fp1.x, fp1.y);
            var p2 = target.converted_location(fp2.x, fp2.y);
            context.moveTo(p1.x, p1.y);
            context.lineTo(p2.x, p2.y);
            context.stroke();
            // update stats
            if (target.canvas_stats) {
                target.add_point_stats(fp1.x, fp1.y);
                target.add_point_stats(fp2.x, fp2.y);
            }
            return s;
        };

        target.text = function(opt) {
            // eg: element.text({name:"some text", x:40, y:40, text:"text content"})
            var s = $.extend({
                font: target.canvas_font,
                color: target.canvas_fillColor,
                coordinate_conversion: no_change_conversion,
                frame: target,
            }, opt);
            var text = "" + s.text;  // coerce to string
            target.translate_and_rotate(s.x, s.y, s.degrees, s.coordinate_conversion);
            var context = target.canvas_context;
            // XXX maybe configure font using atts/style?
            context.font = s.font;
            context.fillStyle = s.color;
            var width = context.measureText(text).width;
            var dx = 0;
            var dy = 0;
            var rwidth = width;
            if ((s.align) && (s.align == "right")) {
                dx = - width;
                rwidth = - width;
            }
            if ((s.align) && (s.align == "center")) {
                dx = - width * 0.5;
                // XXXX this is wrong -- only half the text will respond to events.  Needs rework.
                rwidth = - width * 0.5;
            }
            var height = width * 1.4 / text.length;  // fudge...
            if (!target.canvas_y_up) {
                // text draws in negative y
                height = - height;
            }
            if ((s.valign) && (s.valign == "center")) {
                dy = - 0.5 * height;
                // XXXX event mask will not be positioned correctly at present
            }
            // draw the text
            if (target.canvas_y_up) {
                dy = - dy;
            }
            context.fillText(text, dx, dy); // translated to (x,y)
            // use a rectangle for masking operations
            s.draw_mask = function (to_canvas, info) {
                // XXXX need to add optional dx, dy to masking for alignments
                to_canvas.rect({x: info.x, y: info.y, w:rwidth, h:height, degrees:info.degrees, color:info.color})
            }
            // update stats
            if (target.canvas_stats) {
                // XXXX rectange stats may not currently correctly reflect alignments.
                target.rectangle_stats(s.x, s.y, rwidth, height, s.degrees, s.coordinate_conversion);
            }
            context.restore();  // matches translate_and_rotate
            return s;
        };

        target.rectangle_stats = function(x, y, w, h, degrees, coordinate_conversion) {
            var radians = 0.0;
            if (degrees) {
                radians = degrees * Math.PI / 180.0;
            }
            var cvt = coordinate_conversion(x, y);
            var c = Math.cos(radians);
            var s = Math.sin(radians);
            var add_offset = function (dx, dy) {
                var x1 = cvt.x + (dx * c - dy * s);
                var y1 = cvt.y + (dx * s + dy * c);
                target.add_point_stats(x1, y1);
            };
            target.add_point_stats(cvt.x, cvt.y);
            add_offset(w, 0);
            add_offset(0, h);
            add_offset(w, h);
        }

        target.translate_and_rotate = function(x, y, degrees, coordinate_conversion) {
            var context = target.canvas_context;
            context.save();   // should be matched by restore elsewhere
            var coords = coordinate_conversion(x, y);
            var cvt = target.converted_location(coords.x, coords.y);
            if ((degrees) && (target.canvas_y_up)) {
                degrees = -degrees;  // standard counter clockwise rotation convention.
            }
            context.translate(cvt.x, cvt.y);
            if (degrees) {
                context.rotate(degrees * Math.PI / 180.0);
            }
        };

        target.rect = function(opt) {
            // eg: element.rect({name:"a rect", x:10, y:50, w:10, h:120, color:"salmon", degrees:-15});
            var s = $.extend({
                color: target.canvas_fillColor,
                fill: true,  // if false then do a outline
                coordinate_conversion: no_change_conversion,
                frame: target,
            }, opt);
            // xxxx should also convert s.w and s.h?
            target.translate_and_rotate(s.x, s.y, s.degrees, s.coordinate_conversion);
            var context = target.canvas_context;
            context.beginPath();
            //context.fillStyle = s.color;
            var height = s.h;
            if (target.canvas_y_up) {
                height = -height;
            }
            context.rect(0, 0, s.w, height)  // translated to (x,y)
            fill_or_stroke(context, s);
            context.restore();  // matches translate_and_rotate
            // update stats
            if (target.canvas_stats) {
                target.rectangle_stats(s.x, s.y, s.w, s.h, s.degrees, s.coordinate_conversion);
            }
            return s;
        }

        var fill_or_stroke = function(context, s) {
            if (s.fill) {
                context.fillStyle = s.color;
                context.fill();
            } else {
                context.strokeStyle = s.color;
                if (s.lineWidth) {
                    context.lineWidth = s.lineWidth;
                }
                context.stroke();
            }
        };

        target.polygon = function(opt) {
            // eg: element.polygon({points: [[210, 10], [210, 110], [290, 60]], color: "brown"});
            var s = $.extend({
                color: target.canvas_fillColor,
                fill: true,  // if false then do a outline
                close: true,
                coordinate_conversion: no_change_conversion,
                frame: target,
            }, opt);
            var context = target.canvas_context;
            //context.fillStyle = s.color;
            var points = s.points;
            context.beginPath();
            var point0 = points[0];
            var p0f = s.coordinate_conversion(point0[0], point0[1]);
            var p0c = target.converted_location(p0f.x, p0f.y);
            if (target.canvas_stats) {
                target.add_point_stats(p0f.x, p0f.y);
            }
            context.moveTo(p0c.x, p0c.y);
            for (var i=1; i<points.length; i++) {
                var point = points[i];
                var pf = s.coordinate_conversion(point[0], point[1]);
                var pc = target.converted_location(pf.x, pf.y);
                context.lineTo(pc.x, pc.y);
                if (target.canvas_stats) {
                    target.add_point_stats(pf.x, pf.y);
                }
            }
            if (s.close) {
                context.closePath();
            }
            fill_or_stroke(context, s);
            return s;
        };

        target.color_at = function(pixel_x, pixel_y) {
            var imgData = target.canvas_context.getImageData(pixel_x, pixel_y, 1, 1);
            return imgData;
        };

        target.pixels = function () {
            var canvas = target.canvas[0];
            var h = canvas.height;
            var w = canvas.width;
            var imgData = target.canvas_context.getImageData(0, 0, w, h);
            return {"data": imgData.data, "height": imgData.height, "width": imgData.width};
        }

        target.event_pixel_location = function(e) {
            // Determine the coordinate in pixel space for an event e.
            // https://stackoverflow.com/questions/55677/how-do-i-get-the-coordinates-of-a-mouse-click-on-a-canvas-element
            var x, y;
            var canvas = target.canvas;
            if (e.pageX || e.pageY) { 
                x = e.pageX;
                y = e.pageY;
            }
            else { 
                x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft; 
                y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop; 
            }
            var offset = canvas.offset();
            x -= offset.left;
            y -= offset.top;
            return {x: x, y: y};
        };

        target.event_canvas_location = function(e) {
            // Determine the coordinate in canvas space for an event e.
            // https://stackoverflow.com/questions/17130395/real-mouse-position-in-canvas
            var canvas = target.canvas[0];
            //var rect = canvas.getBoundingClientRect();
            //var scaleX = canvas.width / rect.width;
            //var scaleY = canvas.height / rect.height;
            //var ts = target.canvas_translate_scale;
            var pixel_position = target.event_pixel_location(e);
            return target.pixel_to_canvas(pixel_position.x, pixel_position.y);
        };

        target.pixel_to_canvas = function (px, py) {
            // convert pixel coordinate to canvas coordinate.
            var ts = target.canvas_translate_scale;
            //var x = (-ts.x + px) / ts.w;
            //var y = (-ts.y + py) / ts.h;
            // first scale then translate
            var x = (px / ts.w) - ts.x;
            var y = (py / ts.h) - ts.y;
            return {x: x, y: y};
        };

        target.event_model_location = function(e) {
            // gives the model location of the event, not the frame location of objects in the model.
            var cl = target.event_canvas_location(e);
            return target.converted_location(cl.x, cl.y);
        };

        target.event_color = function(e) {
            var pixel_position = target.event_pixel_location(e);
            return target.color_at(pixel_position.x, pixel_position.y)
        };

        // convert location either from model space to canvas space or the reverse.
        target.converted_location = function (x, y) {
            result = {x: x, y: y};
            if (target.canvas_y_up) {
                // orient y going up from the lower left
                result.y = target.canvas_translate_scale.model_intercept - y;
            }
            return result;
        };

        target.canvas_to_pixel = function (cx, cy) {
            // convert canvas position to pixel position
            // first untranslate then unscale
            var ts = target.canvas_translate_scale;
            var px = (cx + ts.x) * ts.w;
            var py = (cy + ts.y) * ts.h;
            return {x: px, y: py};
        };

        target.model_to_pixel = function (mx, my) {
            var c = target.converted_location(mx, my);
            return target.canvas_to_pixel(c.x, c.y);
        }

        target.canvas_2d_widget_helper.add_vector_ops(target);

        return target;
    };

    $.fn.canvas_2d_widget_helper.add_vector_ops = function(target) {

        // generally useful vector calculations (xxxx here?)
        target.vscale = function(scalar, vector) {
            var result = {};
            for (slot in vector){
                result[slot] = vector[slot] * scalar;
            }
            return result;
        };
        target.vadd = function(v1, v2) {
            var result = {};
            for (slot in v1){
                result[slot] = v1[slot] + v2[slot];
            }
            return result;
        };
        target.vint = function(vector) {
            var result = {};
            for (slot in vector){
                result[slot] = Math.floor(vector[slot]);
            }
            return result;
        };
        // print convenience too
        target.print = function (...items) {
            var text = items.join(" ");
            return $("<div>" + text + "</div>").appendTo(target);
        };

        return target;
    }

    $.fn.canvas_2d_widget_helper.example = function(element) {
        element.empty();
        element.css("background-color", "cornsilk").width("520px");
        var config = {
            width: 400,
            height: 200,
            translate_scale: {x: 20, y:30, w:0.8, h:0.7},
        }
        element.canvas_2d_widget_helper(config);
        element.canvas_stats = {};
        var show_stats = function (color) {
            var stats = element.canvas_stats;
            var width = stats.max_x - stats.min_x;
            var height = stats.max_y - stats.min_y;
            element.rect({x: stats.min_x, y: stats.min_y, w: width, h:height, color:color, fill: false})
            element.canvas_stats = {};
        }
        element.circle({name: "green circle", x:160, y:70, r:20, color:"green"});
        show_stats("red");
        element.rect({name:"a rect", x:10, y:50, w:10, h:120, color:"salmon", degrees:-15});
        show_stats("green");
        element.text({name:"some text", x:40, y:40, text:"Canvas", color:"#f4d", degrees:45,
            font: "bold 20px Arial"});
        show_stats("blue");
        element.line({name:"a line", x1:100, y1:100, x2:150, y2:130, color:"brown"});
        show_stats("black");
        var pts = [[250,100], [400,100], [280,180], [375,60], [370,180]];
        element.print("polygon points", ...pts).css("color", "green");
        element.polygon({
            name: "polly", 
            points: [[250,100], [400,100], [280,180], [375,60], [370,180]],
            color: "#ffd",
        });
        show_stats("white");
        var p = element.model_to_pixel(160, 70);
        var c = element.color_at(p.x, p.y);
        var info = $("<div>At model 160,70 pixel=" + [p.x, p.y] + " color=" + c.data + "</div>").appendTo(element);
        element.canvas.mousemove(function (e) {
            var color = element.event_color(e);
            var ploc = element.event_pixel_location(e);
            var cloc = element.event_canvas_location(e);
            var mloc = element.event_model_location(e);
            info.html("<div>mouse move over color: " + color.data + 
                " ploc=" +ploc.x+ "," + ploc.y + 
                " cloc=" +cloc.x+ "," + cloc.y + 
                " mloc=" +mloc.x+ "," + mloc.y + 
                "</div>");
        });
    };

})(jQuery);
