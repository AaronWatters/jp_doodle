/*
JQuery plugin helper for a 2d slider over a rectangular region.
Uses canvas_2d_widget_helper, dual_canvas_helper
Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/
*/

(function($) {

    class XYSlider {
        constructor(options, target) {
            this.target = target;
            target.bounded_slider = this;
            this.settings = $.extend({
                length: 500,
                xmin: -180,
                xmax: 180,
                ymin: -90,
                ymax: 90,
                initialx: 0,
                initialy: 0,
                on_change: null,
                radius: 5,
                selected_radius: 8,
                base_color: "silver",
                current_color: "cyan",
                line_color: "black",
                verbose: false,
                call_on_init: true,
                border: 5,
            }, options);
            var s = this.settings;
            // create canvas and reference frame
            var padded_length = s.length + 2 * s.border;
            target.dual_canvas_helper({
                width: padded_length,
                height: padded_length,
            });
            if (s.verbose) {
                this.info_area = $("<div>info area</div>").appendTo(target);
            }
            var frame = target.frame_region(
                s.border, s.border, s.length + s.border, s.length + s.border,
                s.xmin, s.ymin, s.xmax, s.ymax
            )
            this.frame = frame;
            this.mouse_down = this.mouse_down_handler();
            this.mouse_move = this.mouse_move_handler();
            this.mouse_up = this.mouse_up_handler();
            this.background_click = this.background_click_handler();
            // Draw canvas objects.
            // Background rectangle.
            frame.frame_rect({x:s.xmin, y:s.ymin, w:(s.xmax - s.xmin), h:(s.ymax - s.ymin), color:s.base_color});
            // tracking circle and lines
            this.current_x = s.initialx;
            this.current_y = s.initialy;
            this.tracking_line_x = frame.line({
                x1:this.current_x, y1:s.ymin, x2:this.current_x, y2:s.ymax, color:s.line_color, name:true
            });
            this.tracking_line_y = frame.line({
                x1:s.xmin, y1:this.current_y, x2:s.xmax, y2:this.current_y, color:s.line_color, name:true
            });
            this.tracking_circle = frame.circle({x:this.current_x, y:this.current_y, r:s.radius, color:s.current_color, name:true});
            // Invisible rect for catching events
            this.event_rectangle = frame.frame_rect({x:s.xmin, y:s.ymin, w:(s.xmax - s.xmin), h:(s.ymax - s.ymin), 
                color:"rgba(0,0,0,0)", name:true});
            //this.assign_event_handlers(this.event_rectangle);
            var ob = this.event_rectangle;
            ob.on("mousedown", this.mouse_down);
            ob.on("mousemove", this.mouse_move);
            ob.on("mouseup", this.mouse_up);
            ob.on("mouse_out", this.mouse_up)
            ob.on("click", this.background_click)
            this.tracking_mouse = false;
            //target.fit();
            if ((s.call_on_init) && (s.on_change)) {
                s.on_change(this.current_x, this.current_y);
            }
        };
        current_xy () {
            return {
                x: this.current_x,
                y: this.current_y,
            }
        }
        info(message) {
            if (this.settings.verbose) {
                this.info_area.html(message);
            }
        };
        background_click_handler() {
            var that = this;
            return function(event) {
                that.mouse_down(event);
                //that.mouse_move(event);  // implicit on mouse_down
                that.mouse_up(event);
            };
        };
        mouse_down_handler() {
            var that = this;
            var s = this.settings;
            return function(event) {
                that.tracking_mouse = true;
                that.tracking_circle.change({r: s.selected_radius});
                that.mouse_move(event);
            };
        };
        mouse_move_handler() {
            var that = this;
            var s = this.settings;
            var on_change = s.on_change;
            return function(event) {
                if (that.tracking_mouse) {
                    var frame_location = that.frame.event_model_location(event);
                    var x = frame_location.x;
                    var y = frame_location.y;
                    that.tracking_circle.change({x:x, y:y, r:s.selected_radius});
                    that.tracking_line_x.change({x1:x, x2:x});
                    that.tracking_line_y.change({y1:y, y2:y})
                    that.current_x = x;
                    that.current_y = y;
                    if (on_change) {
                        on_change(x, y)
                    }
                }
            };
        };
        mouse_up_handler() {
            var that = this;
            var s = this.settings;
            return function(event) {
                that.tracking_mouse = false;
                that.tracking_circle.change({r:s.radius});
            };
        };
    };

    $.fn.xy_slider = function (options) {
        var target = this;
        return new XYSlider(options, target);
    };

})(jQuery)