/*

JQuery plugin helper for tree clustering diagrams

Assumes the element has been initialized using dual_canvas_helper.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/
"use strict";

(function($) {

    $.fn.cluster_tree = function (options, element) {
        element = element || this;

        class ClusterTree {
            constructor(options, element) {
                this.settings = $.extend({
                    normal_color: "black",
                    highlight_color: "red",
                    debug: false,
                    click_callback: null,
                    //node_radius: 5,
                    //tree: tree,
                    //frame: frame,
                    max_x: 300,
                    max_y: 300,
                    delta_depth: 10,
                }, options);
                //this.element = element;
                //this.depth = 0;
                //this.y_cursor = this.settings.y;
                this.max_depth = 1;
                this.start_depth = 0;
                this.end_depth = this.start_depth + this.settings.delta_depth;
                this.low = 0;
                this.high = 1;
                this.root = this.tree_node(this.settings.tree, null, 0);
                this.focus_node = this.root;
            }

            depth_range() {
                return Math.min(this.max_depth - this.focus_node.depth, this.settings.delta_depth)
            }

            depth_x(depth) {
                var ddepth = this.settings.max_x * (1.0 / this.depth_range());
                return ddepth * (depth - this.start_depth);
            }

            adjusted_y(offset) {
                var low = this.low;
                var high = this.high;
                var doffset = this.settings.max_y * (1.0 / (high - low));
                return (offset - low) * doffset;
            }

            stats(depth, highlow) {
                this.max_depth = Math.max(this.max_depth, depth);
                this.high = Math.max(this.high, highlow);
                this.low = Math.min(this.low, highlow);
                if (isNaN(this.max_depth) || isNaN(this.high) || isNaN(this.low)) {
                    throw new Error("bad stats " + [depth, highlow])
                }
            }

            tree_node(descriptor, parent, depth) {
                if (descriptor.above) {
                    return new InternalNode(this, descriptor, parent, depth);
                } else if ((descriptor.low) || (descriptor.high)) {
                    return new RangeNode(this, descriptor, parent, depth);
                } else {
                    return new LeafNode(this, descriptor, parent, depth);
                }
            }

            callback(low, high) {
                var click_callback = this.settings.click_callback;
                if (click_callback) {
                    click_callback(low, high, this.adjusted_y(low), this.adjusted_y(high))
                }
            }

            draw() {
                var frame = this.settings.frame;
                frame.reset_frame();
                this.focus_node.draw(this, frame);
                this.draw_backup_arrow(frame)
            }

            draw_backup_arrow(frame) {
                var that = this;
                var dx = this.settings.max_x * 0.05;
                var dy = this.settings.max_y * 0.05;
                var x0 = 0;
                var y0 = this.settings.max_y * 0.5;
                var xx = (x => x0 + x * dx);
                var yy = (y => y0 + y * dy);
                var points = [
                    [xx(0), yy(0)],
                    [xx(-2), yy(1)],
                    [xx(-2), yy(2)],
                    [xx(-5), yy(0)],
                    [xx(-2), yy(-2)],
                    [xx(-2), yy(-1)],
                ];
                frame.polygon({
                    points: points,
                    color: this.settings.normal_color,
                    close: true,
                    fill: false,
                    name: false,
                });
                if (that.focus_node.parent) {
                    var poly = frame.polygon({
                        points: points,
                        color: this.settings.normal_color,
                        close: true,
                        fill: true,
                        name: true,
                    });
                    poly.on("click", function () {
                        that.focus_on(that.focus_node.parent);
                    });
                    var root = frame.text({
                        text: "Go to ROOT",
                        x: xx(-5), y: yy(2.2), name:true,
                        color: "white", background: "black",
                    });
                    root.on("click", function () {
                        that.focus_on(that.root);
                    })

                }
            }

            focus_on(node) {
                node.selected = false;
                this.focus_node = node;
                this.low = this.focus_node.low;
                this.high = this.focus_node.high;
                this.start_depth = this.focus_node.depth;
                this.end_depth = Math.min(this.max_depth, this.focus_node.depth + this.settings.delta_depth)
                this.draw();
                //node.callback();
                this.callback(node.low, node.high)
            }
        }

        class ClusterNode {
            constructor(in_tree, descriptor, parent, depth) {
                this.in_tree = in_tree;
                parent = parent || null;
                depth = depth || 0;
                this.depth = depth;
                this.parent = parent;
                //this.y = in_tree.y_cursor;
                //in_tree.max_depth = Math.max(in_tree.max_depth, depth);
                this.selected = false;
                this.color = descriptor.color;
                this.init(descriptor);
            }
            draw_polygon(in_tree, frame, points) {
                var that = this;
                var ncolor = this.color || in_tree.settings.normal_color;
                var color = ncolor;
                if (this.selected) {
                    color = in_tree.settings.highlight_color;
                }
                var poly = frame.polygon({
                    points: points,
                    color: color,
                    close: true,
                    fill: true,
                    name: true,
                });
                poly.on("mouseover", function() {
                    that.selected = true;
                    poly.change({color: in_tree.settings.highlight_color})
                });
                poly.on("mouseout", function() {
                    that.selected = false;
                    poly.change({color: ncolor})
                });
                poly.on("click", function() {
                    that.callback();
                });
                frame.polygon({
                    points: points,
                    color: color,
                    close: false,
                    fill: false,
                });
            }
            x_left() {
                return this.in_tree.depth_x(this.depth);
            }
            x_right() {
                var in_tree = this.in_tree;
                return in_tree.depth_x(in_tree.end_depth);
            }
            y_offset() {
                return this.in_tree.adjusted_y(this.offset());
            }
            callback() {
                this.in_tree.focus_on(this);
                this.in_tree.callback(this.low, this.high)
            }
            range_points(in_tree) {
                var x_depth = in_tree.depth_x(this.depth + 1);
                var y_low = in_tree.adjusted_y(this.low);
                var y_high = in_tree.adjusted_y(this.high);
                var points = [
                    [x_depth, y_low],
                    [this.x_left(), this.y_offset()],
                    [x_depth, y_high],
                ];
                return points;
            }
        }

        class InternalNode extends ClusterNode {
            draw(in_tree, frame) {
                if (this.depth < in_tree.start_depth) {
                    throw new Error("draw should not be called with depth to high for tree " + this.depth);
                }
                if (this.depth+1 < in_tree.end_depth) {
                    var points = [
                        [this.above.x_left(), this.above.y_offset()],
                        [this.above.x_right(), this.above.y_offset()],
                        [this.above.x_left(), this.above.y_offset()],
                        [this.x_left(), this.y_offset()],
                        [this.below.x_left(), this.below.y_offset()],
                        [this.below.x_right(), this.below.y_offset()],
                        [this.below.x_left(), this.below.y_offset()],
                    ]
                    this.draw_polygon(in_tree, frame, points);
                    this.above.draw(in_tree, frame);
                    this.below.draw(in_tree, frame);
                } else  {
                    this.draw_polygon(in_tree, frame, this.range_points(in_tree));
                }
            }

            init(descriptor) {
                var depth = this.depth + 1;
                var in_tree = this.in_tree;
                this.above = in_tree.tree_node(descriptor.above, this, depth);
                this.below = in_tree.tree_node(descriptor.below, this, depth);
                this.low = this.above.low;
                this.high = this.below.high;
            }

            x_right() {
                return this.x_left();
            }
            offset() {
                return 0.5 * (this.above.offset() + this.below.offset());
            }
        }
        class RangeNode extends ClusterNode {
            draw(in_tree, frame) {
                this.draw_polygon(in_tree, frame, this.range_points(in_tree));
            }
            x_right() {
                return this.x_left();
            }
            init(descriptor) {
                var depth = this.depth+1;
                var in_tree = this.in_tree;
                this.low = descriptor.low;
                this.high = descriptor.high;
                in_tree.stats(depth, this.low);
                in_tree.stats(depth, this.high);
            }
            offset() {
                return 0.5 * (this.high + this.low);
            }
        }
        class LeafNode extends ClusterNode {
            draw(in_tree, frame) {
                var color = this.color || "cyan";
                frame.text({
                    text: "" + this.identifier,
                    x: this.x_right(), y: this.y_offset(),
                    align: "center", valign: "center", color: color,
                })
            }
            init(descriptor) {
                this.identifier = descriptor.identifier;
                this.in_tree.stats(this.depth, this.identifier);
                this.low = this.identifier;
                this.high = this.identifier;
            }
            offset() {
                return this.identifier;
            }
        }

        return new ClusterTree(options, element);
    };

    $.fn.cluster_tree.example = function(element) {
        var canvas_config = {
            width: 600,
            height: 400,
            //translate_scale: {x: x, y:y, w:w, h:h},
        };
        element.dual_canvas_helper(canvas_config);
        var frame = element.rframe();
        var info = $("<div>info area</div>").appendTo(element);
        var click_callback = function(low, high, low_y, high_y) {
            info.html("click: " + [low, high, low_y, high_y]);
            frame.forget_objects(["highlight"]);
            frame.rect({
                x: 300,
                y: low_y,
                h: high_y - low_y,
                w: 20,
                color: "salmon",
                name: "highlight"
            })
        }
        var tree = {
            color: "#699",
            //split: 2,
            above: {
                color: "green",
                //split: 0,
                above: {
                    color: "blue",
                    low: -3,
                    high: 0,
                },
                below: {
                    color: "cyan",
                    //split: 1,
                    above: {
                        color: "magenta",
                        identifier: 1,
                    },
                    below: {
                        color: "#990",
                        identifier: 2,
                    },
                },
            },
            below: {
                color: "#0f9",
                //split: 3,
                above: {
                    identifier: 3,
                },
                below: {
                    color: "#9f0",
                    identifier: 4,
                }
            },
        };
        var options = {
            frame: frame,
            tree: tree,
            max_x: 300,
            max_y: 300,
            debug: true,
            click_callback: click_callback,
            //delta_depth: 2,
        };
        var tree = element.cluster_tree(options);
        tree.draw();
        element.fit();
    };

})(jQuery);