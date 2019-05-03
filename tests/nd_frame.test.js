

import jp_doodle_is_loaded from "../dist/index";

describe("nd_frame affine tests", () => {

    it("creates a matrix", () => {
        var vv = {u: {x: -10}};
        var vi_order = ["u"];
        var vj_order = ["x"];
        //console.log("x = " + jQuery.fn.nd_frame.matrix);
        var m = jQuery.fn.nd_frame.matrix(vv, vi_order, vj_order);
        var val = m.maxabs();
        expect(val).toEqual(10);
    });
    
    it("vscales", () => {
        var vv = {u: {x: -10}};
        //console.log("x = " + jQuery.fn.nd_frame.matrix);
        var m = jQuery.fn.nd_frame.matrix(vv);
        var v = m.vscale(2, {x: 10, y:5})
        expect(v).toEqual({x: 20, y:10});
    });

    it("vadds", () => {
        var vv = {u: {x: -10}};
        //console.log("x = " + jQuery.fn.nd_frame.matrix);
        var m = jQuery.fn.nd_frame.matrix(vv);
        var v = m.vadd({x:-5, y:3}, {x: 10, y:5})
        expect(v).toEqual({x: 5, y:8});
    });

    it("vsubs", () => {
        var vv = {u: {x: -10}};
        //console.log("x = " + jQuery.fn.nd_frame.matrix);
        var m = jQuery.fn.nd_frame.matrix(vv);
        var v = m.vsub({x:-5, y:3}, {x: 10, y:5})
        expect(v).toEqual({x: -15, y:-2});
    });

    it("vdots", () => {
        var vv = {u: {x: -10}};
        //console.log("x = " + jQuery.fn.nd_frame.matrix);
        var m = jQuery.fn.nd_frame.matrix(vv);
        var v = m.vdot({x:-5, y:3}, {x: 10, y:5})
        expect(v).toEqual(-35);
    });

    it("gets lengths", () => {
        var vv = {u: {x: -10}};
        //console.log("x = " + jQuery.fn.nd_frame.matrix);
        var m = jQuery.fn.nd_frame.matrix(vv);
        var v = m.vlength({x:3, y:-4})
        expect(v).toEqual(5);
    });

    it("gets unit vectors", () => {
        var vv = {u: {x: -10}};
        //console.log("x = " + jQuery.fn.nd_frame.matrix);
        var m = jQuery.fn.nd_frame.matrix(vv);
        var v = m.vunit({x:3, y:-4})
        //expect(v).toBeCloseTo({x:0.6, y:-0.8});
        expect(v.x).toBeCloseTo(0.6, 5);
        expect(v.y).toBeCloseTo(-0.8, 5);
    });

    it("dots", () => {
        var vv = {
            u: {x: 0, y: 1},
            v: {x: -1, y: 0},
        };
        var d = {x: 4, y: 3};
        //console.log("x = " + jQuery.fn.nd_frame.matrix);
        var m = jQuery.fn.nd_frame.matrix(vv);
        var v = m.dot(d)
        expect(v).toEqual({"u": 3, "v": -4});
    });

    it("trivial mmults", () => {
        var vv = {u: {x: -10}};
        var m = jQuery.fn.nd_frame.matrix(vv);
        var vv1 = {x: {y: -2}};
        var m2 = jQuery.fn.nd_frame.matrix(vv1);
        var mm = m.mmult(m2);
        expect(mm.matrix).toEqual({u: {y: 20}});
    });

    it("mmults", () => {
        var vv = {
            u: {x: -1, y: 2},
            v: {x: 2, y: 0},
        };
        var m = jQuery.fn.nd_frame.matrix(vv);
        var vv1 = {
            x: {z: 1, w: 2},
            y: {z: -1, w:-1}
        };
        var m2 = jQuery.fn.nd_frame.matrix(vv1);
        var mm = m.mmult(m2);
        var vmm = {
            "u": {"w": -4, "z": -3}, 
            "v": {"w": 4, "z": 2}
        }
        expect(mm.matrix).toEqual(vmm);
    });

    it("mscales", () => {
        var vv = {
            u: {x: -1, y: 2},
            v: {x: 2, y: 1},
        };
        var m = jQuery.fn.nd_frame.matrix(vv);
        var ms = m.mscale(3);
        var vs = {
            u: {x: -3, y: 6},
            v: {x: 6, y: 3},
        };
        expect(ms.matrix).toEqual(vs);
    });

    it("gets columns", () => {
        var vv = {
            u: {x: -1, y: 2},
            v: {x: 2, y: 0},
        };
        var m = jQuery.fn.nd_frame.matrix(vv);
        var c = m.column("x")
        expect(c).toEqual({u: -1, v:2});
    });

    it("eyes", () => {
        var vv = {
            u: {x: -10},
            v: {y: -13}
        };
        //console.log("x = " + jQuery.fn.nd_frame.matrix);
        var m = jQuery.fn.nd_frame.matrix(vv,);
        var val = m.eye();
        var eye = {
            u: {x: 1},
            v: {y: 1}
        };
        expect(val.matrix).toEqual(eye);
    });

    it("trivial inverts", () => {
        var vv = {
            u: {x: 1},
            v: {y: 1}
        };
        var m = jQuery.fn.nd_frame.matrix(vv);
        var eye = {
            x: {u: 1},
            y: {v: 1}
        };
        var m2 = jQuery.fn.nd_frame.matrix(eye);
        var minv = m.invert();
        expect(minv.divergence(m2)).toEqual(0);
    });

    it("converts to table", () => {
        var vv = {
            u: {x: 1},
        };
        var m = jQuery.fn.nd_frame.matrix(vv);
        var t = m.as_table(" ", " ");
        var e = "<table border><tr><th>&nbsp;</th>  <th>x</th> </tr>  <tr><th>u</th>  <td>1</td> </tr> </table>";
        expect(t).toEqual(e);
    });

    it("augments", () => {
        var vv = {
            u: {x: 1},
        };
        var m = jQuery.fn.nd_frame.matrix(vv);
        var ma = m.augment();
        var e = {"_t": {"_t": 1}, "u": {"x": 1}};
        var ma2 = jQuery.fn.nd_frame.matrix(e)
        expect(ma.divergence(ma2)).toEqual(0);
    });

    it("does affine transforms", () => {
        var vv = {
            u: {x: -2},
        };
        var tt = {u: 10};
        var m = jQuery.fn.nd_frame.matrix(vv);
        var ma = m.augment(tt);
        var e = {"_t": {"_t": 1}, "u": {"_t": 10, "x": -2}};
        var ma2 = jQuery.fn.nd_frame.matrix(e)
        expect(ma.divergence(ma2)).toEqual(0);
        var proj = ma.affine({x: 3});
        expect(proj).toEqual({u: 4});
        var tt2 = ma.translation();
        expect(tt2).toEqual(tt);
        var vv2 = ma.axes();
        expect(vv2).toEqual({"x": {"u": -2}})
    });

    it("inverts", () => {
        var vv = {
            u: {x: 1, y:1},
            v: {x: 1, y:-1}
        };
        var m = jQuery.fn.nd_frame.matrix(vv);
        var inv = {
            x: {u: 0.5, v: 0.5},
            y: {u: 0.5, v: -0.5}
        };
        var minv = m.invert();
        expect(minv.matrix).toEqual(inv);
        var mminv = m.mmult(minv);
        var identity = m.eye().mmult(minv.eye())
        expect(mminv.divergence(identity)).toEqual(0);
    });

    it("inverts again", () => {
        var vv = {
            u: {x: 1, y:1},
            v: {x: 2, y:-1}
        };
        var m = jQuery.fn.nd_frame.matrix(vv);
        var minv = m.invert();
        var mminv = m.mmult(minv);
        var identity = m.eye().mmult(minv.eye());
        expect(mminv.divergence(identity)).toBeCloseTo(0);
    });

    it("inverts 4d", () => {
        var vv = {
            x: {point: -1, center_shift: -1, center: -1, center_norm: 0},
            y: {point: -2, center_shift: -1, center: -2, center_norm: -2},
            z: {point: 0, center_shift: -3, center: -3, center_norm: -3},
            _t: {point: 1, center_shift: 1, center: 1, center_norm: 1},
        };
        var m = jQuery.fn.nd_frame.matrix(vv);
        var minv = m.invert();
        var mminv = m.mmult(minv);
        var identity = m.eye().mmult(minv.eye());
        //expect(minv.matrix).toEqual(null);  // debug
        expect(mminv.divergence(identity)).toBeCloseTo(0);
    });

    it("transposes", () => {
        var vv = {
            u: {x: -10},
            v: {y: -13}
        };
        //console.log("x = " + jQuery.fn.nd_frame.matrix);
        var m = jQuery.fn.nd_frame.matrix(vv,);
        var val = m.transpose();
        var tp = {
            x: {u: -10},
            y: {v: -13}
        };
        expect(val.matrix).toEqual(tp);
    });

    it("swaps", () => {
        var vv = {
            u: {x: -10},
            v: {y: -13}
        };
        //console.log("x = " + jQuery.fn.nd_frame.matrix);
        var m = jQuery.fn.nd_frame.matrix(vv,);
        m.swap(0,1);
        var tp = {
            v: {x: -10},
            u: {y: -13}
        };
        expect(m.matrix).toEqual(tp);
    });

    it("normalizes", () => {
        var vv = {
            u: {x: -10, y:2},
            v: {x: 4, y: -13}
        };
        //console.log("x = " + jQuery.fn.nd_frame.matrix);
        var m = jQuery.fn.nd_frame.matrix(vv,);
        m.normalize("v", -1);
        var tp = {
            u: {x: -10, y:2},
            v: {x: -4, y: 13}
        };
        expect(m.matrix).toEqual(tp);
    });

    it("infers variables", () => {
        var vv = {
            u: {x: -10},
            v: {y: -13}
        };
        //console.log("x = " + jQuery.fn.nd_frame.matrix);
        var m = jQuery.fn.nd_frame.matrix(vv,);
        var val = m.maxabs();
        expect(val).toEqual(13);
        expect(m.orderi).toEqual(["u", "v"]);
        expect(m.orderj).toEqual(["x", "y"]);
        // check defaults
        expect(m.member("v", "x")).toEqual(0);
    });

    it("sets members", () => {
        var vv = {
            u: {x: -10},
            v: {y: -13}
        };
        //console.log("x = " + jQuery.fn.nd_frame.matrix);
        var m = jQuery.fn.nd_frame.matrix(vv,);
        m.set_member("u", "x", 88);
        expect(m.member("u", "x")).toEqual(88);
        m.set_member("v", "x", 188);
        expect(m.member("v", "x")).toEqual(188);
    });

    it("clones a matrix", () => {
        var vv = {
            u: {x: -10},
            v: {y: -13}
        };
        //console.log("x = " + jQuery.fn.nd_frame.matrix);
        var m = jQuery.fn.nd_frame.matrix(vv,);
        var m2 = m.clone();
        var val = m.maxabs();
        var val2 = m2.maxabs();
        expect(val).toEqual(13);
        expect(val).toEqual(val2);
        expect(m.orderi).toEqual(m2.orderi);
        expect(m.orderj).toEqual(m2.orderj);
        expect(m.matrix).toEqual(m2.matrix);
    });

    it("detects divergence", () => {
        var vv = {u: {x: -10}};
        var vv2 = {u: {x: -11}};
        var vi_order = ["u"];
        var vj_order = ["x"];
        var m = jQuery.fn.nd_frame.matrix(vv, vi_order, vj_order);
        var m2 = jQuery.fn.nd_frame.matrix(vv2, vi_order, vj_order);
        var div1 = m.divergence(m2);
        var div2 = m2.divergence(m);
        expect(div1).toEqual(div2);
        expect(div1).toBeGreaterThan(0);
    });

    it("trivial orbit rotates", () => {
        var vv = {u: {x: -10}};
        var m = jQuery.fn.nd_frame.matrix(vv);
        var center3d = {x: -1, y:-2, z: -3};
        var radius = 3;
        var shift2d = {};  // no rotation.
        var rotation = m.orbit_rotation_xyz(center3d, radius, shift2d);
        var eye = rotation.eye();
        expect(rotation.divergence(eye)).toBeCloseTo(0);
    });

    it("orbit rotates back and forth", () => {
        var vv = {u: {x: -10}};
        var m = jQuery.fn.nd_frame.matrix(vv);
        var center3d = {x: -1, y:-2, z: -3};
        var radius = 3;
        var shift2d = {x: 1};
        var rotation1 = m.orbit_rotation_xyz(center3d, radius, shift2d);
        var rotation2 = m.orbit_rotation_xyz(center3d, radius, {x: -1})
        var both = rotation1.mmult(rotation2);
        var eye = rotation1.eye();
        expect(both.divergence(eye)).toBeCloseTo(0);
    });

    it("orbit rotates back and forth diagonally", () => {
        var vv = {u: {x: -10}};
        var m = jQuery.fn.nd_frame.matrix(vv);
        var center3d = {x: -1, y:-2, z: -3};
        var radius = 33;
        var shift2d = {x: 1, y:2.2};
        var shift2dback = m.vsub({},  shift2d);
        var rotation1 = m.orbit_rotation_xyz(center3d, radius, shift2d);
        var rotation2 = m.orbit_rotation_xyz(center3d, radius, shift2dback)
        var both = rotation1.mmult(rotation2);
        var eye = rotation1.eye();
        expect(both.divergence(eye)).toBeCloseTo(0);
    });

});
