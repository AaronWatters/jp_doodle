/*

JQuery plugin helper for a slider with lower and upper bounds as well as value.

Uses canvas_2d_widget_helper, dual_canvas_helper

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/

(function($) {

    var HIGH = "HIGH";
    var LOW = "LOW";
    var CURRENT = "CURRENT";

    class  BoundedValueSlider {

        constructor(options, target) {
            this.target = target;
            target.bounded_slider = this;
            this.settings = $.extend({
                horizontal: true,
                length: 500,
                aspect_ratio: 0.2,
                minimum: 0,
                maximum: 100,
                initial: null,
                integral: false,
                on_change: null,
                on_stop: null,
                radius: 10,
                selected_radius: 15,
                base_color: "silver",
                low_color: "royalblue",
                high_color: "orange",
                current_color: "cyan",
                forbidden:"black",
                verbose: false,
                call_on_init: true,
                border: 5,
            }, options);
            var s = this.settings;
            // create canvas and reference frame
            var breadth = s.length * s.aspect_ratio;
            var width, height;
            if (s.horizontal) {
                width = s.length;
                height = breadth;
            } else {
                width = breadth;
                height = s.length;
            }
            target.dual_canvas_helper({
                width: width + s.border,
                height: height + s.border,
            });
            if (s.verbose) {
                this.info_area = $("<div>info area</div>").appendTo(target);
            }
            var frame;
            if (s.horizontal) {
                // same coordinates
                frame = target.rframe();
            } else {
                // switch x and y
                frame = target.vector_frame({x: 0, y: 1}, {x: 1, y: 0});
            }
            this.frame = frame;
            // set up constants
            this.diff = s.maximum - s.minimum;
            var mid = 0.5 * (s.maximum  + s.minimum);
            if (s.initial === null) {
                s.initial = mid;
            }
            var ratio = (s.initial - s.minimum) * 1.0 / this.diff
            if ((ratio > 1) || (ratio < 0)) {
                s.initial = mid;
            }
            this.circle_names = [LOW, HIGH, CURRENT]
            var circle_colors = [s.low_color, s.high_color, s.current_color];
            var cinit = this.model_to_canvas(s.initial);
            this.canvas_positions = [0, s.length, cinit];
            // event handlers
            this.mouse_down = this.mouse_down_handler();
            this.mouse_move = this.mouse_move_handler();
            this.mouse_up = this.mouse_up_handler();
            this.background_click = this.background_click_handler();
            // Draw canvas objects.
            var b2 = breadth / 2.0;
            //this.breadth2 = b2;
            var b3 = breadth / 3.0;
            // Objects that should not recieve events go undernieth the event_rectangle.
            // fixed reference rectangle
            frame.frame_rect({x:-s.radius, y:b3, w:s.length+2*s.radius, h:b3, color:s.base_color});
            // Forbidden value rectangles:
            this.forbidden_low = frame.frame_rect({x:0, y:0, w:0, h:breadth, name:true, color: s.forbidden})
            this.forbidden_high = frame.frame_rect({x:s.length, y:0, w:0, h:breadth, name:true, color: s.forbidden})
            // Invisible rect for catching events
            this.event_rectangle = frame.frame_rect({x:0, y:0, w:s.length, h:breadth, name:true, color:"rgba(0,0,0,0)"});
            this.assign_event_handlers(this.event_rectangle);
            this.event_rectangle.on("mouse_out", this.mouse_up)
            this.event_rectangle.on("click", this.background_click)

            // Marker circles
            this.circles = [];
            this.name_to_index = {}
            for (var i=0; i<3; i++) {
                var name = this.circle_names[i];
                var position = this.canvas_positions[i];
                var color = circle_colors[i];
                if (name == CURRENT) {
                    var circle = frame.circle({x: position, y: b2, r:s.radius, color: color, name: name})
                }
                else if (name == LOW) {
                    //var circle = frame.circle({x: position, y: b2, r:s.radius, color: color, name: name});
                    var circle = frame.frame_rect({
                        x: position, 
                        y: b2, 
                        w: 2 * s.radius, 
                        h:4 * s.radius, 
                        dx:- 2 * s.radius,
                        dy:- 2 * s.radius,
                        color: color,
                        name:name,
                    });
                }
                else if (name == HIGH) {
                    //var circle = frame.circle({x: position, y: b2, r:s.radius, color: color, name: name})
                    var circle = frame.frame_rect({
                        x: position, 
                        y: b2, 
                        w: 2 * s.radius, 
                        h:4 * s.radius, 
                        dx:0,
                        dy:- 2 * s.radius,
                        color: color,
                        name:name,
                    });
                } else {
                    throw new Error("unknown name: " + name);
                }
                this.circles.push(circle);
                this.name_to_index[name] = i;
                this.assign_event_handlers(circle);
            }
            target.fit();
            this.moving_name = null;
            this.circle_order = {LOW: 0, CURRENT: 1, HIGH: 3};
            this.last_changed = "HIGH";
            if ((s.call_on_init) && (s.on_stop)) {
                s.on_stop(this.values_mapping())
            }
        };
        info(message) {
            if (this.settings.verbose) {
                this.info_area.html(message);
            }
        }
        assign_event_handlers(ob) {
            ob.on("mousedown", this.mouse_down);
            ob.on("mousemove", this.mouse_move);
            ob.on("mouseup", this.mouse_up);
        }
        background_click_handler() {
            var that = this;
            // pretend the current circle was moved
            return function(event) {
                that.moving_name = CURRENT;
                event.canvas_name = CURRENT;
                that.last_changed = CURRENT;
                that.moving_offset = 0;
                that.mouse_move(event);
                that.mouse_up(event);
            };
        };

        mouse_down_handler() {
            var that = this;
            return function(event) {
                if (that.moving_name) {
                    // stop moving
                    return that.mouse_up(event);
                }
                var name = event.canvas_name;
                if (that.settings.verbose) {
                    that.info("mouse down: " + name);
                }
                var index = that.name_to_index[name];
                if ( (typeof index) == "number" ) {
                    var location = event.model_location;
                    var click_x = location.x;
                    var object_x = that.canvas_positions[index];
                    that.moving_name = name;
                    that.last_changed = name;
                    that.moving_offset = object_x - click_x;
                    var circle = that.circles[index];
                    var sr = that.settings.selected_radius;
                    circle.change({
                        r: sr,
                        h: 6 * sr, 
                        dy:- 3 * sr,
                    });
                }
            }
        };
        mouse_move_handler() {
            var that = this;
            return function(event) {
                var moving_name = that.moving_name;
                if (moving_name) {
                    var offset = that.moving_offset;
                    var event_x = event.model_location.x;
                    var move_x = offset + event_x;
                    var length = that.settings.length;
                    if (move_x < 0) {
                        move_x = 0;
                    }
                    if (move_x > length) {
                        move_x = length;
                    }
                    that.update_positions(moving_name, move_x)
                    if (that.settings.verbose) {
                        that.info("mouse move: " + moving_name + " event " + event_x +" move " + move_x + " len " + length);
                    }
                }
            }
        };
        mouse_up_handler() {
            var that = this;
            return function(event) {
                if (that.settings.verbose) {
                    that.info("mouse up");
                }
                that.moving_name = null;
                var r = that.settings.radius;
                that.moving_offset = null;
                for (var i=0; i<3; i++) {
                    that.circles[i].change({
                        r: r,
                        h: 4 * r, 
                        dy:- 2 * r,
                    })
                }
                var on_stop = that.settings.on_stop
                if (on_stop) {
                    on_stop(that.values_mapping())
                }
            }
        };
        values_mapping () {
            var result = {};
            result.last_changed = this.last_changed;
            var n2i = this.name_to_index;
            var positions = this.canvas_positions;
            for (var circle in n2i) {
                result[circle] = this.canvas_to_model(positions[n2i[circle]])
            }
            return result;
        };
        update_model(moving_name, model_value) {
            var canvas_value = this.model_to_canvas(model_value);
            return this.update_positions(moving_name, canvas_value, true);
        };
        update_positions(moving_name, value, no_callback) {
            var index = this.name_to_index[moving_name];
            var positions = this.canvas_positions;
            positions[index] = value;
            var order = this.circle_order;
            var moving_order = order[moving_name];
            var names = this.circle_names;
            var circles = this.circles;
            var s = this.settings;
            var radius = s.radius;
            var selected_radius = s.selected_radius;
            for (var i=0; i<3; i++) {
                var name = names[i];
                var name_order = order[name];
                var old = positions[i];
                if ( ((name_order < moving_order) && (old > value)) || ((name_order > moving_order) && (old < value)) ) {
                    positions[i] = value;
                }
            }
            for (var i=0; i<3; i++) {
                var r = radius;
                if (i == index) {
                    r = selected_radius;
                }
                var x = positions[i];
                circles[i].change({x: x, r: r})
            }
            var low_limit = positions[0];
            var high_limit = positions[1];
            this.forbidden_low.change({w: low_limit})
            this.forbidden_high.change({w: -s.length+high_limit});
            if ((!no_callback) && (s.on_change)) {
                s.on_change(this.values_mapping())
            }
        };
        model_to_canvas(x_model) {
            var s = this.settings;
            return s.length * (x_model - s.minimum) * (1.0 / this.diff);
        };
        canvas_to_model(x_canvas){
            var s = this.settings;
            var result = s.minimum + this.diff * x_canvas / (1.0 * s.length);
            if (s.integral) {
                result = Math.round(result);
            }
            return result;
        };
    };

    $.fn.bounded_value_slider = function (options) {
        var target = this;
        return new BoundedValueSlider(options, target);
    };

})(jQuery);
