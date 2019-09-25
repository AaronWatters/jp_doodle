/*

JQuery plugin helper for gradient descent based graph layout.

Requires nd_frame to be loaded.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/
"use strict";


(function($) {

    $.fn.gd_graph = function (options, element) {
        //element = element || this;  not needed?

        class GD_Graph {
            constructor(options, element) {
                var settings = $.extend({
                    origin_radius: 200000.0,
                    separator_radius: 6.0,
                    link_radius: 2.0,
                    link_height: 10.0,
                    origin_height: 1.0,
                    separation_height: 20.0,
                    epsilon: 1e-6,
                    probe_limit: 10,
                    probe_callback: null,
                    probe_shrink: 0.7,
                    probe_expand: 1.5,
                    min_change: 0.1,
                }, options);
                this.settings = settings;
                this.root = null;
                this.penalty = 0.0;
                this.node_name_to_descriptor = {};
                this.edge_key_to_descriptor = {};
                this.group_to_nodemap = {};
                this.matrix_op = jQuery.fn.nd_frame.matrix_op;
                this.calibrate();
            };

            calibrate() {
                var s = this.settings;
                s.origin_scale = s.origin_height * 1.0 / (s.origin_radius ** 2)
                s.link_scale = s.link_height * 1.0 / (s.link_radius ** 2)
                s.separation_scale = s.separation_height * 1.0 / (s.separator_radius ** 2)
            }

            get_or_make_node(name) {
                var node = this.node_name_to_descriptor[name];
                if (!node) {
                    node = new GD_Node(name, this);
                    this.node_name_to_descriptor[name] = node;
                }
                return node;
            };

            get_node(name) {
                return this.node_name_to_descriptor[name];
            };

            add_edge(node_name1, node_name2, weight, skip_duplicate) {
                if (node_name1 == node_name2) {
                    // error?
                    return null;
                }
                var e = new GD_Edge(node_name1, node_name2, weight, this);
                var k = e.key;
                var e2d = this.edge_key_to_descriptor;
                if (e2d[k]) {
                    if (skip_duplicate) {
                        return;
                    }
                    throw new Error("duplicate edge not permitted: " + k);
                }
                e2d[k] = e;
                this.get_or_make_node(node_name1);
                this.get_or_make_node(node_name2);
                return e;
            };

            xy(xy) {
                return this.matrix_op.as_vector(xy, ["x", "y"]);
            };

            neighbors(group) {
                // find all neighboring nodes to group as name: node mapping.
                var i = group.x;
                var j = group.y;
                var g2nm = this.group_to_nodemap;
                var result = {};
                for (var ii=i-1; ii<=i+1; ii++) {
                    for (var jj=j-1; jj<=j+1; jj++) {
                        var index = this.group_name(ii, jj);
                        var block = g2nm[index];
                        if (block) {
                            for (var name in block) {
                                result[name] = block[name];
                            }
                        }
                    }
                }
                return result;
            };

            group(position, node) {
                var g2nm = this.group_to_nodemap;
                var group = this.group_index(position);
                node.group = group;
                var nm = g2nm[group.index];
                if (!nm) {
                    nm = {};
                    g2nm[group.index] = nm;
                }
                nm[node.name] = node;
                return group;
            };

            ungroup(node) {
                var group = node.group;
                var nm = this.group_to_nodemap[group.index];
                delete nm[node.name];
                node.group = null;
            };

            group_index(point) {
                var result = {};
                var radius = 1.0 * this.settings.separator_radius;
                for (var coord in point) {
                    var value = point[coord];
                    var ivalue = Math.floor(value / radius);
                    result[coord] = ivalue;
                }
                result.index = this.group_name(result.x, result.y);
                return result;
            };

            group_name(x, y) {
                return "i" + x + ":" + y;
            }

            origin_penalty(xy) {
                var m = this.matrix_op;
                var d = m.vlength(xy);
                var s = this.settings.origin_scale;
                var value = s * (d ** 2);
                var gradient = m.vscale(2 * s, xy);
                return [value, gradient];
            };

            separation_penalty(point1, point2) {
                var m = this.matrix_op;
                var st = this.settings;
                var diff = m.vdiff(point2, point1);
                var d = m.vlength(diff);
                if (d < st.epsilon) {
                    // arbitrary
                    diff = this.xy([st.epsilon, 0]);
                    d = st.epsilon;
                }
                var offset = st.separator_radius - d;
                if (offset > 0) {
                    var s = st.separation_scale;
                    var value = s * (offset ** 2);
                    var slope = 2 * s * offset;
                    var gradient = m.vscale((slope / d), diff);
                    return [value, gradient];
                }
                return [0, this.xy([0, 0])];  // default
            };

            link_penalty(xy1, xy2, abs_weight) {
                var m = this.matrix_op;
                var st = this.settings;
                var diff = m.vdiff(xy1, xy2);
                var d = m.vlength(diff);
                var lr = st.link_radius;
                var s = st.link_scale;
                var violation = (d - lr);
                var wviolation = violation * abs_weight;
                var value, gradient;
                if (violation < 0 || d < st.epsilon)  {
                    // no violation if close enough: flat
                    value = 0;
                    gradient = this.xy([0,0]);
                } else if (violation < lr) {
                    // quadratic region inside near circle
                    value = s * (wviolation ** 2);
                    var slope = 2 * s * wviolation;
                    gradient = m.vscale(slope * 1.0 / d, diff)
                } else {
                    // linear interpolation everywhere else
                    var wlr = lr * abs_weight;
                    var start = s * (wlr ** 2);
                    var slope = 2 * s * wlr;
                    gradient = m.vscale(slope * 1.0 / d, diff);
                    //console.log("linear", start, slope, violation, lr);
                    value = start + slope * (violation - lr);
                }
                return [value, gradient];
            };

            grid_spiral_coordinates(index, jitter) {
                var i = 0;
                var j = 0;
                if (index > 0) {
                    var radius = 1;
                    var r2 = 1;
                    var count = 0;
                    while (index >= r2) {
                        radius += 2;
                        r2 = radius * radius;
                        count += 1;
                    }
                    var offset = index - (radius - 2) ** 2;
                    var increment = offset % (radius - 1);
                    var side = (offset - increment) / (radius - 1);
                    if (side == 0) {
                        i = count;
                        j = increment - count;
                    } else if (side == 1) {
                        j = count;
                        i = count - increment;
                    } else if (side == 2) {
                        i = - count;
                        j = count - increment;
                    } else if (side == 3) {
                        i = increment - count;
                        j = - count;
                    } else {
                        throw new Error("bad side: "+side);
                    }
                    if (jitter) {
                        i = i + Math.sin(index) * jitter;
                        j = j + Math.cos(index) * jitter;
                    }
                }
                return this.xy([i, j]);
            };
        };

        class GD_Node {
            constructor(name, in_graph) {
                this.in_graph = in_graph;
                this.name = name;
                this.position = null;
                this.group = null;
                this.key_to_edge = {};
                this.reset_bookkeeping();
            };
            add_edge(edge) {
                this.key_to_edge[edge.key] = edge;
            };
            set_position(position) {
                // set position but don't compute penalties
                if (this.group) {
                    this.in_graph.ungroup(this);
                }
                this.in_graph.group(position, this);
                this.position = position;
                return this;
            };
            reset_bookkeeping() {
                this.gradient = this.in_graph.xy([0,0]);
                this.neighbor_to_increment = {};
                this.edge_key_to_increment = {};
                this.origin_increment = [0, this.in_graph.xy([0,0])];
                this.penalty = 0;
            };
            sum_penalty() {
                var penalty = 0.0;
                var gradient = this.in_graph.xy([0,0]);
                var m = this.in_graph.matrix_op;
                var add_incr = function(incr) {
                    penalty += incr[0];
                    gradient = m.vadd(gradient, incr[1]);
                };
                add_incr(this.origin_increment);
                var n2i = this.neighbor_to_increment;
                for (var n in n2i) {
                    add_incr(n2i[n]);
                }
                var k2i = this.edge_key_to_increment;
                for (var k in k2i) {
                    add_incr(k2i[k]);
                }
                this.gradient = gradient;
                this.penalty = penalty;
                return [penalty, gradient];
            };
        };

        class GD_Edge {
            constructor(nodename1, nodename2, weight, in_graph) {
                this.nodename1 = nodename1;
                this.nodename2 = nodename2;
                this.in_graph = in_graph;
                this.weight = weight;
                this.abs_weight = Math.abs(weight);
                this.penalty = 0;
                this.gradient = in_graph.xy([0,0]);
                if (nodename1 < nodename2) {
                    this.key = "e:" + nodename1 + ":" + nodename2;
                } else {
                    this.key = "e:" + nodename2 + ":" + nodename1;
                }
            };
            compute_penalty() {
                var in_graph = this.in_graph;
                var n1 = in_graph.get_node(self.nodename1);
                var n2 = in_graph.get_node(self.nodename2);
                var increment = in_graph.link_penalty(n1.position, n2.position, this.abs_weight);
                this.penalty = increment[0];
                this.gradient = increment[1];
            };
            other_name(name) {
                var nn1 = this.nodename1;
                var nn2 = this.nodename2;
                if (name == nn1) {
                    return nn2;
                } else {
                    if (name != nn2) {
                        throw new Error("bad node name for edge " + this.key + " : " + name);
                    }
                    return nn1;
                }
            };
        };

        return new GD_Graph(options, element);
    };

    $.fn.gd_graph.qset = function() {

        class QSet {
            constructor(sequence) {
                this.init();
                if (sequence) {
                    for (var i=0; i<sequence.length; i++) {
                        this.push(sequence[i]);
                    }
                }
            };
            init() {
                this.index_mapping = {};
                this.set_mapping = {};
                this.frontindex = this.backindex = 0;
            }
            is_empty() {
                return this.frontindex >= this.backindex;
            };
            push(item) {
                if (this.set_mapping[item]) {
                    return;
                }
                this.backindex += 1;
                this.set_mapping[item] = "k_" + item;
                this.index_mapping[this.backindex] = item;
            };
            pop(_default) {
                if (this.is_empty()) {
                    //console.log("pop returning default " + _default)
                    if (_default === undefined) {
                        return null;
                    }
                    return _default;
                }
                //console.log("pop returning item ", this.frontindex, this.backindex, this.index_mapping[this.frontindex+1]);
                this.frontindex += 1;
                var item = this.index_mapping[this.frontindex];
                if (this.frontindex >= this.backindex) {
                    this.init();
                } else {
                    delete this.index_mapping[this.frontindex];
                    delete this.set_mapping[item];
                }
                return item;
            };
        };

        return new QSet();
    };

    $.fn.gd_graph.unionizer = function() {

        class Unionizer {

            constructor() {
                this.mapping = {};
            };

            add(key) {
                key = "k_" + key
                var m = this.mapping;
                if (!m[key]) {
                    m[key] = key;
                }
            };

            join(key1, key2) {
                this.add(key1);
                this.add(key2);
                key1 = "k_" + key1;
                key2 = "k_" + key2;
                var m1 = this._representative(key1);
                var m2 = this._representative(key2);
                var m = this.mapping;
                if (m1 < m2) {
                    m[key2] = m1;
                } else {
                    m[key1] = m2;
                }
            };

            _representative(kkey) {
                var m = this.mapping;
                var mkey = m[kkey];
                if (mkey == kkey) {
                    return kkey;
                } else {
                    var result = m[kkey] = this._representative(mkey);
                    return result;
                }
            };

            representative(key) {
                return this._representative("k_" + key)
            }
        };

        return new Unionizer();
    };

    $.fn.gd_graph.example = function(element) {
    };

})(jQuery);
