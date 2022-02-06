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
            image_smoothing: true,
        }, options);

        for (var key in settings) {
            target["canvas_" + key] = settings[key];
        }

        target.reset_canvas = function () {
            target.empty();
            var w = target.canvas_width;
            var h = target.canvas_height;
            var st = target.canvas_style;
            target.canvas = $(`<canvas width="${w}px" height="${h}px" style="${st}" tabindex="0"/>`);
            //target.canvas.width(target.canvas_width).height(target.canvas_height);
            target.canvas.appendTo(target);
            target.canvas_context = target.canvas[0].getContext("2d");
            var ctx = target.canvas_context;
            ctx.imageSmoothingEnabled = target.canvas_image_smoothing;
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
            //context.resetTransform();  -- not supported in IE
            context.setTransform(1, 0, 0, 1, 0, 0);
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

        /*
        var no_change_conversion = function (x, y) {
            // default frame conversion: no change
            return {x: x, y: y};
        }
        */

        var no_change_conversion = function (position, attribute_name, coordinate_names) {
            // extract x,y coordinate mapping from position description.
            attribute_name = attribute_name || "position";
            coordinate_names = coordinate_names || ["x", "y"]
            // if there is a position slot, use the slot value.
            var position_slot = position[attribute_name];
            var result = null;
            if (position_slot) {
                position = position_slot;
                result = position;   // don't translate coordinate names in slot value
            }
            if (Array.isArray(position)) {
                // positional array
                result = {x: position[0], y: position[1]};
            } else if (!result) {
                // otherwise translate named slots
                result = {x: position[coordinate_names[0]], y: position[coordinate_names[1]]};
            }
            return result;
        }

        // for use in frames, for example.
        target.no_change_conversion = no_change_conversion;

        target.circle = function(opt) {
            // eg: element.circle({x: 140, y: 100, r: 10, color: "green"});
            var s = $.extend({
                color: target.canvas_fillColor,
                start: 0,
                arc: 2 * Math.PI,
                fill: true,  // if false then do a outline
                coordinate_conversion: no_change_conversion,
                //frame: target,
                // lineWidth: 3,
            }, opt);
            var context = target.canvas_context;
            context.save(); 
            context.beginPath();
            //context.fillStyle = s.color;
            //var fcenter = s.coordinate_conversion(s.x, s.y);
            var fcenter = s.coordinate_conversion(s);
            // for debugging
            s.fcenter = fcenter;
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
            // sample pixel for lasso testing
            s.sample_pixel = target.canvas_to_pixel(fcenter.x, fcenter.y, true);
            return save_check(s, "circle");
        };

        var save_check = function(s, shape_name) {
            // record to object settings to draw list if set
            var draw_list = target.draw_list;
            if (draw_list) {
                var sc = $.extend({}, s);
                if (sc.frame) {
                    sc.frame = null;
                }
                sc.shape_name = shape_name;
                draw_list.push(sc);
            }
            return s;
        }

        target.buggy_frame_circle = function(opt) {
            // circle with radius adjusted w.r.t frame transform.
            // xxxx somewhat heuristic -- not a distorted circle.
            var s = $.extend({}, opt);
            var factor = 1.0;
            var cc = s.coordinate_conversion;
            if (cc) {
                var cxy = function(x, y) {
                    return cc({x: x, y: y});
                }
                var origin = cxy(0, 0);
                var x1 = cxy(1, 0);
                var y1 = cxy(0, 1);
                var dd = target.vdistance;
                var factor = Math.max(dd(origin, x1), dd(origin, y1));
            }
            // keep the original radius
            s.frame_radius = s.frame_radius || s.r;
            var r = s.frame_radius;
            s.r = r * factor;
            return target.circle(s);
        };

        target.line = function(opt) {
            // eg: element.line({name:"a line", x1:100, y1:100, x2:150, y2:130, color:"brown"});
            var s = $.extend({
                color: target.canvas_strokeStyle,
                lineWidth: target.canvas_lineWidth,
                coordinate_conversion: no_change_conversion,
                lineDash: null, // or array like [3,15]
                //frame: target,
            }, opt);
            var context = target.canvas_context;
            context.save();
            context.beginPath();
            context.strokeStyle = s.color;
            context.lineWidth = s.lineWidth;
            var lineDash = s.lineDash;
            if (lineDash) {
                context.setLineDash(lineDash);
            }
            //var fp1 = s.coordinate_conversion(s.x1, s.y1);
            //var fp2 = s.coordinate_conversion(s.x2, s.y2);
            var fp1 = s.coordinate_conversion(s, "position1", ["x1", "y1"]);
            var fp2 = s.coordinate_conversion(s, "position2", ["x2", "y2"]);
            // keep the converted coordinates for SVG conversion
            s.fp1 = fp1;
            s.fp2 = fp2;
            var p1 = target.converted_location(fp1.x, fp1.y);
            var p2 = target.converted_location(fp2.x, fp2.y);
            context.moveTo(p1.x, p1.y);
            context.lineTo(p2.x, p2.y);
            context.stroke();
            context.restore();
            // update stats
            if (target.canvas_stats) {
                target.add_point_stats(fp1.x, fp1.y);
                target.add_point_stats(fp2.x, fp2.y);
            }
            // sample pixel for lasso testing
            s.sample_pixel = target.canvas_to_pixel(fp1.x, fp1.y, true);
            return save_check(s, "line");
        };

        target.text = function(opt) {
            // eg: element.text({name:"some text", x:40, y:40, text:"text content"})
            var s = $.extend({
                font: target.canvas_font,
                color: target.canvas_fillColor,
                background: null,   // background color if provided.
                coordinate_conversion: no_change_conversion,
                //frame: target,
            }, opt);
            var text = "" + s.text;  // coerce to string
            //target.translate_and_rotate(s.x, s.y, s.degrees, s.coordinate_conversion);
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
                //rwidth = - width;
            }
            if ((s.align) && (s.align == "center")) {
                dx = - width * 0.5;
                // XXXX this is wrong -- only half the text will respond to events.  Needs rework.
                //rwidth = - width * 0.5;
            }
            var height = width * 2.4 / text.length;  // fudge...
            if (!target.canvas_y_up) {
                // text draws in negative y
                height = - height;
                //dy = -dy;
            }
            if ((s.valign) && (s.valign == "center")) {
                dy = -0.3 * height + dy;
            }
            if ((s.valign) && (s.valign == "top")) {
                dy = -height + dy;
            }
            var rdy = dy - height * 0.2;
            // use a rectangle for masking operations
            s.background_rect = {w: rwidth, h: height, dx: dx, dy: rdy};
            s.draw_mask = function (to_canvas, info) {
                //to_canvas.rect({x: info.x, y: info.y, w:rwidth, h:height, degrees:info.degrees, color:info.color, dx:dx, dy:rdy});
                var config = $.extend({}, info);
                config.w = rwidth;
                config.h = height;
                config.dx = dx;
                config.dy = rdy;
                // record the background rect geometry for use in (eg) SVG conversion.
                s.background_rect = {w: rwidth, h: height, dx: dx, dy: rdy};
                to_canvas.rect(config);
            };
            // If background is provided, draw a background rectangle
            if (s.background) {
                var background_info = $.extend({}, s)
                background_info.color = s.background;
                s.draw_mask(target, background_info);
            }
            // draw the text
            if (target.canvas_y_up) {
                dy = - dy;
            }
            //target.translate_and_rotate(s.x, s.y, s.degrees, s.coordinate_conversion);
            target.translate_and_rotate(s);
            context.fillText(text, dx, dy); // translated to (x,y)
            // update stats
            if (target.canvas_stats) {
                //target.rectangle_stats(s.x, s.y, rwidth, height, s.degrees, s.coordinate_conversion, dx, rdy);
                target.rectangle_stats(s, rwidth, height, s.degrees, s.coordinate_conversion, dx, rdy);
            }
            context.restore();  // matches translate_and_rotate
            return save_check(s, "text");
        };

        target.rectangle_stats = function(s, w, h, degrees, coordinate_conversion, dx, dy) {
            dx = dx || 0;
            dy = dy || 0;
            var radians = 0.0;
            if (degrees) {
                radians = degrees * Math.PI / 180.0;
            }
            //var cvt = coordinate_conversion(x, y);
            var cvt = coordinate_conversion(s);
            var cs = Math.cos(radians);
            var sn = Math.sin(radians);
            var sumx = 0;
            var sumy = 0
            var add_offset = function (dx, dy) {
                var x1 = cvt.x + (dx * cs - dy * sn);
                var y1 = cvt.y + (dx * sn + dy * cs);
                target.add_point_stats(x1, y1);
                sumx += x1;
                sumy += y1;
            };
            //target.add_point_stats(cvt.x, cvt.y);
            add_offset(dx, dy);
            add_offset(w+dx, dy);
            add_offset(dx, h+dy);
            add_offset(w+dx, h+dy);
            // sample pixel for lasso testing
            s.sample_pixel = target.canvas_to_pixel(0.25 * sumx, 0.25 * sumy, true);
        }

        target.translate_and_rotate = function(s) {
            var degrees = s.degrees;
            var context = target.canvas_context;
            context.save();   // should be matched by restore elsewhere
            var coords = s.coordinate_conversion(s);
            // keep the coords for SVG conversion
            s.coords = coords;
            var cvt = target.converted_location(coords.x, coords.y);
            if ((degrees) && (target.canvas_y_up)) {
                degrees = -degrees;  // standard counter clockwise rotation convention.
            }
            context.translate(cvt.x, cvt.y);
            s.translate = cvt;
            if (degrees) {
                var radians = degrees * Math.PI / 180.0;
                //context.rotate(degrees * Math.PI / 180.0);
                context.rotate(radians);
                s.rotate_radians = radians;
            }
        };

        target.frame_rect_buggy = function(opt) {
            // rectangle distorted by reference frame transform
            //var x = opt.x || 0;
            //var y = opt.y || 0;
            var position = no_change_conversion(opt);
            var x = position.x;
            var y = position.y;
            var h = opt.h || 0;
            var w = opt.w || 0;
            var dx = opt.dx || 0;
            var dy = opt.dy || 0;
            var xL = x + dx;
            var yL = y + dy;
            var xR = xL + w;
            var yU = yL + h;
            var points = [[xL,yL],[xR,yL],[xR,yU],[xL,yU]];
            var s = $.extend({}, opt);
            s.points = points;
            s.cx = x;
            s.cy = y;
            return target.polygon(s);
        }

        target.rect = function(opt) {
            // eg: element.rect({name:"a rect", x:10, y:50, w:10, h:120, color:"salmon", degrees:-15});
            var s = $.extend({
                color: target.canvas_fillColor,
                fill: true,  // if false then do a outline
                coordinate_conversion: no_change_conversion,
                //frame: target,
            }, opt);
            // xxxx should also convert s.w and s.h?
            //target.translate_and_rotate(s.x, s.y, s.degrees, s.coordinate_conversion);
            target.translate_and_rotate(s);
            var context = target.canvas_context;
            context.beginPath();
            //context.fillStyle = s.color;
            var height = s.h;
            var dx = s.dx || 0;
            var dy = s.dy || 0;
            var dy0 = dy;
            if (target.canvas_y_up) {
                height = -height;
                dy = -dy;
            }
            context.rect(dx, dy, s.w, height)  // translated to (x,y)
            fill_or_stroke(context, s);
            context.restore();  // matches translate_and_rotate
            // update stats
            if (target.canvas_stats) {
                //target.rectangle_stats(s.x, s.y, s.w, s.h, s.degrees, s.coordinate_conversion, dx, dy0);
                target.rectangle_stats(s, s.w, s.h, s.degrees, s.coordinate_conversion, dx, dy0);
            }
            return save_check(s, "rect");
        };

        // attached image sources by name
        // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage
        target.named_images = {};

        target.add_image = function(name, image_source) {
            target.named_images[name] = image_source;
        };

        target.named_image = function(opt) {
            // eg: element.rect({name:"a rect", x:10, y:50, w:10, h:120, color:"salmon", degrees:-15});
            var s = $.extend({
                image_name: null,
                coordinate_conversion: no_change_conversion,
                //frame: target,
            }, opt);
            var image_source = target.named_images[s.image_name];
            if (!image_source) {
                throw new Error("No image loaded with name: " + s.image_name);
            }
            // xxxx this is copy/pasted from rect -- should refactor.
            // xxxx should also convert s.w and s.h?
            //target.translate_and_rotate(s.x, s.y, s.degrees, s.coordinate_conversion);
            target.translate_and_rotate(s);
            var context = target.canvas_context;
            context.beginPath();
            //context.fillStyle = s.color;
            var height = s.h;
            var dx = s.dx || 0;
            var dy = s.dy || 0;
            var dy0 = dy;
            if (target.canvas_y_up) {
                height = -height;
                dy = -dy;
            }
            //context.rect(dx, dy, s.w, height)  // translated to (x,y)
            //fill_or_stroke(context, s);
            var isnum = function(x) { return ((typeof x) == 'number'); };
            if (isnum(s.sx) && isnum(s.sy) && isnum(s.sWidth) && isnum(s.sHeight) ) {
                try {
                    context.drawImage(image_source, s.sx, s.sy, s.sWidth, s.sHeight, dx, dy, s.w, height);
                } catch (err) {
                    console.warn("failed to draw image window " + [s.image_name, err.message]);
                }
            } else {
                try {
                    context.drawImage(image_source, dx, dy, s.w, height);
                } catch (err) {
                    console.warn("failed to draw whole image " + [s.image_name, err.message]);
                }
            }
            context.restore();  // matches translate_and_rotate
            // update stats
            if (target.canvas_stats) {
                //target.rectangle_stats(s.x, s.y, s.w, s.h, s.degrees, s.coordinate_conversion, dx, dy0);
                target.rectangle_stats(s, s.w, s.h, s.degrees, s.coordinate_conversion, dx, dy0);
            }
            // use a rectangle for masking operations
            s.draw_mask = function (to_canvas, info) {
                var config = $.extend({}, info);
                to_canvas.rect(config);
            };
            return save_check(s, "named_image");
        };

        var fill_or_stroke = function(context, s) {
            if (s.fill) {
                context.fillStyle = s.color;
                context.fill();
            } else {
                context.strokeStyle = s.color;
                if (s.lineWidth) {
                    context.lineWidth = s.lineWidth;
                }
                var lineDash = s.lineDash;
                if (lineDash) {
                    context.setLineDash(lineDash);
                }
                context.stroke();
            }
        };

        target.polygon = function(opt) {
            // eg: element.polygon({points: [[210, 10], [210, 110], [290, 60]], color: "brown"});
            //  A "point" array of length 3 consisting of 3 inner points represents a bezier curve:
            // eg: element.polygon({points: [[20, 20], [[20,100], [200,100], [200,20]]]})
            var s = $.extend({
                color: target.canvas_fillColor,
                fill: true,  // if false then do a outline
                close: true,
                coordinate_conversion: no_change_conversion,
                //frame: target,
                cx: 0,
                cy: 0,
                degrees: 0,
                get_vertices: function(s) { return s.points; },
            }, opt);
            var context = target.canvas_context;
            //context.fillStyle = s.color;
            context.save();
            var input_points = s.get_vertices(s);  // s.points;
            // convert input points using dx, dy, and degrees if provided
            var cx = s.cx;
            var cy = s.cy;
            var degrees = s.degrees;
            var points = input_points;
            if (degrees) {
                var map_degrees = function(input_points) {
                    var points = [];
                    // xxxx duplicate code here
                    var radians = degrees * Math.PI / 180.0;
                    var cs = Math.cos(radians);
                    var sn = Math.sin(radians);
                    for (var i=0; i<input_points.length; i++) {
                        var point = input_points[i];
                        if (point.length == 2) {
                            var vx = point[0] - cx;
                            var vy = point[1] - cy;
                            var rx = (vx * cs - vy * sn);
                            var ry = (vx * sn + vy * cs);
                            points.push([rx + cx, ry + cy]);
                        } else {
                            // inner array of points (maybe always should have length 3?)
                            points.push(map_degrees(point));
                        }
                    }
                    return points;
                }
                points = map_degrees(input_points);
            }
            var fpoints = [];
            // record fpoints for SVG conversion (could make conditionsal)
            s.fpoints = fpoints;
            // If no points do nothing.
            if ((!points) || (points.length < 1)) {
                return s;
            }
            context.beginPath();
            var point0 = points[0];
            if (point0.length != 2) {
                throw new Error("First point of polygon must have length 2: " + point0);
            }
            //var p0f = s.coordinate_conversion(point0[0], point0[1]);
            var point_conversion = function (point, is_sample, recursed) {
                var ln = point.length;
                if (ln == 2) {
                    var pf = s.coordinate_conversion(point);
                    // xxxx note: svg conversion does not support bezier correctly!! xxxx
                    // xxxx automatically convert bezier control points to regular polygon vertices in fpoints.
                    fpoints.push(pf);  
                    if (target.canvas_stats) {
                        target.add_point_stats(pf.x, pf.y);
                    }
                    if (is_sample) {
                        s.sample_pixel = target.canvas_to_pixel(pf.x, pf.y, true);
                    }
                    var pc = target.converted_location(pf.x, pf.y);
                    return pc;
                } else if ((!recursed) && (ln == 3)) {
                    // bezier control points point = [A, B, C]
                    var A = point_conversion(point[0], false, true);
                    var B = point_conversion(point[1], false, true);
                    var C = point_conversion(point[2], false, true);
                    return {A:A, B:B, C:C, bezier: true};
                } else {
                    throw new Error("unsupported point length: " + [ln, point]);
                }
            };
            //var p0f = s.coordinate_conversion(point0);
            //var p0c = target.converted_location(p0f.x, p0f.y);
            //if (target.canvas_stats) {
            //    target.add_point_stats(p0f.x, p0f.y);
            //}
            // sample pixel for lasso testing
            var p0c = point_conversion(point0, true, false);
            //s.sample_pixel = target.canvas_to_pixel(p0f.x, p0f.y, true);
            context.moveTo(p0c.x, p0c.y);
            //fpoints.push(p0f);
            for (var i=1; i<points.length; i++) {
                var point = points[i];
                //var pf = s.coordinate_conversion(point[0], point[1]);
                //var pf = s.coordinate_conversion(point);
                //fpoints.push(pf);
                //var pc = target.converted_location(pf.x, pf.y);
                var pc = point_conversion(point, false, false);
                if (pc.bezier) {
                    context.bezierCurveTo(pc.A.x, pc.A.y, pc.B.x, pc.B.y, pc.C.x, pc.C.y);
                } else {
                    context.lineTo(pc.x, pc.y);
                }
                //if (target.canvas_stats) {
                //    target.add_point_stats(pf.x, pf.y);
                //}
            }
            if (s.close) {
                context.closePath();
            }
            fill_or_stroke(context, s);
            context.restore();
            return save_check(s, "polygon");
        };

        target.color_at = function(pixel_x, pixel_y) {
            pixel_x = pixel_x || 0;
            pixel_y = pixel_y || 0;
            var imgData = target.canvas_context.getImageData(pixel_x, pixel_y, 1, 1);
            return imgData;
        };

        target.pixels = function (x, y, h, w) {
            var canvas = target.canvas[0];
            x = x || 0;
            y = y || 0;
            var h = h || canvas.height;
            var w = w || canvas.width;
            var imgData = target.canvas_context.getImageData(x, y, w, h);
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
            //var canvas = target.canvas[0];
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

        target.model_view_box = function () {
            // return the viewable dimensions in model coordinates
            var upper_left_model = target.pixel_to_canvas(0, 0);
            var canvas = target.canvas[0];
            var lower_right_model = target.pixel_to_canvas(canvas.width, canvas.height);
            //var upper_left_model = target.converted_location(upper_left_canvas.x, upper_left_canvas.y);
            //var lower_right_model = target.converted_location(lower_right_canvas.x, lower_right_canvas.y);
            //var upper_left_model = upper_left_canvas;
            //var lower_right_model = lower_right_canvas;
            return {
                min_x: Math.min(upper_left_model.x, lower_right_model.x),
                min_y: Math.min(upper_left_model.y, lower_right_model.y),
                max_x: Math.max(upper_left_model.x, lower_right_model.x),
                max_y: Math.max(upper_left_model.y, lower_right_model.y),
            };
        }

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
            var result = {x: x, y: y};
            if (target.canvas_y_up) {
                // orient y going up from the lower left
                result.y = target.canvas_translate_scale.model_intercept - y;
            }
            return result;
        };

        target.canvas_to_pixel = function (cx, cy, rounded) {
            // convert canvas position to pixel position
            // first untranslate then unscale
            var ts = target.canvas_translate_scale;
            var px = (cx + ts.x) * ts.w;
            var py = (cy + ts.y) * ts.h;
            if (rounded) {
                px = Math.round(px);
                py = Math.round(py);
            }
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

        target.vdirection_radians = function(vector) {
            var length = target.vlength(vector);
            var cosine = 0;
            if (length > 1e-16) {
                var cosine = vector.x / length;
            }
            var arccos = Math.acos(cosine);
            if (vector.y > 0) {
                return arccos;
            } else {
                return -arccos;
            }
        };

        target.vdirection_degrees = function(vector) {
            return target.radians_to_degrees(target.vdirection_radians(vector));
        }

        target.radians_to_degrees = function(radians) {
            return 180.0 * radians / Math.PI;
        }

        // generally useful vector calculations (xxxx here?)
        target.vscale = function(scalar, vector) {
            var result = {};
            for (var slot in vector){
                result[slot] = vector[slot] * scalar;
            }
            return result;
        };
        target.vadd = function(v1, v2) {
            var result = {};
            for (var slot in v1){
                result[slot] = v1[slot] + v2[slot];
            }
            return result;
        };
        target.vdot = function(v1, v2) {
            var result = 0.0;
            for (var slot in v1) {
                result += v1[slot] * v2[slot];
            }
            return result;
        };
        target.vlength = function(vector) {
            return Math.sqrt(target.vdot(vector, vector));
        };
        target.vdistance = function(v1, v2) {
            return target.vlength(target.vsub(v1, v2));
        };
        target.vsub = function(v1, v2) {
            return target.vadd(v1, target.vscale(-1.0, v2));
        };
        target.vint = function(vector) {
            var result = {};
            for (var slot in vector){
                result[slot] = Math.floor(vector[slot]);
            }
            return result;
        };
        // print convenience too
        target.print = function (...items) {
            items = items.map(x => "" + x);
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
        // image example: load the mandrill image from USC
        var mandrill_url = "http://sipi.usc.edu/database/preview/misc/4.2.03.png";
        var mandrill_image = new Image();
        element.add_image("mandrill", mandrill_image);
        mandrill_image.onload = function () {
            // show the image after it loads
            element.named_image({
                image_name: "mandrill", x:220, y:20, w:100, h:40,
                sx: 30, sy:15, sWidth:140, sHeight:20
            });
            show_stats("#ff8");
        };
        mandrill_image.src = mandrill_url;
        // other shape examples
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
        // element.event_color does not work with cross-origin mandrill image.  Commented for now.
        /*
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
        */
    };

})(jQuery);
