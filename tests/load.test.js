
/*
global.jQuery = function(argument) {
    return global.jQuery.jQuery_function(argument);
};
*/

// var index = require('../dist/index');
import jp_doodle_is_loaded from "../dist/index";

describe('testing loading jp_doodle plugins', () => {

    it('loads the index', () => {
        //expect(true).toEqual(true);
        expect(jp_doodle_is_loaded()).toBe(true);
    });

    it("defines the dual_canvas_helper plugin", () => {
        expect(global.jQuery.fn.dual_canvas_helper).toBeTruthy();
    });

    it("defines the canvas_2d_widget_helper plugin", () => {
        expect(global.jQuery.fn.canvas_2d_widget_helper).toBeTruthy();
    });

    it("creates a dual canvas", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        expect(elt.visible_canvas).toBeTruthy();
    });

    it("runs the dual canvas example", () => {
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper.example(elt);
        expect(elt.visible_canvas).toBeTruthy();
    });

    it("runs the lasso example", () => {
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper.lasso_example(elt);
        expect(elt.visible_canvas).toBeTruthy();
    });

    it("runs the frame example", () => {
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper.frame_example(elt);
        expect(elt.visible_canvas).toBeTruthy();
    });

    it("serializes and deserializes the frame example", () => {
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper.frame_example(elt);
        var json = elt.json_serialize();
        var other = jQuery("<div/>").appendTo(elt);
        other.dual_canvas_json(json);
        expect(other.visible_canvas).toBeTruthy();
        // look for some objects
        var some_frame = null;
        var some_text = null;
        var objects = other.object_list;
        for (var i=0; i<objects.length; i++) {
            var obj = objects[i];
            var shape_name = obj.shape_name;
            if (shape_name == "frame") {
                some_frame = obj;
            }
            if (shape_name == "text") {
                some_text = obj;
            }
        }
        expect(some_frame).toBeTruthy();
        expect(some_text).toBeTruthy();
    });

    it("runs the 2d canvas example", () => {
        var elt = jQuery("<b>test</b>");
        elt.canvas_2d_widget_helper.example(elt);
        expect(elt.canvas_context).toBeTruthy();
    });

  });
