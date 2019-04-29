/*

JQuery plugin helper n dimensional data projected onto 2d.

Assumes the element has been initialized using dual_canvas_helper.

The reference frame must be dedicated in the sense that the ND_frame
has the authority to reset the frame as needed.

Objects are ordered back to front using increasing "z" projection component if available
or decreasing "y" component if not.

If objects need to be reordered because a new object has been added
and object has been moved
or the projections have changed all objects
in the underlying frame are resorted.


Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/
"use strict";

(function($) {

    $.fn.nd_frame = function (options, element) {
        element = element || this;

        var numeric_default = function(value, default_value) {
            default_value = default_value || 0;
            if ((typeof value) == "number") {
                return value;
            }
            return default_value;
        }

        var permitted_projector_vars = {x: 1, y:2, z:3};

        class ND_Frame {
            constructor(options, element) {
                this.settings = $.extend({
                    // 2d frame to draw on.
                    dedicated_frame: null,
                    // name order for model variable conversion to/from arrays.
                    variable_name_order: null,
                    // mapping of variable name to x, y, (z) converter vectors
                    variable_projectors: null,
                    // translation in projection space
                    projected_translation: null,
                    is_frame: true,
                    events: true,   // by default support events
                    shape_name: "nd_frame",
                }, options);
                this.is_frame = true;
                // initialize or check data structures
                let vp = this.settings.variable_projectors;
                let vno = this.settings.variable_name_order;
                let model_origin = {};  // filled in from parameters
                let view_origin = {x: 0, y:0};  // possibly z too if specified
                if (vno) {
                    for (var i=0; i<vno.length; i++) {
                        let vname = vno[i];
                        model_origin[vname] = 0;
                    }
                }
                if (vp) {
                    for (var vname in vp) {
                        model_origin[vname] = 0;
                        let proj = vp[vname];
                        for (var pname in proj) {
                            view_origin[pname] = 0;
                            if (!permitted_projector_vars[pname]) {
                                throw new Error("unknown projection variable " + pname);
                            }
                        }
                    }
                    if (vno) {
                        // validate
                        for (var vname in vp) {
                            if (!vno.includes(vname)) {
                                throw new Error("all projection names should be in name order list.")
                            }
                        }
                    } else {
                        // use sorted names as name order
                        vno = [];
                        for (var vname in vp) {
                            vno.push(vname);
                        }
                        vno.sort();
                    }
                } else if (vno) {
                    // assign arbitrary unit vectors as projections for names.
                    vp = {};
                    var nnames = vno.length;
                    var theta = 2 * Math.PI / nnames;
                    for (var i=0; i<nnames; i++) {
                        var vname = vno[i];
                        var omega = theta * i;
                        vp[vname] = {y: Math.sin(omega), x: Math.cos(omega)};
                    }
                } else {
                    throw new Error("either variable_projectors or variable names must be specified.")
                }
                let pt = this.settings.projected_translation;
                if (!pt) {
                    pt = view_origin;
                }
                let view_variable_order = [];
                for (var vname in view_origin) {
                    view_variable_order.push(vname);
                }
                // fill in any missing variable slots
                pt = this.as_vector(pt, view_variable_order);
                for (var vname in vp) {
                    vp[vname] = this.as_vector(vp[vname], view_variable_order)
                }
                this.settings.view_variable_order = view_variable_order;
                this.settings.projected_translation = pt;
                this.settings.variable_projectors = vp;
                this.settings.variable_name_order = vno;
                this.settings.model_origin = model_origin;
                this.settings.view_origin = view_origin;
                this.reset();
            };
            prepare_for_redraw() {
                if (!this.changed) {
                    // leave frame alone.
                    return;
                }
                var object_list = this.object_list;
                // project the objects into frame coordinates
                for (var i=0; i<object_list.length; i++) {
                    var nd_object_info = object_list[i];
                    nd_object_info.project(this);
                }
                // sort the object order by z or -y.
                var comparison = function(a, b) {
                    var a_position = a.position2d();
                    var b_position = b.position2d();
                    var a_value = numeric_default(a_position.z, -a_position.y);
                    var b_value = numeric_default(b_position.z, -b_position.y);
                    return (a_value - b_value);
                }
                object_list.sort(comparison);
                // reset the frame object list in place in sorted order.
                // XXXX any "other" objects in the frame will be lost.
                var frame_object_list =  [];
                var dedicated_frame = this.settings.dedicated_frame;
                for (var i=0; i<object_list.length; i++) {
                    var object_info = object_list[i];
                    var description2d = object_info.description2d();
                    description2d.object_index = frame_object_list.length;
                    description2d.object_nd = object_info;
                    frame_object_list.push(description2d);
                }
                dedicated_frame.object_list = frame_object_list;
                this.changed = false;   // everything is up to date.
            };
            redraw_frame() {
                // Do nothing.
                // the dedicated frame should also be on the object list and it redraws the objects.
            };
            coordinate_conversion(position_vector) {
                let vp = this.settings.variable_projectors;
                if (!position_vector) {
                    throw new Error("falsy vector entry not allowed");
                }
                // convert from array as needed.
                position_vector = this.as_vector(position_vector);
                var result = this.settings.projected_translation;
                for (var vname in vp) {
                    var projector = vp[vname];
                    var coord_value = numeric_default(position_vector[vname], 0);
                    var increment = element.vscale(coord_value, projector);
                    result = element.vadd(result, increment);
                }
                return result;
            }
            reset() {
                this.settings.dedicated_frame.reset_frame();
                this.object_list = [];
                this.changed = false;
            };
            store_object(object) {
                this.object_list.push(object);
            };
            circle(opt) {
                return new ND_Circle(this, opt);
            };
            line(opt) {
                return new ND_Line(this, opt);
            };
            text(opt) {
                return new ND_Text(this, opt);
            };
            as_vector(descriptor, name_order) {
                // convert model array descriptor to mapping representation.
                name_order = name_order || this.settings.variable_name_order;
                let n = name_order.length;
                var mapping = {};
                if (Array.isArray(descriptor)) {
                    if (descriptor.length != n) {
                        throw new Error("array descriptor length should match names length.")
                    }
                    for (var i=0; i<n; i++) {
                        mapping[name_order[i]] = descriptor[i]
                    }
                } else {
                    // copy and fill in missing values with 0 (xxx don't check for extra slots?)
                    for (var i=0; i<n; i++) {
                        var vname = name_order[i];
                        mapping[vname] = numeric_default(descriptor[vname]);
                    }
                }
                return mapping;
            }
        };

        class ND_Shape {
            constructor(nd_frame, opt) {
                opt = $.extend({}, opt);
                var opt2d = $.extend({}, opt);
                var shape_name = this.shape_name();
                var dedicated_frame = nd_frame.settings.dedicated_frame;
                var method = dedicated_frame[shape_name];
                this.nd_frame = nd_frame;
                nd_frame.changed = true;
                // project the object
                this.opt = opt;
                opt2d = this.project(nd_frame, opt2d, opt);
                // draw the projected object (the first time) on the canvas
                this.opt2d = method(opt2d);
                nd_frame.store_object(this);
            };
            description2d() {
                return this.opt2d;
            }
            project(nd_frame, opt2d, opt) {
                opt2d = opt2d || this.opt2d;
                opt = opt || this.opt;
                this.mutate_coordinates(opt2d, opt, nd_frame);
                return opt2d;
            };
            mutate_coordinates(opt2d, opt, nd_frame) {
                opt2d.position = nd_frame.coordinate_conversion(opt.position)
            };
            position2d() {
                return this.opt2d.position;
            };
        };

        class ND_Circle extends ND_Shape {
            shape_name() { return "circle"; }  // xxxx should be a class member?
        };

        class ND_Text extends ND_Shape {
            shape_name() { return "text"; }  // xxxx should be a class member?
        };

        class ND_Line extends ND_Shape {
            shape_name() { return "line"; }  // xxxx should be a class member?
            mutate_coordinates(opt2d, opt, nd_frame) {
                opt2d.position1 = nd_frame.coordinate_conversion(opt.position1)
                opt2d.position2 = nd_frame.coordinate_conversion(opt.position2)
            };
            position2d() {
                return this.opt2d.position1;  // xxxx arbitrary choice; could use midpoint.
            };
        };

        var result = new ND_Frame(options, element);
        // Add the frame object to the parent canvas in place
        element.store_object_info(result, null, true);
        return result;
    };

    $.fn.nd_frame.invert = function(element, Vectors, variables) {
        //var element = this;

        // xxxx eventually move this somewhere else...
        class Matrix_Inverter {
            constructor(Vectors, variables) {
                this.Vectors = [];
                this.variables = variables;
                this.inverse = []
                this.N = Vectors.length;
                for (var i=0; i<this.N; i++) {
                    var vectori = Vectors[i];
                    var vari = variables[i];
                    this.Vectors[i] = element.vscale(1.0, vectori);
                    this.inverse[i] = element.vscale(0.0, vectori);
                    this.inverse[i][vari] = 1.0;
                }
            };
            member(i, j) {
                return this.Vectors[i][this.variables[j]];
            }
            calc() {
                var Vectors = this.Vectors;
                var inverse = this.inverse;
                var N = this.N;
                for (var i=0; i<N; i++) {
                    for (var j=i+1; j<N; j++) {
                        var Mii = this.member(i, i);
                        var Mji = this.member(j, i);
                        if ((i != j) && (Math.abs(Mii) < Math.abs(Mji))) {
                            this.swap(i, j);
                        }
                    }
                    this.normalize(i);
                    for (var j=0; j<N; j++) {
                        this.cancel(i, j);
                    }
                }
            };
            swap(i, j) {
                var Vectors = this.Vectors;
                var inverse = this.inverse;
                var a = Vectors[i];
                var b = Vectors[j];
                Vectors[i] = b;
                Vectors[j] = a;
                a = inverse[i];
                b = inverse[j];
                inverse[i] = b;
                inverse[j] = a;
            };
            normalize(i) {
                var Mii = this.member(i, i);
                var Vectors = this.Vectors;
                var inverse = this.inverse;
                var det = 1.0/Mii;
                Vectors[i] = element.vscale(det, Vectors[i]);
                inverse[i] = element.vscale(det, inverse[i]);
            };
            cancel(i, j) {
                if (i == j) {
                    return;
                }
                var Vectors = this.Vectors;
                var inverse = this.inverse;
                var Mji = this.member(j, i);
                var shiftM = element.vscale(- Mji, Vectors[i])
                Vectors[j] = element.vadd(shiftM, Vectors[j])
                var shiftinv = element.vscale(- Mji, inverse[i])
                inverse[j] = element.vadd(shiftinv, inverse[j])
            };
            mmult(Vectors1, Vectors2, variables) {
                Vectors2 = Vectors2 || this.inverse;
                variables = variables || this.variables;
                var N = variables.length;
                var result = [];
                for (var i=0; i<N; i++) {
                    result.push({});
                }
                for (var i=0; i<N; i++) {
                    for (var j=0; j<N; j++) {
                        var varj = variables[j];
                        var val = 0;
                        for (var k=0; k<N; k++) {
                            var vark = variables[k];
                            val += Vectors1[i][vark] * Vectors2[k][varj]
                        }
                        result[i][varj] = val;
                    }
                }
                return result;
            };
            left_multiply(Vectors2) {
                return this.mmult(this.inverse, Vectors2);
            }
        };

        return new Matrix_Inverter(Vectors, variables);
    };

    $.fn.nd_frame.example = function(element) {
    };

})(jQuery);
