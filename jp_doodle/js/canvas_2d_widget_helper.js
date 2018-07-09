/*

JQuery plugin helper for building widgets that use 2d canvas displays.
Append canvas element to jQuery container target and attach useful methods and slots to target.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/

(function($) {

    $.fn.canvas_2d_widget_helper = function (target, options) {
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
        }, options);

        for (var key in settings) {
            target["canvas_" + key] = settings[key];
        }

        target.reset_canvas = function () {
            target.empty();
            var w = target.canvas_width;
            var h = target.canvas_height;
            target.canvas = $(`<canvas width="${w}px" height="${h}px" style="border:1px solid #d3d3d3;"/>`);
            //target.canvas.width(target.canvas_width).height(target.canvas_height);
            target.canvas.appendTo(target);
            target.canvas_context = target.canvas[0].getContext("2d");
            var ctx = target.canvas_context;
            var ts = target.canvas_translate_scale;
            ctx.translate(ts.x, ts.y);
            ctx.scale(ts.w, ts.h);
            ts.model_height = h * ts.h;
            ts.model_intercept = 2 * ts.y + ts.model_height;
        };

        target.reset_canvas();

        target.clear_canvas = function () {
            // https://stackoverflow.com/questions/2142535/how-to-clear-the-canvas-for-redrawing
            var canvas = target.canvas[0];
            var context = target.canvas_context;
            var ts = target.canvas_translate_scale;
            context.resetTransform();
            context.clearRect(0, 0, canvas.width, canvas.height)
            context.translate(ts.x, ts.y);
            context.scale(ts.w, ts.h);
        };

        // Some functions useful for Jupyter/proxy interface:
        target.canvas_call = function(method_name, args) {
            var context = target.canvas_context;
            var method = context[method_name];
            method.apply(context, context, args);
        };

        target.canvas_assign = function(slot_name, value) {
            target.canvas_context[slot_name] = value;
        };

        target.circle = function(opt) {
            var s = $.extend({
                color: target.canvas_fillColor,
                start: 0,
                arc: 2 * Math.PI,
            }, opt);
            var context = target.canvas_context;
            context.beginPath();
            context.fillStyle = s.color;
            var center = target.converted_location(s.x, s.y);
            context.arc(center.x, center.y, s.r, s.start, s.arc);
            context.fill();
            return s;
        };

        target.line = function(opt) {
            var s = $.extend({
                color: target.canvas_strokeStyle,
                lineWidth: target.canvas_lineWidth,
            }, opt);
            var context = target.canvas_context;
            context.beginPath();
            context.strokeStyle = s.color;
            context.lineWidth = s.lineWidth;
            var p1 = target.converted_location(s.x1, s.y1);
            var p2 = target.converted_location(s.x2, s.y2);
            context.moveTo(p1.x, p1.y);
            context.lineTo(p2.x, p2.y);
            context.stroke();
            return s;
        };

        target.text = function(opt) {
            var s = $.extend({
                font: target.canvas_font,
                color: target.canvas_fillColor,
            }, opt);
            target.translate_and_rotate(s.x, s.y, s.degrees);
            var context = target.canvas_context;
            // XXX maybe configure font using atts/style?
            context.font = s.font;
            context.fillStyle = s.color;
            // XXX text align?
            context.fillText(s.text, 0, 0); // translated to (x,y)
            context.restore();  // matches translate_and_rotate
            return s;
        };

        target.translate_and_rotate = function(x, y, degrees) {
            var context = target.canvas_context;
            context.save();   // should be matched by restore elsewhere
            var cvt = target.converted_location(x, y);
            if (target.canvas_y_up) {
                degrees = -degrees;  // standard counter clockwise rotation convention.
            }
            context.translate(cvt.x, cvt.y);
            if (degrees) {
                context.rotate(degrees * Math.PI / 180.0);
            }
        };

        target.rect = function(opt) {
            var s = $.extend({
                color: target.canvas_fillColor,
            }, opt);
            target.translate_and_rotate(s.x, s.y, s.degrees);
            var context = target.canvas_context;
            context.beginPath();
            context.fillStyle = s.color;
            var height = s.h;
            if (target.canvas_y_up) {
                height = -height;
            }
            context.rect(0, 0, s.w, height)  // translated to (x,y)
            context.fill();
            context.restore();  // matches translate_and_rotate
        }

        target.polygon = function(opt) {
            var s = $.extend({
                color: target.canvas_fillColor,
            }, opt);
            var context = target.canvas_context;
            context.fillStyle = s.color;
            var points = s.points;
            context.beginPath();
            var point0 = points[0];
            var p0c = target.converted_location(point0[0], point0[1]);
            context.moveTo(p0c.x, p0c.y);
            for (var i=1; i<points.length; i++) {
                var point = points[i];
                var pc = target.converted_location(point[0], point[1]);
                context.lineTo(pc.x, pc.y);
            }
            context.closePath();
            context.fill();
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
            // https://stackoverflow.com/questions/17130395/real-mouse-position-in-canvas
            var canvas = target.canvas[0];
            //var rect = canvas.getBoundingClientRect();
            //var scaleX = canvas.width / rect.width;
            //var scaleY = canvas.height / rect.height;
            var ts = target.canvas_translate_scale;
            var pixel_position = target.event_pixel_location(e);
            //return {x: scaleX * pixel_position.x, y: scaleY * pixel_position.y};
            var x = (-ts.x + pixel_position.x) / ts.w;
            var y = (-ts.y + pixel_position.y) / ts.h;
            return {x: x, y: y};
        };

        target.event_model_location = function(e) {
            var cl = target.event_canvas_location(e);
            return target.converted_location(cl.x, cl.y);
        }

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

        return target;
    };

    $.fn.canvas_2d_widget_helper.example = function(element) {
        debugger;
        element.empty();
        element.css("background-color", "cornsilk").width("520px");
        var config = {
            width: 400,
            height: 200,
            translate_scale: {x: 20, y:30, w:0.8, h:0.7},
        }
        element.canvas_2d_widget_helper(element, config);
        element.circle({name: "green circle", x:160, y:70, r:20, color:"green"});
        element.rect({name:"a rect", x:10, y:50, w:10, h:120, color:"salmon", degrees:-15});
        element.text({name:"some text", x:40, y:40, text:"Canvas", color:"#f4d", degrees:45});
        element.line({name:"a line", x1:100, y1:100, x2:150, y2:130, color:"brown"});
        element.polygon({
            name: "polly", 
            points: [[250,100], [400,100], [280,180], [375,60], [370,180]],
            color: "#ffd",
        });
        var c = element.color_at(160, 70);
        var info = $("<div>a canvas.  color at 160 70: " + c.data + "</div>").appendTo(element);
        element.canvas.mousemove(function (e) {
            debugger;
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
