
import jp_doodle_is_loaded from "../dist/index";

describe("misc dual_canvas tests", () => {

    it("saves, changes, forgets a polygon", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var points = [[50,0], [40,-20], [40,-40], [30,-60]];
        var p = elt.polygon({points:points, cx:10, cy:-10, degrees:33, color:"green",
            fill:false, lineWidth:16, close:true, name:"polly"});
        expect(elt.get_object_info("polly").color).toBe("green");
        p.change({color: "yellow"});
        expect(elt.get_object_info("polly").color).toBe("yellow");
        p.forget();
        expect(elt.get_object_info("polly")).toBeFalsy();
    });

    it("stores a color image", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var array = elt.name_image_data("xyz_name", [1,2,3,4], 1, 1);
        expect(elt.visible_canvas.named_images["xyz_name"]).toBeTruthy();
    });

    it("stores a grey scale image", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var array = elt.name_image_data("xyz_name", [4], 1, 1);
        expect(elt.visible_canvas.named_images["xyz_name"]).toBeTruthy();
    });

    it("parses a color", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var array = elt.color_string_to_array("rgba(1,2,3,0)");
        expect(array).toEqual([1,2,3,0]);
    });

    it("doesn't parses a bad color", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var array = elt.color_string_to_array("rgba(1,2,3,b)");
        expect(array).toBeFalsy();
        //var array2 = elt.color_string_to_array("xgba(1,2,3,0)");
        //expect(array2).toBeFalsy();
    });

});