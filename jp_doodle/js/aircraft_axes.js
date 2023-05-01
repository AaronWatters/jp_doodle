/*
JQuery plugin helper for a 2d slider over a rectangular region.
Uses canvas_2d_widget_helper, dual_canvas_helper
Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/
*/

(function($) {

    // tracking state constants (also null)
    const PITCH_YAW = "pitch_yaw";
    const ROLL = "roll"

    const PI = Math.PI;  // for convenience
    const RAD2DEG = 180.0 / PI;
    const PI2 = 2 * PI;
    
    const up_arrow_key = 38;
    const down_arrow_key = 40;
    const left_arrow_key = 37;
    const right_arrow_key = 39;
    const arrow_delta = 0.2;
    const arrow_boundary = PI - arrow_delta;

    const clampPI = (num) => Math.min(Math.max(num, -PI), PI)

    const int_degrees = (num) => Math.floor(num * RAD2DEG)

    class AircraftAxes {
        constructor(options, container) {
            var that = this;
            //this.target = target;
            this.container = container;
            var target = $("<div/>").appendTo(container);
            this.target = target;

            target.bounded_slider = this;
            this.settings = $.extend({
                width: 500,
                circle_diameter_ratio: 0.9,
                square_side_ratio: 0.6,
                on_change: null,
                marker_radius: 5,
                selected_radius: 8,
                circle_color: "silver",
                square_color: "cyan",
                marker_color: "orange",
                reference_color: "white",
                verbose: true,
                call_on_init: true,
            }, options);
            var s = this.settings;
            // create canvas and reference frame
            target.dual_canvas_helper({
                width: s.width,
                height: s.width,
            });
            if (s.verbose) {
                this.info_area = $("<div>info area</div>").appendTo(target);
            }
            var circle_radius = 0.5 * s.circle_diameter_ratio * s.width;
            var square_side = s.square_side_ratio * s.width;
            this.frame_circle_radius = PI * circle_radius / (0.5 * square_side);
            var square_margin = 0.5 * (s.width - square_side);
            //var circle_margin = 0.5 * s.width - circle_radius;
            // frame in radians
            var frame = target.frame_region(
                square_margin, square_margin, square_margin + square_side, square_margin + square_side,
                -PI, -PI, PI, PI
            )
            this.frame = frame;

            // Draw visible elements
            // roll circle
            frame.circle({x: 0, y: 0, r:circle_radius, color:s.circle_color});
            // pitch/yaw square
            frame.frame_rect({x:-PI, y:-PI, w:PI2, h:PI2, color:s.square_color});
            // reference lines
            for (var i=-1; i<2; i++) {
                var offset = i * 0.5 * PI;
                //("offset", offset)
                frame.line({x1:-PI, y1:offset, x2:PI, y2:offset, color:s.reference_color});
                frame.line({y1:-PI, x1:offset, y2:PI, x2:offset, color:s.reference_color});
            }
            // roll marker
            this.roll_marker = frame.circle({x: this.frame_circle_radius, y:0, r:s.marker_radius, color:s.marker_color, name:"roll-marker"});
            // pitch/yaw marker
            this.pitch_yaw_marker = frame.circle({x:0, y:0, r:s.marker_radius, color:s.marker_color, name:"pitch-yaw-marker"});

            // Overlay event regions
            var transparent = "rgba(0,0,0,0)";
            this.roll_event = frame.circle({x: 0, y: 0, r:circle_radius, color:transparent, name:ROLL});
            this.pitch_yaw_event = frame.frame_rect({x:-PI, y:-PI, w:PI2, h:PI2, color:transparent, name:PITCH_YAW});

            // Add "reset link"
            this.reset_text = target.text({x:5, y:5, text:"reset", color:"blue", name:"reset"});
            this.reset_text.on("click", function () { that.reset_coords(); });

            this.tracking_state = null;  // not tracking anything yet.
            this.current_pitch = 0;
            this.current_yaw = 0;
            this.current_roll = 0;
            
            this.mouse_down = this.mouse_down_handler();
            this.mouse_move = this.mouse_move_handler();
            this.mouse_up = this.mouse_up_handler();
            this.keypress = this.keypress_handler();
            //this.background_click = this.background_click_handler();
            target.on_canvas_event("mousedown", this.mouse_down);
            target.on_canvas_event("mousemove", this.mouse_move);
            target.on_canvas_event("mouseup", this.mouse_up);
            var keypress_target = container;
            console.log("adding keypress to", keypress_target)
            keypress_target.keydown(this.keypress);
            keypress_target.attr('tabindex', 0);
            keypress_target.focus();
            //target.fit();
            if ((s.call_on_init) && (s.on_change)) {
                s.on_change(this.current_coords());
            }
        };
        current_coords () {
            return {
                pitch: this.current_pitch,
                yaw: this.current_yaw,
                roll: this.current_roll,
            }
        };
        current_degrees () {
            var coords = this.current_coords();
            return {
                pitch: int_degrees(coords.pitch),
                yaw: int_degrees(coords.yaw),
                roll: int_degrees(coords.roll),
            }
        }
        info(message) {
            if (this.settings.verbose) {
                this.info_area.html(message);
            };
        };
        report() {
            var deg = this.current_degrees();
            var msg = "pitch=" + deg.pitch + "; yaw=" + deg.yaw + "; roll=" + deg.roll;
            this.info(msg);
        }
        mouse_down_handler() {
            var that = this;
            var s = this.settings;
            return function(event) {
                var name = event.canvas_name;
                // cancel if you are already tracking
                if (that.tracking_state) {
                    return that.mouse_up(event);
                } else {
                    if ((name == ROLL) || (name == PITCH_YAW)) {
                        that.tracking_state = name;
                        return that.mouse_move(event);
                    }
                }
            };
        };
        keypress_handler() {
            var that = this;
            var s = this.settings;
            var on_change = s.on_change;
            return function(event) {
                var num = event.which;
                console.log("keypress: ", num)
                var y = that.current_yaw;
                var x = that.current_pitch;
                var handled = false;
                if ((num == up_arrow_key) && (y < arrow_boundary)) {
                    handled = true;
                    y = y + arrow_delta;
                }
                if ((num == down_arrow_key) && (y > - arrow_boundary)) {
                    handled = true;
                    y = y - arrow_delta;
                }
                if ((num == right_arrow_key) && (x < arrow_boundary)) {
                    handled = true;
                    x = x + arrow_delta;
                }
                if ((num == left_arrow_key) && (x > - arrow_boundary)) {
                    handled = true;
                    x = x - arrow_delta;
                }
                if (handled) {
                    event.preventDefault(); // don't propagate
                    that.current_yaw = y;
                    that.current_pitch = x;
                    that.pitch_yaw_marker.change({x:x, y:y});
                    if (s.verbose) {
                        that.report();
                    }
                    if (on_change) {
                        on_change(that.current_coords())
                    }
                }
            };
        };
        reset_coords() {
            this.current_yaw = 0;
            this.current_pitch = 0;
            this.current_roll = 0;
            this.pitch_yaw_marker.change({x:0, y:0});
            this.roll_marker.change({x: this.frame_circle_radius, y:0});
            this.report();
            var on_change = this.settings.on_change;
            if (on_change) {
                on_change(this.current_coords());
            }
        };
        mouse_move_handler() {
            var that = this;
            var s = this.settings;
            var on_change = s.on_change;
            return function(event) {
                var name = that.tracking_state;
                if (name == ROLL) {
                    var frame_location = that.frame.event_model_location(event);
                    var x = frame_location.x;
                    var y = frame_location.y;
                    var absx = Math.abs(x);
                    var absy = Math.abs(y);
                    if ((absx < 0.1) && (absy < 0.1)) {
                        return;  // too close to origin -- ignore.
                    }
                    var theta = Math.atan2(y, x);
                    that.current_roll = theta;
                    var cy = Math.sin(theta) * that.frame_circle_radius;
                    var cx = Math.cos(theta) * that.frame_circle_radius;
                    that.roll_marker.change({x:cx, y:cy, r:s.selected_radius});
                } else if (name == PITCH_YAW) {
                    that.pitch_yaw_marker.change({r:s.selected_radius});
                    var frame_location = that.frame.event_model_location(event);
                    var x = clampPI(frame_location.x);
                    var y = clampPI(frame_location.y);
                    that.current_yaw = y;
                    that.current_pitch = x;
                    that.pitch_yaw_marker.change({x:x, y:y, r:s.selected_radius});
                } else {
                    return; // ignore
                }
                if (s.verbose) {
                    that.report();
                }
                if (on_change) {
                    on_change(that.current_coords())
                }
            };
        };
        mouse_up_handler() {
            var that = this;
            var s = this.settings;
            return function(event) {
                that.tracking_state = null;
                that.roll_marker.change({r:s.marker_radius});
                that.pitch_yaw_marker.change({r:s.marker_radius});
            };
        };
    };

    $.fn.aircraft_axes = function (options) {
        var target = this;
        return new AircraftAxes(options, target);
    };

})(jQuery)