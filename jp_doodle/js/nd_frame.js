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

    $.fn.nd_frame.matrix = function(variable_to_vector, vi_order, vj_order) {
        //var element = this;

        // xxxx eventually move this somewhere else...
        class Matrix {
            constructor(variable_to_vector, vi_order, vj_order) {
                variable_to_vector = variable_to_vector || {};
                var get_sample = function (order) {
                    var result = {};
                    if (order) {
                        for (var i=0; i<order.length; i++) {
                            result[order[i]] = 1
                        }
                    }
                    return result;
                };
                var samplei = get_sample(vi_order);
                var samplej = get_sample(vj_order);
                var check_var = function (vname, sample, order) {
                    if (order) {
                        if (!(sample[vname])) {
                            throw new Error("var name not in order array " + vname + " " + order);
                        } 
                    } else {
                        sample[vname] = 1
                    }
                };
                var matrix = {};
                for (var vi in variable_to_vector) {
                    check_var(vi, samplei, vi_order);
                    var vec = variable_to_vector[vi];
                    var row = {};
                    for (var vj in vec) {
                        check_var(vj, samplej, vj_order);
                        row[vj] = vec[vj];
                    }
                    matrix[vi] = row;
                }
                // define all vi vectors if needed
                for (var vi in samplei) {
                    matrix[vi] = matrix[vi] || {};
                }
                // define orders if needed
                var order_for = function(sample, order) {
                    if (order) {
                        return order;
                    }
                    var order = [];
                    for (var v in sample) {
                        order.push(v);
                    }
                    order.sort();
                    return order;
                }
                this.orderi = order_for(samplei, vi_order);
                this.orderj = order_for(samplej, vj_order);
                this.samplei = samplei;
                this.samplej = samplej;
                this.matrix = matrix;
            };
            clone() {
                return new Matrix(this.matrix, this.orderi, this.orderj);
            }
            default_value(x) {
                if (x) {
                    return x;
                }
                return 0.0;
            };
            check_names(vi, vj) {
                if ((!(this.samplei[vi])) || (!(this.samplej[vj])) ) {
                    throw new Error("bad variable name(s) " + [vi, vj]);
                }
            }
            member(vi, vj, permissive) {
                if (!permissive) {
                    this.check_names(vi, vj);
                }
                var rowi = this.matrix[vi];
                if (rowi) {
                    return this.default_value(rowi[vj]);
                }
                return this.default_value();  // default
            }
            set_member(vi, vj, value, permissive) {
                if (!permissive) {
                    this.check_names(vi, vj);
                }
                var row = this.matrix[vi] || {};
                row[vj] = value;
                this.matrix[vi] = row;
            }
            vscale(scalar, vector) {
                var result = {};
                for (var v in vector) {
                    result[v] = scalar * vector[v];
                };
                return result;
            };
            vadd(v1, v2) {
                var result = {};
                var that = this;
                var addv1v2 = function(v1, v2) {
                    for (var v in v1) {
                        if (!result[v]) {
                            result[v] = v1[v] + that.default_value(v2[v]);
                        }
                    }
                }
                addv1v2(v1, v2);
                addv1v2(v2, v1);
                return result;
            };
            vdot(v1, v2) {
                var result = 0;
                for (var v in v1) {
                    result += v1[v] * this.default_value(v2[v]);
                }
                return result;
            };
            dot(vector) {
                // matrix.dot(vector) like numpy (M.v)
                var result = {};
                var matrix = this.matrix;
                for (var vi in matrix) {
                    var row = matrix[vi];
                    result[vi] = this.vdot(row, vector);
                }
                return result;
            }
            eye(permissive) {
                // identity matrix of same shape as this.
                var orderi = this.orderi;
                var orderj = this.orderj;
                var leni = orderi.length;
                var lenj = orderj.length;
                if ((!permissive) && (leni != lenj)) {
                    throw new Error("cannot get identity unless dimensions are equal " + [leni, lenj]);
                }
                var result = new Matrix({}, this.orderi, this.orderj)
                var len = Math.min(leni, lenj);
                for (var i=0; i<len; i++) {
                    result.set_member(orderi[i], orderj[i], 1)
                }
                return result;
            }
            transpose() {
                var result = new Matrix({}, this.orderj, this.orderi);
                var matrix = this.matrix;
                for (var vari in matrix) {
                    var row = matrix[vari];
                    for (var varj in row) {
                        result.set_member(varj, vari, row[varj]);
                    }
                }
                return result;
            }
            swap(i, k) {
                // in place swap row i with k
                var orderi = this.orderi;
                var vari = orderi[i];
                var vark = orderi[k];
                var matrix = this.matrix;
                var rowi = matrix[vari];
                var rowk = matrix[vark];
                matrix[vari] = rowk;
                matrix[vark] = rowi;
            }
            invert(permissive) {
                var M = this.clone();
                var inverse = this.eye(permissive).transpose();
                var orderi = this.orderi;
                var orderj = this.orderj;
                var leni = orderi.length;
                var lenj = orderj.length;
                var len = Math.min(leni, lenj);
                for (var i=0; i<len; i++) {
                    var vari = orderi[i];
                    var varj = orderj[i];
                    for (var k=0; k<len; k++) {
                        if (k != i) {
                            var vark = orderi[k];
                            var Mii = M.member(vari, varj);
                            var Mki = M.member(vark, varj)
                            if (Math.abs(Mii) < Math.abs(Mki)) {
                                M.swap(i, k);
                                inverse.swap(i, k);
                            }
                        }
                    }
                    var Mii = M.member(vari, varj);
                    M.normalize(vari, Mii);
                    inverse.normalize(varj, Mii)
                    for (var k=0; k<len; k++) {
                        var varik = orderi[k];
                        var varjk = orderj[k];
                        if (k != i) {
                            var Mki = M.member(varik, varj);
                            M.cancel(Mki, varik, vari);
                            inverse.cancel(Mki, varjk, varj);
                        }
                    }
                }
                return inverse;
            };
            normalize(vari, factor) {
                // XXXX should error if factor near 0???
                var det = 1.0 / factor;
                var matrix = this.matrix;
                var rowi = matrix[vari];
                matrix[vari] = this.vscale(det, rowi);
            };
            cancel(factor, vark, vari) {
                // in place set M[k] -= f * M[i]
                var matrix = this.matrix;
                var rowk = matrix[vark];
                var rowi = matrix[vari];
                var shift = this.vscale(- factor, rowi);
                matrix[vark] = this.vadd(shift, rowk);
            };
            column(varj, permissive) {
                if ((!permissive) && (!this.samplej[varj])) {
                    throw new Error("no such column variable " + [varj, this.orderj]);
                }
                var result = {};
                var matrix = this.matrix;
                for (var vi in this.samplei) {
                    var value = this.member(vi, varj);
                    if (value) {
                        result[vi] = value;
                    }
                }
                return result;
            };
            mmult(other) {
                var result = new Matrix({}, this.orderi, other.orderj);
                for (var vari in this.samplei) {
                    for (var varj in other.samplej) {
                        var sum = 0;
                        for (var vark in this.samplej) {
                            sum += this.member(vari, vark) * other.member(vark, varj)
                        }
                        if (sum) {
                            result.set_member(vari, varj, sum);
                        }
                    }
                }
                return result;
            };
            madd(other) {
                var result = new Matrix({}, this.orderi, this.orderj);
                for (var vari in this.samplei) {
                    for (var varj in this.samplej) {
                        var sum = this.member(vari, varj) + other.member(vari, varj);
                        if (sum) {
                            result.set_member(vari, varj, sum);
                        }
                    }
                }
                return result;
            };
            mscale(factor) {
                var result = new Matrix({}, this.orderi, this.orderj);
                for (var vari in this.samplei) {
                    for (var varj in this.samplej) {
                        var sum = factor * this.member(vari, varj);
                        if (sum) {
                            result.set_member(vari, varj, sum);
                        }
                    }
                }
                return result;
            };
            maxabs() {
                // primarily for testing...
                var result = 0
                for (var vari in this.samplei) {
                    for (var varj in this.samplej) {
                        result = Math.max(Math.abs(this.member(vari, varj)), result)
                    }
                }
                return result;
            };
            divergence(other) {
                // primariliy for testing whether two matrices are "close" in value.
                var diff = this.madd(other.mscale(-1));
                return diff.maxabs()
            }
        };

        return new Matrix(variable_to_vector, vi_order, vj_order);
    };

    $.fn.nd_frame.example = function(element) {
    };

})(jQuery);
