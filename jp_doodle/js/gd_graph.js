/*

JQuery plugin helper for gradient descent based graph layout.

Requires nd_frame to be loaded.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/
"use strict";

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
                this.top_graph = null;
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
                return this.record_edge(e, skip_duplicate);
            }

            record_edge(e, skip_duplicate) {
                var k = e.key;
                var e2d = this.edge_key_to_descriptor;
                if (e2d[k]) {
                    if (skip_duplicate) {
                        return e2d[k];
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
                this.initialize_penalties();
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
            };

            node_count() {
                return Object.keys(this.node_name_to_descriptor).length;
            };

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

            layout_skeleton(edge_count) {
                var Gs = this.skeleton(edge_count);
                Gs.layout_spokes();
                // copy positions from skeleton layout
                var n2d = this.node_name_to_descriptor;
                var sn2d = Gs.node_name_to_descriptor;
                for (var name in n2d) {
                    n2d[name].set_position(sn2d[name].position);
                }
                // set up bookkeeping
                this.initialize_penalties();
            }

            layout_spokes(level, skeletize, top_graph) {
                // bottom up layout strategy for graph -- first layout simplified graph with spokes collapsed.
                level = level || 0;
                top_graph = top_graph || this.top_graph;
                var nlevel = level + 1;
                var m = this.matrix_op;
                var collapsed = this.collapse_spokes(nlevel, top_graph);
                // layout collapsed graph
                var Gs = collapsed.result;
                var D = collapsed.node_name_to_owner_name;
                if (Gs.edge_count() < 1) {
                    Gs.rectangular_layout();
                } else {
                    if (skeletize) {
                        Gs = Gs.skeleton();
                    }
                    Gs.layout_spokes(nlevel, skeletize, top_graph);
                }
                // apply collapsed graph layout to current graph
                var nn2d = this.node_name_to_descriptor;
                var Gsnn2d = Gs.node_name_to_descriptor;
                var scale = this.settings.link_radius * 0.5;
                var count = 0;
                for (var nodename in D) {
                    var owner = D[nodename];
                    count += 1;
                    var node = nn2d[nodename];
                    var ownernode = Gsnn2d[owner];
                    var shift = m.vscale(scale, this.node_offsetter(count));
                    var reference = m.vscale(0.25, ownernode.position);
                    var position = m.vadd(shift, reference);
                    node.set_position(position)
                }
                this.initialize_penalties();
                var R = this.relaxer();
                var limit = null;
                // heuristic for big graphs -- set a limit
                var nnodes = this.node_count()
                if (nnodes > 100) {
                    limit = 5 * nnodes * Math.log(nnodes);
                }
                R.run(limit);
                return this;
            };

            node_offsetter(index) {
                // heuristic for offsetting nodes from owner node positions.
                var g = this.grid_spiral_coordinates((index % 10) + 1, 0.3);
                g.x += Math.sin(index);
                g.y += Math.cos(index);
                return g;
            }

            rectangular_layout() {
                var d = this.settings.link_radius * 0.5;
                var jitter = 0.2;
                var nodes = this.ordered_nodes();
                var m = this.matrix_op;
                for (var i=0; i<nodes.length; i++) {
                    var node = nodes[i];
                    var xy = this.grid_spiral_coordinates(i, jitter);
                    var pos = m.vscale(d, xy);
                    node.set_position(pos);
                }
                this.initialize_penalties();
                return this;
            }

            collapse_spokes(nlevel, top_graph) {
                // generate a derived graph which collapses weak nodes into strong nodes.
                nlevel = nlevel || 1;
                var sorted_nodes = this.ordered_nodes();
                top_graph = top_graph || this.top_graph || this;
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
                //var owner_edge_count = 0;
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
                            //owner_edge_count += 1;
                            owner_pairs[key] = {weight: edge.abs_weight, owner1: owner1, owner2: owner2};
                        }
                    }
                }
                // construct collapsed graph
                var factor = 1.0;
                var owner_count = Object.keys(node_name_to_owner_name).length;
                //console.log("top_graph is", top_graph);
                if (owner_count > 0) {
                    factor = top_graph.node_count() * (1.0 / owner_count);
                }
                factor = Math.max(factor, nlevel);
                var result = this.zoomGraph(factor, false, top_graph);
                // set owner nodes
                for (var owner in owners) {
                    result.get_or_make_node(owner);
                }
                // set collapsed edges
                for (var key in owner_pairs) {
                    var pair = owner_pairs[key];
                    result.add_edge(pair.owner1, pair.owner2, pair.weight);
                }
                return {result: result, node_name_to_owner_name: node_name_to_owner_name};
            };

            skeleton(edge_count) {
                /*
                Make a graph S from graph with the same nodes and possibly fewer edges from graph
                where two nodes that are reachable in graph are also reachable
                in S and every edge with at least edge_count in graph has
                at least edge_count in S
                (or the maximum number of edges in graph if fewer).  Use the edges with the 
                highest absolute weight.
                */
                edge_count = edge_count || 1;
                var result = this.zoomGraph(1.0, false, this);
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

            zoomGraph(factor, copy, top_graph) {
                factor = factor || 2.0;
                top_graph = top_graph || this.top_graph || this;
                var settings0 = top_graph.settings;
                var settings = $.extend({}, settings0);
                settings.separator_radius = settings0.separator_radius * factor;
                settings.link_radius = settings0.link_radius * factor;
                var result = new GD_Graph(settings);
                result.top_graph = top_graph;
                if (copy) {
                    for (var node_name in this.node_name_to_descriptor) {
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

            illustrate(on_canvas, options) {
                return new GD_Illustration(this, on_canvas, options);
            };
        };

        class GD_Node {
            constructor(name, in_graph, options) {
                this.settings = $.extend({
                    fixed: false,   // if true then don't move this node from assigned position.
                }, options);
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
                var name = this.name;
                //touched[name] = 0;   // default.
                // only do work if gradient is non-trivial and the node is moveable.
                if (this.settings.fixed) {
                    // add all connected nodes to touched, but don't move this node
                    for (var key in this.key_to_edge) {
                        var edge = this.key_to_edge[key];
                        var othername = edge.other_name(name)
                        touched[othername] = 0;
                    }
                }
                else if (n > epsilon) {
                    // follow non-trivial gradient
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
            constructor(nodename1, nodename2, weight, in_graph, options) {
                weight = weight || 0;
                this.settings = $.extend({}, options);
                this.nodename1 = nodename1;
                this.nodename2 = nodename2;
                this.in_graph = in_graph;
                this.weight = weight;
                this.abs_weight = Math.abs(weight);
                this.penalty = 0;
                this.gradient = in_graph.xy([0,0]);
                this.key = edge_key(nodename1, nodename2);
            };
            arrow(nodenameA, nodenameB, weight, config) {
                // directional configuration
                config = config || {}
                config.weight = weight;
                var direction = "forward";
                var reverse = "backward";
                if (nodenameA == this.nodename1) {
                    if (nodenameB != this.nodename2)  {
                        throw new Error("bad nodenames " + [nodenameA,nodenameB]);
                    }
                } else {
                    if ((nodenameA != this.nodename2) || (nodenameB != this.nodename1)) {
                        throw new Error("bad nodenames " + [nodenameA,nodenameB]);
                    }
                    direction = "backward";
                    reverse = "forward";
                }
                var other = this[reverse] || {weight: 0};
                this[reverse] = other;
                this[direction] = config;
                this.abs_weight = Math.abs(weight) + Math.abs(other.weight) + Math.abs(this.weight);
                return this;
            };
            clone(in_graph) {
                var result = new GD_Edge(this.nodename1, this.nodename2, this.weight, in_graph);
                result.abs_weight = this.abs_weight;
                return result;
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
            add(node_name) {
                this.qset.push(node_name);
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
                if (change >= min_change) {
                    // also look at all touched nodes
                    for (var nodename in probe.touched) {
                        qset.push(nodename);
                    }
                } else {
                    // not enough change: don't queue touched nodes
                }
                return {nodename: nodename, touched: probe.touched};;
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

        function display_node(node, illustration, update) {
            var in_frame = illustration.frame;
            var shape = node.settings.shape || illustration.settings.node_shape || "circle";
            var params = {};
            params.color = node.settings.color || illustration.settings.node_color || "green";
            params.x = node.position.x;
            params.y = node.position.y;
            var r = node.settings.r || illustration.settings.node_radius || 3;
            if (shape == "circle") {
                params.r = r;
            } else if (shape == "rect") {
                params.dx = -r;
                params.dy = -r;
                params.w = 2*r;
                params.h = 2*r;
            } else if (shape == "text") {
                params.text = "" + node.name;
                params.font = node.settings.font || illustration.settings.node_font || "normal 10px Arial";
                params.background = node.settings.background || illustration.settings.node_background || "yellow";
                params.align = "center";
                params.valign = "center";
            } else {
                throw new Error("unsupported glyph type: " + shape);
            }
            if (update) {
                node.settings.glyph.change(params);
            } else {
                params.name = true;
                params.graph_node = node;
                node.settings.glyph = in_frame[shape](params);
            }
        };

        function display_edge(edge, illustration, update) {
            var in_frame = illustration.frame;
            var params = {};
            params.color = edge.settings.color || illustration.settings.edge_color || "blue";
            params.lineWidth = edge.settings.lineWidth || illustration.settings.edgeLineWidth || 1;
            params.lineDash = edge.settings.lineDash || illustration.settings.edgeLineDash;
            var graph = edge.in_graph;
            var node1 = graph.get_node(edge.nodename1);
            var node2 = graph.get_node(edge.nodename2);
            params.x1 = node1.position.x;
            params.y1 = node1.position.y;
            params.x2 = node2.position.x;
            params.y2 = node2.position.y;
            if (update) {
                edge.settings.glyph.change(params);
            } else {
                params.name = true;
                params.graph_edge = edge;
                edge.settings.glyph = in_frame.line(params);
            }
        };

        class GD_Illustration {
            constructor(for_graph, on_canvas, options) {
                this.for_graph = for_graph;
                this.on_canvas = on_canvas;
                this.settings = $.extend({
                    node_shape: "text",  // or "cirle" or "rect"
                    node_color: "black",
                    node_background: "#f9d",
                    node_font: "italic 12px Arial",
                    edge_color: "#f93",
                    edgeLineDash: null,
                    edgeLineWidth: 1.5,
                    display_edge: display_edge,
                    display_node: display_node,
                    size: 500,
                    margin: 20,
                    animation_milliseconds: 100000,
                    autoRelax: false,   // If true then relax network after adjusting nodes.
                }, options);
                // animation control values.
                this.relaxer = null;
                this.stop_time = null;
                // node dragging
                this.dragging_node = null;
                // calibration
                this.radius = null;
            };
            enable_dragging () {
                // allow dragging of nodes.
                var that = this;
                var graph = that.for_graph;
                var n2n = graph.node_name_to_descriptor;
                var on_mouse_down = function (event) {
                    var info = event.object_info;
                    if ((!info) || (!info.graph_node)) {
                        console.error("no object info?", event);
                        return
                    }
                    // disable animation if autoRelax is off
                    if (!that.settings.autoRelax) {
                        that.relaxer = null;
                    }
                    var node = info.graph_node;
                    node.settings.fixed = true;
                    that.dragging_node = node;
                };
                var on_mouse_move = function (event) {
                    var node = that.dragging_node;
                    if (node) {
                        var loc = that.frame.event_model_location(event);
                        node.settings.glyph.change({x: loc.x, y: loc.y});
                        //node.position = loc;
                        node.reposition(loc);
                        if (that.relaxer) {
                            that.relaxer.add(node.name);
                        }
                        if (that.settings.autoRelax) {
                            that.animate_until(that.settings.animation_milliseconds);
                        }
                        var changed = {};
                        changed[node.name] = 0;
                        that.update(changed);
                    }
                }
                var on_mouse_up = function (event) {
                    var node = that.dragging_node;
                    if (node) {
                        node.settings.fixed = false;
                        if (that.relaxer) {
                            that.relaxer.add(node.name);
                        }
                    }
                    that.dragging_node = null
                    if (that.settings.autoRelax) {
                        that.animate_until(that.settings.animation_milliseconds);
                    }
                }
                for (var name in n2n) {
                    var node = n2n[name];
                    node.settings.glyph.on("mousedown", on_mouse_down);
                }
                that.on_canvas.on("mousemove", on_mouse_move);
                that.on_canvas.on("mouseup", on_mouse_up);
            };
            draw_in_region() {
                // initialize drawing in fresh frame.
                this.on_canvas.reset_canvas();
                var fp = this.frame_region_parameters();
                this.frame = this.on_canvas.frame_region(
                    fp.minx, fp.miny, fp.maxx, fp.maxy, 
                    fp.frame_minx, fp.frame_miny, fp.frame_maxx, fp.frame_maxy
                );
                var graph = this.for_graph;
                // draw edges
                var k2e = graph.edge_key_to_descriptor;
                var display_edge = this.settings.display_edge;
                for (var k in k2e) {
                    var edge = k2e[k];
                    var display = edge.display || display_edge;
                    display(edge, this, false);
                }
                // draw nodes (on top of edges)
                var n2n = graph.node_name_to_descriptor;
                var display_node = this.settings.display_node;
                for (var name in n2n) {
                    var node = n2n[name];
                    var display = node.display || display_node;
                    display(node, this, false);
                }
            };
            update(name_to_change) {
                var graph = this.for_graph;
                var key_to_edge = {};
                var display_node = this.settings.display_node;
                for (var name in name_to_change) {
                    var node = graph.get_node(name);
                    display = node.display || display_node;
                    display_node(node, this, true);
                    var k2e = node.key_to_edge;
                    for (var k in k2e) {
                        key_to_edge[k] = k2e[k];
                    }
                }
                var display_edge = this.settings.display_edge;
                for (var k in key_to_edge) {
                    var edge = key_to_edge[k];
                    var display = edge.display || display_edge;
                    display(edge, this, true);
                }
                var fp = this.frame_region_parameters();
                this.frame.set_region(
                    fp.minx, fp.miny, fp.maxx, fp.maxy, 
                    fp.frame_minx, fp.frame_miny, fp.frame_maxx, fp.frame_maxy
                );
            };
            animation_step(iterations) {
                if (!this.relaxer) {
                    console.error("animation step, but relaxer not defined!");
                    return;
                }
                iterations = iterations || 1;
                for (var i=0; i<iterations; i++) {
                    var relaxation = this.relaxer.step(0);
                    if (relaxation) {
                        this.update(relaxation.touched);
                    }
                }
                return relaxation;
            };
            animate_until(milliseconds, iterations) {
                var that = this;
                var end_time = Date.now() + milliseconds;
                if (that.relaxer) {
                    // we are already running: update the stop time
                    that.stop_time = Math.max(that.stop_time, end_time);
                    return;
                }
                that.relaxer = that.for_graph.relaxer();
                var step = function () {
                    if (!that.relaxer) {
                        console.error("animation callback, but relaxer not defined!");
                        return;
                    }
                    var now = Date.now();
                    that.animation_step(iterations);
                    if (now < end_time) {
                        requestAnimationFrame(step);
                    } else {
                        // we are done.
                        that.relaxer = null;
                    }
                };
                step();
            };
            frame_region_parameters() {
                var graph = this.for_graph;
                var ops = graph.matrix_op;
                var result = {};
                var s = this.settings;
                result.minx = s.margin;
                result.miny = s.margin;
                result.maxx = s.size - 2 * s.margin;
                result.maxy = result.maxx;
                var n2n = graph.node_name_to_descriptor;
                var m = null;
                var M = null;
                var count = 0;
                for (var name in n2n) {
                    count += 1;
                    var p = n2n[name].position;
                    m = ops.vmin(p, m, p);
                    M = ops.vmax(p, M, p);
                }
                if (count == 0) {  // arbitrary...
                    m = {x:0, y:0};
                    M = {x:1, y:1};
                }
                if (count == 1) {
                    M = ops.vadd(m,  {x:1, y:1});
                    m = ops.vadd(m,  {x:-1, y:-1});
                }
                var diff = ops.vsub(M, m);
                var mid = ops.vadd(ops.vscale(0.5, diff), m);
                var maxdiff2 = Math.max(diff.x, diff.y) * 0.5;
                this.radius = maxdiff2;   // used for drawing calibration.
                result.frame_minx = mid.x - maxdiff2;
                result.frame_miny = mid.y - maxdiff2;
                result.frame_maxx = mid.x + maxdiff2;
                result.frame_maxy = mid.y + maxdiff2;
                return result;
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
        debugger;
        var g = jQuery.fn.gd_graph({separator_radius: 6, link_radius: 1, min_change: 199});
        var s = 11;
        for (var i=0; i<s; i++) {
            var i10 = i * s;
            var e1 = g.add_edge(i10, i10+s-1, 2, true);
            e1.settings.color = "#0f9";
            var e2 = g.add_edge(i, (s-1)*s+i, 1, true);
            e2.settings.color = "#27f"
            e2.settings.lineWidth = 0.5;
            for (var j=i10; j<i10+s-1; j++) {
                g.add_edge(j, j+1, 1, true);
                var e3 = g.add_edge(j, j+s, 3, true)
                e3.settings.lineWidth = 3;
                e3.settings.color = "black";
                e3.settings.lineDash = [3,5];
            }
        }
        for (var i=s*(s-1)/2; i<s*s; i++) {
            var settings = g.get_node(i).settings;
            settings.r = 5;
            settings.color = "red";
            settings.shape = "circle";
            if (i%2) {
                settings.shape = "rect";
                settings.color = "blue";
                settings.r = 8;
            }
        }
        g.layout_spokes();
        //g.layout_skeleton(2);

        element.empty();
        element.css("background-color", "cornsilk");
        var config = {
            width: 1000,
            height: 1000,
        }
        element.dual_canvas_helper(config);

        var illustration = g.illustrate(element, {
            size:1000,
            animation_milliseconds: 10000,
            autoRelax: false,
        });
        illustration.draw_in_region();
        // animate relaxation for 20 seconds.
        illustration.animate_until(20 * 1000, s);

        illustration.enable_dragging();

        var t = $("<button>Toggle auto relax</button>").appendTo(element);
        var t_label = function() {
            if (illustration.settings.autoRelax) {
                t.text("Autorelax on");
            } else {
                t.text("Autorelax off");
            }
        };
        t_label()
        t.click(function() {
            illustration.settings.autoRelax = !illustration.settings.autoRelax;
            illustration.relaxer = null;
            t_label();
        });
    };

})(jQuery);
