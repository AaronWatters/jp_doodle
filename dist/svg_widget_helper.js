"use strict";

/*

JQuery plugin helper for building widgets that use SVG.
Append SVG element to jQuery container target and attach useful methods and slots to target.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/

(function ($) {

    $.fn.svg_widget_helper = function (target, options) {
        var settings = $.extend({
            viewBox: "0 0 500 500",
            preserveAspectRatio: "none"
        }, options);

        var svg_elt = function (kind) {
            return document.createElementNS('http://www.w3.org/2000/svg', kind);
        };

        var svg = svg_elt("svg");

        var $svg = $(svg);
        $svg.options = options; // partially for debugging.
        $svg.named_elements = {};
        $svg.appendTo(target);
        target.$svg = $svg;

        // Attach methods and data.
        target.svg_elt = svg_elt;
        target.$svg.reference_point = svg.createSVGPoint();

        target.clear = function () {
            $svg.named_elements = {};
            $svg.empty();
            return target;
        };

        target.add_element = function (name, tag, atts, style, text) {
            var element = target.svg_elt(tag);
            element.widget_name = name; // for future reference
            var $element = $(element);
            target.update_element($element, atts, style, text);
            $svg.named_elements[name] = $element;
            $svg.append($element);
            return target;
        };

        target.change_element = function (name, atts, style, text) {
            var $element = $svg.named_elements[name];
            if ($element) {
                target.update_element($element, atts, style, text);
            } else {
                console.warn("couldn't find element for " + name);
            }
        };

        target.update_element = function ($element, atts, style, text) {
            var element = $element[0];
            if (atts) {
                for (var att in atts) {
                    element.setAttribute(att, atts[att]);
                }
            }
            if (style) {
                for (var styling in style) {
                    element.style[styling] = style[styling];
                }
            }
            if (text) {
                $element.empty();
                var node = document.createTextNode(text);
                element.appendChild(node);
            }
            return $element;
        };

        target.event_location = function (event) {
            // http://stackoverflow.com/questions/10298658/mouse-position-inside-autoscaled-svg
            var pt = target.$svg.reference_point;
            pt.x = event.clientX;
            pt.y = event.clientY;
            return pt.matrixTransform(svg.getScreenCTM().inverse());
        };

        target.svg_attribute = function (name, value) {
            if (value != undefined) {
                svg.setAttribute(name, value);
            }
            return svg[name];
        };

        target.preserveAspectRatio = function (r) {
            return target.svg_attribute("preserveAspectRatio", r);
        };
        target.preserveAspectRatio(settings.preserveAspectRatio);

        target.viewBox = function (vB) {
            return target.svg_attribute("viewBox", vB);
        };
        target.viewBox(settings.viewBox);

        target.fit = function () {
            // fit viewport to bounding box
            var bbox = svg.getBBox();
            var vB = "" + bbox.x + " " + bbox.y + " " + bbox.width + " " + bbox.height;
            target.viewBox(vB);
            return target;
        };

        target.svgDelete = function (names) {
            for (var i = 0; i < names.length; i++) {
                var name = names[i];
                var $element = $svg.named_elements[name];
                if ($element) {
                    $element.remove();
                    delete $svg.named_elements[name];
                }
            }
            return target;
        };

        target.simplifiedEvent = function (event) {
            // simplified event designed for calling back to Python in Jupyter proxy widgets.
            var info = {};
            var event_target = event.target;
            for (var attr in event) {
                var val = event[attr];
                var ty = typeof val;
                if (ty == "number" || ty == "string" || ty == "boolean") {
                    info[attr] = val;
                }
            }
            info.name = event_target.widget_name;
            var ept = target.event_location(event);
            info.svgX = ept.x;
            info.svgY = ept.y;
            return info;
        };

        target.on_svg_event = function (event_types_string, callback, target_name, unfiltered) {
            var event_target = $svg; // default
            if (target_name) {
                event_target = $svg.named_elements[target_name];
            }
            var unfiltered_handler = callback;
            if (!unfiltered) {
                // Use simplified events.
                unfiltered_handler = function (event) {
                    var filtered_event = target.simplifiedEvent(event);
                    event.stopPropagation();
                    return callback(filtered_event);
                };
            }
            event_target.on(event_types_string, unfiltered_handler);
            return target;
        };

        target.off_svg_event = function (event_types_string, target_name) {
            var event_target = $svg; // default
            if (target_name) {
                event_target = $svg.named_elements[target_name];
            }
            event_target.off(event_types_string);
        };

        target.set_rotation = function (atts, x, y, degrees) {
            if (degrees) {
                atts.transform = "rotate(" + degrees + "," + x + "," + y + ")";
            }
        };

        target.circle = function (name, cx, cy, r, fill, atts, style) {
            var combined_atts = $.extend({
                "cx": cx,
                "cy": cy,
                "r": r,
                "fill": fill || "black"
            }, atts);
            target.add_element(name, "circle", combined_atts, style);
        };

        target.line = function (name, x1, y1, x2, y2, color, atts, style, degrees) {
            var combined_atts = $.extend({
                x1: x1,
                y1: y1,
                x2: x2,
                y2: y2,
                stroke: color || "black"
            }, atts);
            target.set_rotation(combined_atts, x1, y1, degrees);
            target.add_element(name, "line", combined_atts, style);
        };

        target.text = function (name, x, y, text, fill, atts, style, degrees) {
            var combined_atts = $.extend({
                x: x,
                y: y,
                fill: fill || "black"
            }, atts);
            target.set_rotation(combined_atts, x, y, degrees);
            target.add_element(name, "text", combined_atts, style, text);
        };

        target.rect = function (name, x, y, w, h, fill, atts, style, degrees) {
            var combined_atts = $.extend({
                x: x,
                y: y,
                width: w,
                height: h,
                fill: fill || "black"
            }, atts);
            target.set_rotation(combined_atts, x, y, degrees);
            target.add_element(name, "rect", combined_atts, style);
        };

        target.polygon_points = function (points) {
            var L = [];
            for (var i = 0; i < points.length; i++) {
                var pi = points[i];
                L.push(" " + pi[0] + "," + pi[1]);
            }
            return L.join(" ");
        };

        target.polygon = function (name, points, fill, atts, style) {
            var combined_atts = $.extend({
                points: target.polygon_points(points),
                fill: fill || "black"
            }, atts);
            target.add_element(name, "polygon", combined_atts, style);
        };

        // serialize: https://stackoverflow.com/questions/28450471/convert-inline-svg-to-base64-string
        target.serialized_svg = function () {
            var serializer = new XMLSerializer();
            return serializer.serializeToString(target.$svg[0]);
        };

        target.serialized_svg_image = function () {
            var $image = $("<img/>");
            var image = $image[0];
            var svg = target.$svg[0];
            image.style.width = svg.style.width;
            image.style.height = svg.style.height;
            var svg_text = target.serialized_svg();
            image.src = 'data:image/svg+xml;base64,' + window.btoa(svg_text);
            return $image;
        };

        return target;
    };

    $.fn.svg_widget_helper.example = function (element) {
        element.empty();
        element.css("background-color", "cornsilk").width("200px");
        element.svg_widget_helper(element, { viewBox: "-100 -100 200 200" });
        var points = [[0, 90], [90, 0], [0, -90], [-70, 20]];
        element.polygon("poly", points, "#dfd");
        element.circle("green circle", 60, -70, 20, "green");
        element.line("a line", -10, 20, 30, 30, "red", 0, { "stroke-width": 5 }, null, 100);
        element.rect("a rect", -10, -50, 10, 120, "salmon", null, null, 15);
        element.text("some text", -40, -40, "SVG", "#444",
        //{transform: "rotate(30 -40,-40)"});
        null, null, 45);
        var status = $("<div>The circle hasn't been clicked</div>").appendTo(element);
        var controls = $("<div/>").appendTo(element);
        var snap_button = $("<button>Snapshot</button>").appendTo(controls);
        snap_button.click(function () {
            element.serialized_svg_image().appendTo(element);
        });
        var del_button = $("<button>Delete text</button>").appendTo(controls);
        del_button.click(function () {
            element.svgDelete(["some text"]);
        });
        var count = 0;
        var info = function (s) {
            count += 1;
            status.html("<div>" + count + " " + s + "</div>");
        };
        var put_circle = function (event) {
            var x = event.svgX;
            var y = event.svgY;
            info("put circle " + x + " " + y);
            element.change_element("green circle", { cx: x, cy: y });
        };
        var drop_circle = function (event) {
            info("dropping circle");
            element.off_svg_event("mousemove click");
            element.on_svg_event("click", pick_up_circle, "green circle");
        };
        var pick_up_circle = function (event) {
            info("picking up circle " + event.name);
            element.on_svg_event("mousemove", put_circle);
            element.on_svg_event("click", drop_circle);
            element.off_svg_event("click", "green circle");
        };
        element.on_svg_event("click", pick_up_circle, "green circle");
    };
})(jQuery);