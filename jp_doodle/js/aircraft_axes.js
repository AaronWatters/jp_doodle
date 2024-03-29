/*
JQuery plugin helper for a 2d slider over a rectangular region.
Uses canvas_2d_widget_helper, dual_canvas_helper
Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/
*/

(function($) {

    // model coordinates
    const A = [0, 0, 2];
    const B = [1, 0, 0];
    const C = [-1, 0, 0];
    const D = [0, 1, 0];
    const E = [-2, -1, -1];
    const F = [-1, 0, -1];
    const G = [1, 0, -1];
    const H = [2, -1, -1];
    const I = [0, 0, -1];
    const J = [1, 0, -2];
    const K = [-1, 0, -2];

    const airplane_triangle_coords = [
        [A,B,C],
        [D,B,A],
        [D,A,C],
        [E,F,C],
        [G,B,H],
        [I,G,J],
        [I,F,K],
    ];

    const eye3x3 = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
    ];

    function xy_project(triple, z_offset) {
        const [x, y, z] = triple;
        const scale = 1.0 / (z_offset - z);
        return [scale * x, scale * y];
    };

    function Mv_product(matrix, triple) {
        var result = [];
        for (var i=0; i<3; i++) {
            var value = 0;
            for (var j=0; j<3; j++) {
                value += matrix[i][j] * triple[j];
            }
            result.push(value);
        }
        return result;
    };

    function MM_product(Mleft, Mright) {
        var result = [];
        for (var i=0; i<3; i++) {
            var row = [];
            for (var j=0; j<3; j++) {
                var resultij = 0;
                for (var k=0; k<3; k++) {
                    resultij += Mleft[i][k] * Mright[k][j];
                }
                row.push(resultij);
            }
            result.push(row);
        }
        return result;
    };

    function centroid(triples) {
        var ln = triples.length;
        var result = [];
        for (var i=0; i<3; i++) {
            var total = 0
            for (var j=0; j<ln; j++) {
                total += triples[j][i];
            }
            result.push( total * (1.0 / ln));
        }
        return result;
    };

    class Triangle {
        constructor(triples) {
            if (triples.length != 3) {
                console.log("bad triangle triples", triples)
                throw new Error("bad triples")
            }
            this.triples = triples;
            this.projection = null;
            this.z_order = null;
        };
        project(matrix3x3) {
            //debugger;
            matrix3x3 = matrix3x3 || eye3x3;
            var projection = []
            for (var i=0; i<3; i++) {
                projection.push(Mv_product(matrix3x3, this.triples[i]))
            }
            this.projection = projection;
            var center = centroid(this.projection);
            this.z_order = center[2];
            return this;
        }
    };

    class Model {
        constructor(triangles_coords) {
            this.triangles = triangles_coords.map(x => new Triangle(x));
        };
        draw(on_frame, face_color, border_color, z_offset, matrix3x3) {
            //debugger;
            matrix3x3 = matrix3x3 || eye3x3;
            var projected = this.triangles.map(x => x.project(matrix3x3));
            projected.sort(function(ta, tb) { return ta.z_order - tb.z_order })
            for (var triangle of projected) {
                var xyprojections = triangle.projection.map(triple => xy_project(triple, z_offset));
                on_frame.polygon({
                    points: xyprojections,
                    color: face_color,
                    fill: true,
                });
                on_frame.polygon({
                    points: xyprojections,
                    color: border_color,
                    fill: false,
                    lineWidth: 2,
                });
            }
        };
    }

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
    const u_key = 85;
    const d_key = 68;
    const arrow_delta = PI / 180.0;
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
                plane_face_color: "bisque",
                plane_line_color: "maroon",
                plane_offset: 5,
                verbose: true,
                call_on_init: true,
            }, options);
            var s = this.settings;

            // create paper airplane graphic model
            this.airplane = new Model(airplane_triangle_coords);

            // create canvas and reference frames
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
            var static_frame = target.frame_region(
                square_margin, square_margin, square_margin + square_side, square_margin + square_side,
                -PI, -PI, PI, PI
            );
            var model_frame = target.frame_region(
                square_margin, square_margin, square_margin + square_side, square_margin + square_side,
                -0.5, -0.5, 0.5, 0.5,
            );
            this.model_frame = model_frame;
            var frame = target.frame_region(
                square_margin, square_margin, square_margin + square_side, square_margin + square_side,
                -PI, -PI, PI, PI
            );
            this.frame = frame;

            // Draw static visible elements
            // roll circle
            static_frame.circle({x: 0, y: 0, r:circle_radius, color:s.circle_color});
            // pitch/yaw square
            static_frame.frame_rect({x:-PI, y:-PI, w:PI2, h:PI2, color:s.square_color});
            // reference lines above paper airplane model
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
        matrix3x3() {
            var roll = this.current_roll;
            var cr = Math.cos(roll);
            var sr = Math.sin(roll);
            var rollM = [
                [cr, -sr, 0],
                [sr, cr, 0],
                [0, 0, 1],
            ];
            var pitch = this.current_pitch;
            var cp = Math.cos(pitch);
            var sp = Math.sin(pitch);
            var pitchM = [
                [cp, 0, sp],
                [0, 1, 0],
                [-sp, 0, cp],
            ]
            var rpM = MM_product(pitchM, rollM)
            var yaw = this.current_yaw;
            var cy = Math.cos(yaw);
            var sy = Math.sin(yaw)
            var yawM = [
                [1, 0, 0],
                [0, cy, sy],
                [0, -sy, cy],
            ]
            var rpyM = MM_product(yawM, rpM);
            return rpyM;
        }
        report() {
            // draw the airplane
            var s = this.settings;
            this.model_frame.reset_frame();
            var face_color = s.plane_face_color;
            var border_color = s.plane_line_color;
            var z_offset = s.plane_offset;
            var matrix3x3 = this.matrix3x3();
            this.airplane.draw(this.model_frame, face_color, border_color, z_offset, matrix3x3);
            if (this.settings.verbose) {
                var deg = this.current_degrees();
                var msg = "r(u/d)=" + deg.roll + "; p\u21c4=" + deg.pitch + "; y\u21c5=" + deg.yaw;
                this.info(msg);
            }
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
                var num = event.keyCode;
                console.log(event, "keypress: ", num)
                var y = that.current_yaw;
                var x = that.current_pitch;
                var roll = that.current_roll;
                var handled = false;
                if (num == u_key) {
                    handled = true;
                    roll += arrow_delta;
                    if (roll > PI) {
                        roll -= PI2;
                    }
                }
                if (num == d_key) {
                    handled = true;
                    roll -= arrow_delta;
                    if (roll < -PI) {
                        roll += PI2;
                    }
                }
                if (num == up_arrow_key) { //} && (y < arrow_boundary)) {
                    handled = true;
                    y = y + arrow_delta;
                }
                if (num == down_arrow_key) { //} && (y > - arrow_boundary)) {
                    handled = true;
                    y = y - arrow_delta;
                }
                if (num == right_arrow_key) { //} && (x < arrow_boundary)) {
                    handled = true;
                    x = x + arrow_delta;
                }
                if (num == left_arrow_key) { //&& (x > - arrow_boundary)) {
                    handled = true;
                    x = x - arrow_delta;
                }
                if (handled) {
                    const fix = function(v) {
                        if (v < - PI) {
                            v = v + PI2;
                        }
                        if (v > PI) {
                            v = v - PI2
                        }
                        return v;
                    }
                    x = fix(x);
                    y = fix(y);
                    event.preventDefault(); // don't propagate
                    that.current_yaw = y;
                    that.current_pitch = x;
                    that.current_roll = roll;
                    that.pitch_yaw_marker.change({x:x, y:y});
                    var cy = Math.sin(roll) * that.frame_circle_radius;
                    var cx = Math.cos(roll) * that.frame_circle_radius;
                    that.roll_marker.change({x:cx, y:cy});
                    that.report();
                    if (on_change) {
                        on_change(that.current_coords())
                    }
                }
            };
        };
        reset_coords(yaw, pitch, roll) {
            this.current_yaw = yaw || 0;
            this.current_pitch = pitch || 0;
            this.current_roll = roll || 0;
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
                that.report();
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