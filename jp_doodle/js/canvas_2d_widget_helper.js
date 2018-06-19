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
        };

        target.reset_canvas();

        target.clear_canvas = function () {
            // https://stackoverflow.com/questions/2142535/how-to-clear-the-canvas-for-redrawing
            var canvas = target.canvas[0];
            var context = target.canvas_context;
            context.clearRect(0, 0, canvas.width, canvas.height)
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

        target.circle = function(name, cx, cy, r, fill, atts, style) {
            var context = target.canvas_context;
            context.beginPath();
            context.fillStyle = (fill || target.canvas_fillColor);
            context.arc(cx, cy, r, 0, 2 * Math.PI);
            context.fill();
        };

        target.line = function(name, x1, y1, x2, y2, color, atts, style) {
            var context = target.canvas_context;
            if (!atts) { atts = {}; }
            context.beginPath();
            context.strokeStyle = (color || target.canvas_strokeStyle);
            //self._assign("lineWidth", width)
            context.lineWidth = (atts["stroke-width"] || target.canvas_lineWidth);
            context.moveTo(x1, y1);
            context.lineTo(x2, y2);
            context.stroke();
        };

        target.text = function (name, x, y, text, fill, atts, style, degrees) {
            target.translate_and_rotate(atts, x, y, degrees);
            var context = target.canvas_context;
            var font = target.canvas_font;
            // XXX maybe configure font using atts/style?
            context.font = font;
            context.fillStyle = (fill || target.canvas_fillColor);
            // XXX text align?
            context.fillText(text, 0, 0); // translated to (x,y)
            context.restore();  // matches translate_and_rotate
        };

        target.translate_and_rotate = function(atts, x, y, degrees) {
            var context = target.canvas_context;
            context.save();   // should be matched by restore elsewhere
            context.translate(x, y);
            if (degrees) {
                context.rotate(degrees * Math.PI / 180.0);
            }
        }

        target.rect = function(name, x, y, w, h, fill, atts, style, degrees) {
            target.translate_and_rotate(atts, x, y, degrees);
            var context = target.canvas_context;
            context.beginPath();
            context.fillStyle = (fill || target.canvas_fillColor);
            context.rect(0, 0, w, h)  // translated to (x,y)
            context.fill();
            context.restore();  // matches translate_and_rotate
        };

        target.color_at = function(x, y) {
            var imgData = target.canvas_context.getImageData(x, y, 1, 1);
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
            https://stackoverflow.com/questions/55677/how-do-i-get-the-coordinates-of-a-mouse-click-on-a-canvas-element
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
            var rect = canvas.getBoundingClientRect();
            var scaleX = canvas.width / rect.width;
            var scaleY = canvas.height / rect.height;
            var pixel_position = target.event_pixel_location(e);
            return {x: scaleX * pixel_position.x, y: scaleY * pixel_position.y};
        }

        target.event_color = function(e) {
            var pixel_position = target.event_pixel_location(e);
            return target.color_at(pixel_position.x, pixel_position.y)
        }

        return target;
    };

    $.fn.canvas_2d_widget_helper.example = function(element) {
        debugger;
        element.empty();
        element.css("background-color", "cornsilk").width("520px");
        var config = {
            width: 400,
            height: 200,
        }
        element.canvas_2d_widget_helper(element, config);
        element.circle("green circle", 160, 70, 20, "green");
        element.rect("a rect", 10, 50, 10, 120, "salmon", null, null, -15);
        element.text("some text", 40, 40, "Canvas", "#f4d", null, null, 45);
        element.line("a line", 100, 100, 150, 130, "brown");
        var c = element.color_at(160, 70);
        var info = $("<div>a canvas.  color at 160 70: " + c.data + "</div>").appendTo(element);
        element.canvas.mousemove(function (e) {
            debugger;
            var color = element.event_color(e);
            var ploc = element.event_pixel_location(e);
            var cloc = element.event_canvas_location(e);
            info.html("<div>mouse move over color: " + color.data + 
                " ploc=" +ploc.x+ "," + ploc.y + 
                " cloc=" +cloc.x+ "," + cloc.y + 
                "</div>");
        });
    };

})(jQuery);
