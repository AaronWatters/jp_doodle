/*

JQuery plugin helper for an animated group of repeated vector transitions.

Assumes the element has been initialized using dual_canvas_helper.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/
"use strict";

(function ($) {

    $.fn.canvas_2d_vector_field = function (options, element) {
        element = element || this;

        if (!element.color_interpolator) {
            throw new Error("element must be a dual_canvas.");
        }

        var settings = $.extend({
            duration: 1, // seconds
            initial_color: "blue",
            final_color: "orange",
            radius: 3,
            shape: "circle",
            temporary: true
        }, options);

        var color_interpolator = element.color_interpolator(settings.initial_color, settings.final_color);

        var transition = {
            interpolate: function () {
                var shape = settings.shape;
                var initial_color = settings.initial_color;
                var final_color = settings.final_color;
                var frame = settings.frame;
                frame.reset_frame();
                var now_seconds = 0.001 * new Date().getTime();
                //console.log("interpolate at ", now_seconds);
                var motions = settings.motions;
                var radius = settings.radius;
                var duration = settings.duration;
                for (var i = 0; i < motions.length; i++) {
                    var motion = motions[i];
                    var lambda = (now_seconds + motion.dt) / duration % 1.0;
                    var lambda1 = 1.0 - lambda;
                    //var scale = Math.sin(Math.PI * lambda);
                    var scale = lambda * 2;
                    if (scale > 1) {
                        scale = 2.0 - scale;
                    }
                    var r = scale * radius;
                    var color = settings.initial_color;
                    if (final_color != initial_color) {
                        color = color_interpolator(lambda);
                    }
                    if (shape == "circle") {
                        frame.frame_circle({
                            r: r,
                            color: color,
                            x: motion.sx * lambda1 + motion.ex * lambda,
                            y: motion.sy * lambda1 + motion.ey * lambda,
                            temporary: settings.temporary
                        });
                    } else {
                        // default to line
                        var dx = motion.ex - motion.sx;
                        var dy = motion.ey - motion.sy;
                        var qscale = scale * 0.2;
                        frame.line({
                            color: color,
                            x1: motion.sx + (lambda - qscale) * dx,
                            y1: motion.sy + (lambda - qscale) * dy,
                            x2: motion.sx + (lambda + qscale) * dx,
                            y2: motion.sy + (lambda + qscale) * dy,
                            temporary: settings.temporary
                        });
                    }
                }
            },
            finished: function () {
                return false; // loop forever until frame deleted.
            }
        };

        element.active_transitions[settings.frame.name] = transition;

        element.request_redraw();
    };

    $.fn.canvas_2d_vector_field.example = function (element) {
        var canvas_config = {
            width: 600,
            height: 400
            //translate_scale: {x: x, y:y, w:w, h:h},
        };
        element.dual_canvas_helper(canvas_config);
        var frame0 = element.frame_region(50, 50, 300, 300, 0, 0, 1, 1);
        frame0.frame_rect({ x: 0, y: 0, w: 1, h: 1, color: "cyan" });
        var frame = element.frame_region(50, 50, 300, 300, 0, 0, 1, 1);
        var f_options = {
            frame: frame,
            duration: 10.0, // seconds
            initial_color: "blue",
            //final_color: "orange",
            final_color: "blue",
            shape: "circle", // or "line"
            radius: 0.1,
            motions: [{ sx: 0, sy: 0, ex: 0, ey: 1, dt: 1 }, { sx: 0, sy: 1, ex: 1, ey: 1, dt: 1 }, { sx: 1, sy: 1, ex: 1, ey: 0, dt: 1 }, { sx: 1, sy: 0, ex: 0, ey: 0, dt: 1 }]
        };
        element.canvas_2d_vector_field(f_options);
    };
})(jQuery);