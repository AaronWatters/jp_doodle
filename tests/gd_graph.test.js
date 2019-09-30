

import jp_doodle_is_loaded from "../dist/index";

describe("gd_graph tests", () => {

    it("zooms a graph", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 2, link_radius: 1});
        var e1 = g.add_edge(1,2,-5);
        var e2 = g.add_edge(3,2,7);
        var n1 = g.get_node(1).set_position({x:0, y:0});
        var n2 = g.get_node(2).set_position({x:5, y:5});
        var n3 = g.get_node(3).set_position({x:0, y:-5});
        var z = g.zoomGraph(5, true);
        expect(z.settings.separator_radius).toEqual(10);
        expect(z.settings.probe_limit).toEqual(g.settings.probe_limit);
        expect(z.get_node(2)).not.toEqual(null);
    });

    it("relax runs 2 steps", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 2, link_radius: 1});
        var e1 = g.add_edge(1,2,-5);
        var e2 = g.add_edge(3,2,7);
        var n1 = g.get_node(1).set_position({x:0, y:0});
        var n2 = g.get_node(2).set_position({x:5, y:5});
        var n3 = g.get_node(3).set_position({x:0, y:-5});
        g.initialize_penalties();
        var penalty_before = g.penalty;
        var r = g.relaxer();
        var r_out = r.run(2);
        expect(r_out.nodename).not.toEqual(null);
        expect(r_out.count).toEqual(2);
        var penalty_after = g.penalty;
        expect(penalty_before).toBeGreaterThan(penalty_after);
    });

    it("relax runs 0 steps if graph is empty", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 2, link_radius: 1});
        g.initialize_penalties();
        var penalty_before = g.penalty;
        expect(penalty_before).toEqual(0)
        var r = g.relaxer();
        var r_out = r.run(2);
        expect(r_out.nodename).toEqual(null);
        expect(r_out.count).toEqual(1);
        var penalty_after = g.penalty;
        expect(penalty_before).toEqual(penalty_after);
    });

    it("relaxes one step", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 10, link_radius: 2, min_change:0.00001});
        var n1 = g.get_or_make_node(1).set_position({x:1, y:0});
        var n2 = g.get_or_make_node(2).set_position({x:0, y:0});
        var e1 = g.add_edge(1,2,-5);
        g.initialize_penalties();
        var penalty_before = g.penalty;
        var r = g.relaxer();
        var r_node = r.step();
        expect(r_node).not.toEqual(null);
        var penalty_after = g.penalty;
        expect(penalty_before).toBeGreaterThan(penalty_after);
    });

    it("doesn't probe if not needed", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 0, link_radius: 0, origin_radius:1000.0});
        var n1 = g.get_or_make_node(1).set_position({x:0, y:0});
        var n2 = g.get_or_make_node(2).set_position({x:0, y:0});
        var e1 = g.add_edge(1,2,-5);
        var k = e1.key;
        g.initialize_penalties();
        var penalty_before = g.penalty;
        expect(penalty_before).toEqual(0);
        var result = n1.probe();
        var penalty_after = g.penalty;
        expect(penalty_before).toEqual(penalty_after);
        //console.log(result);
        expect(result.change).toEqual(0);
    });

    it("probes a node inward", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 3.1, link_radius: 3.1, origin_radius:1000.0});
        var n1 = g.get_or_make_node(1).set_position({x:0, y:0});
        var n2 = g.get_or_make_node(2).set_position({x:3, y:0});
        var e1 = g.add_edge(1,2,-5);
        var k = e1.key;
        g.initialize_penalties();
        var penalty_before = g.penalty;
        var result = n1.probe();
        var penalty_after = g.penalty;
        expect(penalty_before).toBeGreaterThan(penalty_after);
        //console.log(result);
        expect(result.change).toBeGreaterThan(0);
    });

    it("probes a node outward", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 10, link_radius: 2, origin_radius:1000.0});
        var n1 = g.get_or_make_node(1).set_position({x:0, y:0});
        var n2 = g.get_or_make_node(2).set_position({x:3, y:0});
        var e1 = g.add_edge(1,2,-5);
        var k = e1.key;
        g.initialize_penalties();
        var penalty_before = g.penalty;
        var result = n1.probe();
        var penalty_after = g.penalty;
        expect(penalty_before).toBeGreaterThan(penalty_after);
        //console.log(result);
        expect(result.change).toBeGreaterThan(0);
    });

    it("repositions a node", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 10, link_radius: 2, origin_radius:1000.0});
        var n1 = g.get_or_make_node(1).set_position({x:0, y:0});
        var n2 = g.get_or_make_node(2).set_position({x:3, y:0});
        var e1 = g.add_edge(1,2,-5);
        var k = e1.key;
        g.initialize_penalties();
        var initial_link_p = n1.edge_key_to_increment[k][0];
        n1.reposition({x: -1, y:0});  // further away: link penalty should increase.
        var after_link_p = n1.edge_key_to_increment[k][0];
        expect(initial_link_p).toBeLessThan(after_link_p);
        expect(g.penalty).toEqual(n1.penalty + n2.penalty);
        expect(n1.neighbor_to_increment[2][0]).toEqual(n2.neighbor_to_increment[1][0]);
        expect(n1.edge_key_to_increment[k][0]).toEqual(n2.edge_key_to_increment[k][0])
    });

    it("initializes penalties", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 4, link_radius: 2, origin_radius:1000.0});
        var n1 = g.get_or_make_node(1).set_position({x:0, y:0});
        var n2 = g.get_or_make_node(2).set_position({x:3, y:0});
        var e1 = g.add_edge(1,2,-5);
        g.initialize_penalties();
        expect(g.penalty).toEqual(n1.penalty + n2.penalty);
        expect(n1.neighbor_to_increment[2][0]).toEqual(n2.neighbor_to_increment[1][0]);
        var k = e1.key;
        expect(n1.edge_key_to_increment[k][0]).toEqual(n2.edge_key_to_increment[k][0])
    });

    it("removes external penalties", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 4, link_radius: 2, origin_radius:1000.0});
        var n1 = g.get_or_make_node(1).set_position({x:0, y:0});
        var n2 = g.get_or_make_node(2).set_position({x:3, y:0});
        var e1 = g.add_edge(1,2,-5);
        // must compute edge penalties first!
        e1.compute_penalty();
        n1.compute_components(); 
        var p_g1 = n1.sum_penalty(); 
        n1.apply_external_penalties();
        n1.remove_external_penalties()
        expect(n2.neighbor_to_increment[1]).toBeFalsy();
        var k = e1.key;
        expect(n2.edge_key_to_increment[k]).toBeFalsy();
    });

    it("applies external penalties", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 4, link_radius: 2, origin_radius:1000.0});
        var n1 = g.get_or_make_node(1).set_position({x:0, y:0});
        var n2 = g.get_or_make_node(2).set_position({x:3, y:0});
        var e1 = g.add_edge(1,2,-5);
        // must compute edge penalties first!
        e1.compute_penalty();
        n1.compute_components(); 
        var p_g1 = n1.sum_penalty(); 
        n1.apply_external_penalties();
        expect(n1.neighbor_to_increment[2][0]).toEqual(n2.neighbor_to_increment[1][0]);
        var k = e1.key;
        expect(n1.edge_key_to_increment[k][0]).toEqual(n2.edge_key_to_increment[k][0])
    });

    it("pushes towards the origin", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 2, link_radius: 1, origin_radius:100.0});
        var n1 = g.get_or_make_node(1).set_position({x:0, y:0});
        var n2 = g.get_or_make_node(2).set_position({x:500, y:0});
        n1.compute_components(); 
        var p_g1 = n1.sum_penalty(); 
        n2.compute_components(); 
        var p_g2 = n2.sum_penalty(); 
        expect(p_g1[0]).toEqual(0);
        expect(p_g1[1].y).toEqual(0);
        expect(p_g1[1].x).toEqual(0);
        expect(p_g2[0]).toBeGreaterThan(0);
        expect(p_g2[1].y).toEqual(0);
        expect(p_g2[1].x).toBeGreaterThan(0);
    });

    it("pushes too close nodes apart", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 20, link_radius: 1, origin_radius:100.0});
        var n1 = g.get_or_make_node(1).set_position({x:0, y:0});
        var n2 = g.get_or_make_node(2).set_position({x:1, y:0});
        n1.compute_components(); 
        var p_g1 = n1.sum_penalty(); 
        n2.compute_components(); 
        var p_g2 = n2.sum_penalty(); 
        expect(p_g1[0]).toBeGreaterThan(0);
        expect(p_g1[1].y).toEqual(0);
        expect(p_g1[1].x).toBeGreaterThan(0);
        expect(p_g2[0]).toBeGreaterThan(0);
        expect(p_g2[1].y).toEqual(0);
        expect(p_g2[1].x).toBeLessThan(0);
    });

    it("pushes too far linked nodes together", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 2, link_radius: 1, origin_radius:1000.0});
        var n1 = g.get_or_make_node(1).set_position({x:-2, y:0});
        var n2 = g.get_or_make_node(2).set_position({x:2, y:0});
        var e1 = g.add_edge(1,2,-5);
        // must compute edge penalties first!
        e1.compute_penalty();
        n1.compute_components(); 
        var p_g1 = n1.sum_penalty(); 
        n2.compute_components(); 
        var p_g2 = n2.sum_penalty(); 
        expect(p_g1[0]).toBeGreaterThan(0);
        expect(p_g1[1].y).toEqual(0);
        expect(p_g1[1].x).toBeLessThan(0);
        expect(p_g2[0]).toBeGreaterThan(0);
        expect(p_g2[1].y).toEqual(0);
        expect(p_g2[1].x).toBeGreaterThan(0);
    });

    it("sums penalties", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 2, link_radius: 1});
        var e1 = g.add_edge(1,2,-5);
        var e2 = g.add_edge(3,2,7);
        var n1 = g.get_node(1).set_position({x:0, y:0});
        var n2 = g.get_node(2).set_position({x:0, y:5});
        var n3 = g.get_node(3).set_position({x:0, y:-5});
        // must compute edge penalties first!
        e1.compute_penalty();
        e2.compute_penalty();
        expect(e1.penalty).toBeGreaterThan(0);
        expect(e2.penalty).toBeGreaterThan(0);
        n2.compute_components(); 
        var p_g = n2.sum_penalty(); 
        expect(n2.position).toEqual({x:0, y:5});
        expect(p_g[0]).toBeGreaterThan(0);
        expect(p_g[1].x).toEqual(0);
        expect(p_g[1].y).toBeGreaterThan(0);
    });

    it("sets positions and gets neighbors", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 5});
        var e1 = g.add_edge(1,2,-5);
        g.add_edge(3,2,7);
        var n1 = g.get_node(1).set_position({x:0, y:0});
        var n2 = g.get_node(2).set_position({x:0, y:5});
        var n3 = g.get_node(3).set_position({x:0, y:-5});
        expect(n1.position).toEqual({x:0, y:0});
        expect(n2.abs_weight()).toEqual(12);
        expect(g.neighbors(n2.group)).toEqual({"1": n1, "2": n2});
        // check edge
        var edge = null;
        for (var key in n1.key_to_edge) {
            expect(edge).toEqual(null);
            edge = n1.key_to_edge[key];
        }
        expect(edge).toEqual(e1);
        expect(edge.other_name(1)).toEqual(2)
    });

    it("makes a ngraph with an edge initially no penalty", () => {
        var g = jQuery.fn.gd_graph();
        var e = g.add_edge(1,2,-5);
        expect(e.weight).toEqual(-5);
        expect(e.abs_weight).toEqual(5);
        expect(e.penalty).toEqual(0.0);
        expect(e.gradient).toEqual({x:0, y:0});
        expect(e.other_name(2)).toEqual(1);
    });

    it("groups and ungroups a node", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 3});
        var n = g.get_or_make_node("xxx");
        g.group({x:-5, y:9}, n);
        expect(n.group.x).toEqual(-2);
        expect(g.group_to_nodemap["i-2:3"]["xxx"]).toEqual(n)
        g.ungroup(n);
        expect(n.group).toEqual(null);
        expect(g.group_to_nodemap["i-2:3"]).toEqual({})
    });

    it("computes group indices", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 3});
        var grp = g.group_index({x:-5, y:9})
        expect(grp.x).toEqual(-2);
        expect(grp.y).toEqual(3);
        expect(grp.index).toEqual("i-2:3");
    });

    it("computes a positive edge penalty for nodes too far separated", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 3});
        var m = g.matrix_op;
        var e = g.add_edge(1,2,-5);
        g.get_node(1).set_position({x:0, y:0});
        g.get_node(2).set_position({x:0, y:5});
        e.compute_penalty();
        expect(e.penalty).toBeGreaterThan(0);
        var inc1 = e.node_increment(1);
        var inc2 = e.node_increment(2);
        expect(e.penalty).toEqual(inc2[0]);
        expect(inc1[0]).toEqual(inc2[0]);
        expect(m.vscale(-1.0, inc1[1])).toEqual(inc2[1]);
    });

    it("computes a zero edge penalty for close nodes", () => {
        var g = jQuery.fn.gd_graph({separator_radius: 3});
        var e = g.add_edge(1,2,-5);
        var n1 = g.get_node(1).set_position({x:0, y:0});
        var n2 = g.get_node(2).set_position({x:0, y:1});
        e.compute_penalty();
        expect(e.penalty).toEqual(0);
    });

    it("makes a node initially with no penalty", () => {
        var g = jQuery.fn.gd_graph();
        var n = g.get_or_make_node("xxx");
        expect(n.name).toEqual("xxx");
        expect(n.penalty).toEqual(0.0);
        expect(n.gradient).toEqual({x:0, y:0});
    });

    it("computes linear extrapolation link penalties for farish points", () => {
        var g = jQuery.fn.gd_graph({
            link_radius: 2,
            link_height: 2,
        });
        var xy = g.xy([13, 4]);
        var xy2 = g.xy([13, 12]);
        var pg = g.link_penalty(xy, xy2, 4);
        expect(pg[0]).toEqual(64);
        expect(pg[1]).toEqual(g.xy([0, -8]))
    });

    it("computes quadratic link penalties for nearish points", () => {
        var g = jQuery.fn.gd_graph({
            link_radius: 2,
            link_height: 2,
        });
        var xy = g.xy([13, 4]);
        var xy2 = g.xy([13, 7]);
        var pg = g.link_penalty(xy, xy2, 4);
        expect(pg[0]).toEqual(8);
        expect(pg[1]).toEqual(g.xy([0, -4]))
    });

    it("computes trivial link penalties for close points", () => {
        var g = jQuery.fn.gd_graph({
            link_radius: 2,
            link_height: 2,
        });
        var xy = g.xy([13, 4]);
        var pg = g.link_penalty(xy, xy, 334);
        expect(pg[0]).toEqual(0);
        expect(pg[1]).toEqual(g.xy([0, 0]))
    });

    it("computes trivial separation penalties for remote points", () => {
        var g = jQuery.fn.gd_graph({
            separator_radius: 2,
            separation_height: 2,
            epsilon: 0.00001,
        });
        var xy = g.xy([13, 4]);
        var xy2 = g.xy([4, 4]);
        var pg = g.separation_penalty(xy, xy2);
        expect(pg[0]).toEqual(0);
        expect(pg[1]).toEqual(g.xy([0, 0]))
    });

    it("computes separation penalties for close points", () => {
        var g = jQuery.fn.gd_graph({
            separator_radius: 2,
            separation_height: 2,
            epsilon: 0.00001,
        });
        var xy = g.xy([3, 4]);
        var xy2 = g.xy([4, 4]);
        var pg = g.separation_penalty(xy, xy2);
        expect(pg[0]).toEqual(0.5);
        expect(pg[1]).toEqual(g.xy([1, 0]))
    });

    it("computes separation penalties for same point", () => {
        var g = jQuery.fn.gd_graph({
            separator_radius: 2,
            separation_height: 2,
            epsilon: 1,
        });
        var xy = g.xy([3, 4]);
        var pg = g.separation_penalty(xy, xy);
        expect(pg[0]).toEqual(0.5);
        expect(pg[1]).toEqual(g.xy([1, 0]))
    });

    it("computes origin penalties", () => {
        var g = jQuery.fn.gd_graph({
            origin_height: 16,
            origin_radius: 4
        });
        var xy = g.xy([3, 4]); // length = 5
        var pg = g.origin_penalty(xy);
        expect(pg[0]).toEqual(25);
        expect(pg[1]).toEqual(g.xy([6, 8]))
    });

    it("calibrates", () => {
        var g = jQuery.fn.gd_graph({
            origin_height: 32,
            origin_radius: 4,
            separation_height: 2,
            separator_radius: 2,
        });
        var origin_scale = g.settings.origin_scale;
        expect(origin_scale).toEqual(2);
        expect(g.settings.separation_scale).toEqual(0.5);
    });

    it("spirals", () => {
        var G = jQuery.fn.gd_graph();
        expect(G.grid_spiral_coordinates(0)).toEqual({x:0, y:0});
        expect(G.grid_spiral_coordinates(1)).toEqual({x:1, y:-1});
        expect(G.grid_spiral_coordinates(2)).toEqual({x:1, y:0});
        expect(G.grid_spiral_coordinates(3)).toEqual({x:1, y:1});
        expect(G.grid_spiral_coordinates(4)).toEqual({x:0, y:1});
        expect(G.grid_spiral_coordinates(5)).toEqual({x:-1, y:1});
        expect(G.grid_spiral_coordinates(6)).toEqual({x:-1, y:0});
        expect(G.grid_spiral_coordinates(7)).toEqual({x:-1, y:-1});
        expect(G.grid_spiral_coordinates(8)).toEqual({x:0, y:-1});
        expect(G.grid_spiral_coordinates(9)).toEqual({x:2, y:-2});
        expect(G.grid_spiral_coordinates(10)).toEqual({x:2, y:-1});
    });

    it("makes a 2d vector", () => {
        var g = jQuery.fn.gd_graph();
        var v = g.xy([2,5])
        expect(v).toEqual({x:2, y:5});
    });

    it("creates a unionizer", () => {
        var u = jQuery.fn.gd_graph.unionizer();
        u.join(1, 3);
        u.join(2, 4);
        //var m = u.mapping;
        //for (var k in m) {
        //    console.log(k +" :: " + m[k])
        //}
        expect(u.representative(2)).toEqual(u.representative(4));
        expect(u.representative(1)).toEqual(u.representative(3));
        expect(u.representative(2)).not.toEqual(u.representative(1));
    });

    it("creates a qset", () => {
        var q = jQuery.fn.gd_graph.qset();
        expect(q.is_empty()).toBe(true);
        expect(q.pop()).toBe(null);
        q.push(5);
        expect(q.is_empty()).toBe(false);
        q.push(7);
        q.push(6);
        q.push(5);
        q.push(7);
        expect(q.pop()).toEqual(5);
        expect(q.pop()).toEqual(7);
        expect(q.pop()).toEqual(6);
        expect(q.pop()).toBe(null);
        expect(q.is_empty()).toBe(true);
    });
    it("creates a filled qset", () => {
        var q = jQuery.fn.gd_graph.qset([5, 7]);
        q.push(5);
        expect(q.is_empty()).toBe(false);
        q.push(7);
        q.push(6);
        q.push(5);
        q.push(7);
        expect(q.pop()).toEqual(5);
        expect(q.pop()).toEqual(7);
        expect(q.pop()).toEqual(6);
        expect(q.pop()).toBe(null);
        expect(q.is_empty()).toBe(true);
    });

});