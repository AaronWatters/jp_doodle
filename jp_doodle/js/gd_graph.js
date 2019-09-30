/*

JQuery plugin helper for gradient descent based graph layout.

Requires nd_frame to be loaded.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/
"use strict";

import { ENGINE_METHOD_NONE } from "constants";


(function($) {

    $.fn.gd_graph = function (options, element) {
        // Undirected weighted graph with 2D layout heuristic.

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

            penalize(penalty_increment) {
                this.penalty += penalty_increment;
            };

            calibrate() {
                var s = this.settings;
                s.origin_scale = s.origin_height * 1.0 / (s.origin_radius ** 2)
                s.link_scale = s.link_height * 1.0 / (s.link_radius ** 2)
                s.separation_scale = s.separation_height * 1.0 / (s.separator_radius ** 2)
            };

            initialize_penalties() {
                // set up all penalty bookkeeping data structures;
                for (var key in this.edge_key_to_descriptor) {
                    this.edge_key_to_descriptor[key].compute_penalty();   // first edges
                }
                // then nodes
                var total_penalty = 0.0;
                for (var name in this.node_name_to_descriptor) {
                    var node = this.node_name_to_descriptor[name];
                    node.compute_components();
                    node.sum_penalty();
                    total_penalty += node.penalty;
                }
                this.penalty = total_penalty
            };

            get_or_make_node(name) {
                var node = this.node_name_to_descriptor[name];
                if (!node) {
                    node = this.add_node(name);
                }
                return node;
            };

            add_node(name) {
                //console.log("adding node", name);
                var node = new GD_Node(name, this);
                this.node_name_to_descriptor[name] = node;
                return node;
            };

            get_node(name) {
                var result = this.node_name_to_descriptor[name];
                if (!result) { 
                    throw new Error("no such node with name "+name);
                }
                return result;
            };

            node_names() {
                var result = [];
                for (var name in this.node_name_to_descriptor) {
                    result.push(name);
                }
                return result;
            }

            add_edge(node_name1, node_name2, weight, skip_duplicate) {
                if (node_name1 == node_name2) {
                    // error?
                    return null;
                }
                var e = new GD_Edge(node_name1, node_name2, weight, this);
                return this.record_edge(e);
            }

            record_edge(e) {
                var k = e.key;
                var e2d = this.edge_key_to_descriptor;
                if (e2d[k]) {
                    if (skip_duplicate) {
                        return null;
                    }
                    throw new Error("duplicate edge not permitted: " + k);
                }
                e2d[k] = e;
                var n1 = this.get_or_make_node(e.nodename1);
                n1.add_edge(e);
                var n2 = this.get_or_make_node(e.nodename2);
                n2.add_edge(e);
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
                //console.log("link_penalty", xy1, xy2, abs_weight);
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
                    //c.l("no violation if close enough: flat", violation, d, st.epsilon);
                    value = 0;
                    gradient = this.xy([0,0]);
                } else if (violation < lr) {
                    //c.l("quadratic region inside near circle", violation, lr);
                    value = s * (wviolation ** 2);
                    var slope = 2 * s * wviolation;
                    gradient = m.vscale(slope * 1.0 / d, diff)
                } else {
                    //c.l("linear interpolation everywhere else", violation, lr);
                    var wlr = lr * abs_weight;
                    var start = s * (wlr ** 2);
                    var slope = 2 * s * wlr;
                    gradient = m.vscale(slope * 1.0 / d, diff);
                    ////c.l("linear", start, slope, violation, lr);
                    value = start + slope * (violation - lr);
                }
                //console.log("... computed", value, gradient)
                return [value, gradient];
            };

            relaxer(node_names, min_change) {
                return new GD_Relaxer(this, node_names, min_change);
            };

            edge_priority() {
                // list of edges sorted by decreasing absolute weight
                var result = [];
                var e2d = this.edge_key_to_descriptor;
                for (var k in e2d) {
                    result.push(e2d[k]);
                }
                result.sort(function (a, b) { return b.abs_weight - a.abs_weight; });
                return result;
            };

            has_edge(nodename1, nodename2) {
                var key = edge_key(nodename1, nodename2);
                if (this.edge_key_to_descriptor[key]) {
                    return true;
                }
                return false;
            };

            edge_count() {
                return Object.keys(this.edge_key_to_descriptor).length;
            }

            ordered_nodes() {
                // sequence of nodes sorted by increasing total absolute weight of connected edges.
                var n2d = this.node_name_to_descriptor;
                var result = []
                for (var node_name in n2d) {
                    result.push(n2d[node_name]);
                }
                result.sort(function (a, b) { return a.abs_weight() - b.abs_weight(); });
                return result;
            };

            collapse_spokes(nlevel) {
                // generate a derived graph which collapses weak nodes into strong nodes.
                nlevel = nlevel || 1;
                var sorted_nodes = this.ordered_nodes();
                var root = this.root || this;
                var nn2d = this.node_name_to_descriptor;
                var node_name_to_owner_name = {};
                var owners = {};
                // pick a strongest connected owner for each node
                for (var i=0; i<sorted_nodes.length; i++) {
                    var node = sorted_nodes[i];
                    var node_name = node.name;
                    var owner_name = node_name;   // default
                    // look for strongest connecting edge (not to owned node)
                    var sorted_edges = node.edge_priority();
                    for (var j=0; j<sorted_edges.length; j++) {
                        var edge = sorted_edges[j];
                        var other_name = edge.other_name(node_name);
                        if ((owners[other_name]) || (!node_name_to_owner_name[other_name])) {
                            // other is either an owner or not owned -- assign as owner to this node
                            owner_name = other_name;
                            break;
                        }
                    }
                    owners[owner_name] = node;
                    node_name_to_owner_name[node_name] = owner_name;
                }
                // combine edge weights for collapsed nodes in absolute value
                var owner_pairs = {};
                //var edge_count = 0;
                var owner_edge_count = 0;
                for (var k in this.edge_key_to_descriptor) {
                    //edge_count += 1;
                    var edge = this.edge_key_to_descriptor[k];
                    var owner1 = node_name_to_owner_name[edge.nodename1];
                    var owner2 = node_name_to_owner_name[edge.nodename2];
                    if (owner1 != owner2) {
                        var key = edge_key(owner1, owner2);
                        var owner_pair = owner_pairs[key];
                        if (owner_pair) {
                            owner_pair.weight += edge.abs_weight;
                        } else {
                            owner_edge_count += 1;
                            owner_pairs[key] = {weight: edge.abs_weight, owner1: owner1, owner2: owner2};
                        }
                    }
                }
                // construct collapsed graph
                var factor = 1.0
                if (owner_edge_count > 0) {
                    factor = root.edge_count() * (1.0 / owner_edge_count);
                }
                factor = Math.max(factor, nlevel);
                var result = this.zoomGraph(factor);
                // set owner nodes
                for (var owner in owners) {
                    result.get_or_make_node(owner);
                }
                // set collapsed edges
                for (var key in owner_pairs) {
                    var pair = owner_pairs[key];
                    result.add_edge(pair.owner1, pair.owner2, pair.weight);
                }
                return result;
            };

            skeleton(edge_count) {
                /*
                Make a graph S from self with the same nodes and possibly fewer edges from self
                where two nodes that are reachable in self are also reachable
                in S and every edge with at least edge_count in self has
                at least edge_count in S
                (or the maximum number of edges in self if fewer).  Use the edges with the 
                highest absolute weight.
                */
                edge_count = edge_count || 1;
                var result = this.zoomGraph(1.0);
                //var e2d = this.edge_key_to_descriptor;
                var n2d = this.node_name_to_descriptor;
                var edges_sorted = this.edge_priority();
                var node_edge_count = {};
                var used_edges = {};
                var U = $.fn.gd_graph.unionizer ();
                // add heaviest edges up to edge_count for each node
                for (var i=0; i<edges_sorted.length; i++) {
                    var edge = edges_sorted[i];
                    var n1 = edge.nodename1;
                    var n2 = edge.nodename2;
                    var c1 = node_edge_count[n1] || 0;
                    var c2 = node_edge_count[n2] || 0;
                    if ((c1 < edge_count) || (c2 < edge_count)) {
                        used_edges[edge.key] = edge;
                        node_edge_count[n1] = c1 + 1;
                        node_edge_count[n2] = c2 + 1;
                        U.join(n1, n2);
                    }
                }
                // add edges to connect connected components
                for (var i=0; i<edges_sorted.length; i++) {
                    var edge = edges_sorted[i];
                    var n1 = edge.nodename1;
                    var n2 = edge.nodename2;
                    if (U.representative(n1) != U.representative(n2)) {
                        used_edges[edge.key] = edge;
                        U.join(n1, n2);
                    }
                }
                // copy nodes.
                for (var node_name in n2d) {
                    result.add_node(node_name);
                }
                // copy used edges
                for (var k in used_edges) {
                    result.copy_edge(used_edges[k], result);
                }
                return result;
            };

            copy_edge(edge, toOtherGraph) {
                toOtherGraph.record_edge(edge.clone(toOtherGraph));
            };

            zoomGraph(factor, copy) {
                factor = factor || 2.0;
                var settings0 = this.settings;
                var settings = $.extend({}, settings0);
                settings.separator_radius = settings0.separator_radius * factor;
                settings.link_radius = settings0.link_radius * factor;
                var result = new GD_Graph(settings);
                result.root = this.root || self;
                if (copy) {
                    for (var node_name in self.node_name_to_descriptor) {
                        result.add_node(node_name);
                    }
                    for (var edge_key in this.edge_key_to_descriptor) {
                        //var clone = this.edge_key_to_descriptor[edge_key].clone(result);
                        //result.record_edge(clone);
                        this.copy_edge(this.edge_key_to_descriptor[edge_key], result);
                    }
                }
                return result;
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
                this.group = this.in_graph.group(position, this);
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
                // Sum penalties using precomputed component values.
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
            compute_components() {
                // Initialize precomputed penalty components using new position
                // Assume edge penalties have already been computed.
                // xxxx -- it doesn't make sense to reset position unless edge penalties are recomputed.
                //if (position) {
                //    this.set_position(position);
                //}
                var position = this.position;
                var G = this.in_graph;
                var name = this.name;
                //c.l("compute components", name, position);
                var n2i = {}; // neighbor_to_increment
                var neighbors = G.neighbors(this.group);
                for (var nname in neighbors) {
                    if (name != nname) {
                        var neighbor = neighbors[nname];
                        var nposition = neighbor.position;
                        var pen_grad = G.separation_penalty(position, nposition);
                        //c.l("neighbor increment", name, nname, pen_grad);
                        var pen = pen_grad[0];
                        if (pen > 0) {
                            var grad = pen_grad[1];
                            n2i[nname] = pen_grad;
                        }
                    }
                }
                var e2i = {}; // edge_key_to_increment
                var k2e = this.key_to_edge;
                for (var key in k2e) {
                    var edge = k2e[key];
                    // don't recompute penalty here.
                    e2i[key] = edge.node_increment(name);
                    //c.l("edge increment", name, key, e2i[key]);
                }
                this.origin_increment = G.origin_penalty(position);
                //c.l("origin incement", name, this.origin_increment)
                this.neighbor_to_increment = n2i;
                this.edge_key_to_increment = e2i;
                return true;
            };
            apply_external_penalties() {
                // Copy related precomputed local penalties to neighbors and connected nodes.
                var old_penalties = {};
                var G = this.in_graph;
                var matrix_op = G.matrix_op;
                var n2i = this.neighbor_to_increment;
                var name = this.name;
                for (var nname in n2i) {
                    // propagate nearness penalty to too close neighbor
                    var neighbor = G.get_node(nname);
                    old_penalties[nname] = neighbor.penalty || 0.0;
                    var pen_grad = n2i[nname];
                    var reversed_pen_grad = [pen_grad[0], matrix_op.vscale(-1, pen_grad[1])];
                    neighbor.neighbor_to_increment[name] = reversed_pen_grad;
                }
                var k2e = this.key_to_edge;
                var k2i = this.edge_key_to_increment;
                for (var key in k2i) {
                    // propagate edge penalty to too far connected node
                    var edge = k2e[key];
                    var othername = edge.other_name(name);
                    var othernode = G.get_node(othername);
                    old_penalties[othername] = othernode.penalty || 0.0;
                    var pen_grad = k2i[key];
                    var reversed_pen_grad = [pen_grad[0], matrix_op.vscale(-1, pen_grad[1])];
                    othernode.edge_key_to_increment[key] = reversed_pen_grad;
                }
                return old_penalties;
            };
            remove_external_penalties() {
                // remove entries propagated to related nodes.
                var old_penalties = {};
                var G = this.in_graph;
                var n2i = this.neighbor_to_increment;
                var k2e = this.key_to_edge;
                var k2i = this.edge_key_to_increment;
                var name = this.name;
                for (var nname in n2i) {
                    // remove nearness penalty for neighbor
                    var neighbor = G.get_node(nname);
                    old_penalties[nname] = neighbor.penalty || 0.0;
                    delete neighbor.neighbor_to_increment[name];
                }
                for (var key in k2i) {
                    // remove edge penalty for connected node
                    var edge = k2e[key];
                    var othername = edge.other_name(name);
                    var othernode = G.get_node(othername);
                    delete othernode.edge_key_to_increment[key]
                }
                return old_penalties;
            };

            reposition(position) {
                // reset position and update all bookkeeping.
                var G = this.in_graph;
                var name = this.name;
                var all_penalties = {};
                all_penalties[name] = this.penalty;
                if (this.position) {
                    var old_penalties = this.remove_external_penalties();
                    all_penalties = {...all_penalties, ...old_penalties};
                }
                this.set_position(position);
                // recalibrate edges
                for (var key in this.key_to_edge) {
                    this.key_to_edge[key].compute_penalty();
                }
                this.compute_components();
                var new_nodes = this.apply_external_penalties();
                all_penalties = {...all_penalties, ...new_nodes};
                // Adjust penalties for all effected nodes
                for (var node_name in all_penalties) {
                    var old_penalty = all_penalties[node_name];
                    var node = G.get_node(node_name);
                    node.sum_penalty();
                    var new_penalty = node.penalty;
                    G.penalize(new_penalty - old_penalty);
                }
                return {penalty: G.penalty, touched: all_penalties};
            };
            edge_priority() {
                // incident edges sorted by decreasing absolute weight
                var result = [];
                for (var key in this.key_to_edge) {
                    result.push(this.key_to_edge[key]);
                }
                result.sort(function (a, b) { return b.abs_weight - a.abs_weight; })
                return result;
            };
            abs_weight() {
                // total of abs weights for edges
                var result = 0.0;
                for (var key in this.key_to_edge) {
                    result += this.key_to_edge[key].abs_weight;
                }
                return result;
            };
            probe() {
                // Try to follow gradient to a lower penalty.
                var in_graph = this.in_graph;
                var settings = in_graph.settings;
                var epsilon = settings.epsilon;
                var g = this.gradient;
                var m = in_graph.matrix_op;
                var n = m.vlength(g);
                var change = 0.0;
                var touched = {};
                // only do work if gradient is non-trivial
                if (n > epsilon) {
                    var shift_magnitude = settings.separator_radius * 0.3;   // ??? magic number
                    var shift = m.vscale(-shift_magnitude / n, g);
                    var probe_limit = settings.probe_limit;
                    var count = 0;
                    var probe_callback = settings.probe_callback;
                    var probe_shrink = settings.probe_shrink;
                    var probe_expand = settings.probe_expand;
                    var best_penalty = in_graph.penalty;
                    var best_position = this.position;
                    var initial_position = this.position;
                    var test_position = m.vadd(initial_position, shift);
                    var test_result = this.reposition(test_position);
                    //console.log("probing", this.name, g);
                    if (test_result.penalty < best_penalty) {
                        //console.log("probing outward");
                        // keep probing outward while improving...
                        while ((test_result.penalty < best_penalty) && (count < probe_limit)) {
                            count += 1;
                            best_position = test_position;
                            best_penalty = test_result.penalty;
                            shift = m.vscale(probe_expand, shift);
                            //console.log("... shift out", count, shift);
                            test_position = m.vadd(initial_position, shift);
                            test_result = this.reposition(test_position)
                        }
                        // reset all datastructures back to the best position
                        test_result = this.reposition(best_position);
                        touched = test_result.touched;
                        change = m.vlength(m.vsub(best_position, initial_position))
                        if (probe_callback) {
                            probe_callback(this, in_graph, best_position, initial_position, touched);
                        }
                    } else {
                        //console.log("probing inward");
                        // keep probing inward until improving...
                        while ((test_result.penalty >= best_penalty) && (count < probe_limit)) {
                            count += 1;
                            shift = m.vscale(probe_shrink, shift);
                            //console.log("... shift in", count, shift);
                            test_position = m.vadd(initial_position, shift);
                            test_result = this.reposition(test_position)
                        }
                        if (test_result.penalty < best_penalty) {
                            best_position = test_position;
                            touched = test_result.touched;
                            change = m.vlength(m.vsub(best_position, initial_position))
                            if (probe_callback) {
                                probe_callback(this, in_graph, best_position, initial_position, touched);
                            }
                        } else {
                            // reposition back to initial position (failed)
                            //.log("... failed", count, shift);
                            this.reposition(initial_position);
                        }
                    }
                } else {
                    //console.log("gradient too short: skipping.")
                }
                return {change: change, touched: touched};
            }
        };

        function edge_key(nodename1, nodename2) {
            // unordered edge key
            if (nodename1 < nodename2) {
                return "e:" + nodename1 + ":" + nodename2;
            } else {
                return "e:" + nodename2 + ":" + nodename1;
            }
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
                this.key = edge_key(nodename1, nodename2);
            };
            clone(in_graph) {
                return new GD_Edge(this.nodename1, this.nodename2, this.weight, in_graph);
            };
            compute_penalty() {
                var in_graph = this.in_graph;
                var n1 = in_graph.get_node(this.nodename1);
                var n2 = in_graph.get_node(this.nodename2);
                var increment = in_graph.link_penalty(n1.position, n2.position, this.abs_weight);
                this.penalty = increment[0];
                this.gradient = increment[1];
                return increment;
            };
            node_increment(nodename) {
                var m = this.in_graph.matrix_op;
                if (nodename == this.nodename1) {
                    return [this.penalty, m.vscale(1.0, this.gradient)];
                } else if (nodename == this.nodename2) {
                    return [this.penalty, m.vscale(-1.0, this.gradient)];
                } else {
                    throw new Error("no such nodename in edge: "+nodename+" :: "+this.key);
                }
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

        class GD_Relaxer {
            // Gradient descent controller for reducing graph penalty.
            constructor(graph, node_names, min_change) {
                node_names = node_names || graph.node_names();
                this.min_change = min_change || graph.settings.min_change;
                this.graph = graph;
                this.qset = $.fn.gd_graph.qset(node_names);
            };
            step(min_change) {
                // Move one node and update effected nodes.
                if ((typeof min_change) != "number") {
                    min_change = this.min_change;
                }
                var graph = this.graph;
                var qset = this.qset;
                var node_name = qset.pop();
                if (!node_name) {
                    return null;  // No node to optimize
                }
                var node = graph.get_node(node_name);
                var before = graph.penalty;
                var probe = node.probe();
                var change = before - graph.penalty;
                if (change > min_change) {
                    // also look at all touched nodes
                    for (var nodename in probe.touched) {
                        qset.push(nodename);
                    }
                } else {
                    // not enough change: don't queue touched nodes
                }
                return nodename;
            };
            run(limit, min_change) {
                // keep stepping up to limit or node queue is empty.
                var count = 0;
                while ((!limit) || (count < limit)) {
                    count += 1;
                    var nodename = this.step(min_change);
                    if (nodename === null) {
                        //console.log("relaxer ran out of nodes.");
                        return {count: count, nodename: nodename};
                    }
                }
                //console.log("relaxer exceeded limit", limit);
                return {count: count, nodename: nodename};
            }
        };

        return new GD_Graph(options, element);
    };

    $.fn.gd_graph.qset = function(sequence) {

        class QSet {
            // A priority queue which does not record duplicate inserts.
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
            };
            length() {
                return this.backindex - this.frontindex;
            };
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
                    ////c.l("pop returning default " + _default)
                    if (_default === undefined) {
                        return null;
                    }
                    return _default;
                }
                ////c.l("pop returning item ", this.frontindex, this.backindex, this.index_mapping[this.frontindex+1]);
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

        return new QSet(sequence);
    };

    $.fn.gd_graph.unionizer = function() {

        class Unionizer {
            // Set merge utility.

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
