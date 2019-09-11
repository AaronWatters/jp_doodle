

import jp_doodle_is_loaded from "../dist/index";

describe("gd_graph tests", () => {

    it("makes a node initially with no penalty", () => {
        var g = jQuery.fn.gd_graph();
        var n = g.get_or_make_node("xxx");
        expect(n.name).toEqual("xxx");
        expect(n.penalty).toEqual(0.0);
        expect(n.gradient).toEqual({x:0, y:0});
    });

    it("calibrates", () => {
        var g = jQuery.fn.gd_graph({
            origin_height: 32,
            origin_radius: 4
        });
        var origin_scale = g.settings.origin_scale;
        expect(origin_scale).toEqual(2);
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