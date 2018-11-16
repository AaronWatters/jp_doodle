
import jp_doodle_is_loaded from "../dist/index";

describe("misc dual_canvas tests", () => {

    it("gets colors and pixels", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        expect(elt.visible_canvas.color_at(10,10).data).toEqual([0,0,0,0]);
        expect(elt.pixels(10,10,1,1).data).toEqual([0,0,0,0]);
        expect(elt.color_index_at(elt.invisible_canvas,10,10,1,1)).toEqual(null);
    });

    it("computes event locations", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var event = {pageX: 10, pageY: 20};
        expect(elt.event_pixel_location(event)).toBeTruthy();
        var event2 = {clientX: 10, clientY: 20};
        expect(elt.event_pixel_location(event2)).toBeTruthy();
        expect(elt.event_canvas_location(event2)).toBeTruthy();
        expect(elt.event_model_location(event2)).toBeTruthy();
    });

    it("computes vector directions", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var v = {x: 33, y:33};
        expect(elt.vdirection_degrees(v)).toEqual(45);
        var v = {x: 33, y:-33};
        expect(elt.vdirection_degrees(v)).toEqual(-45);
    });

    it("draws a color chooser", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        elt.color_chooser();
        var v = {x: 33, y:33};
        expect(elt.chosen_color).toBe(null);
    });

    it("interpolates mappings", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var starting = {
            x: 100, y:200,
            points: [[0,0], [10, 10], [0,10]],
            color: "blue",
            text: "starting",
            object: {greeting: "hello"},
        };
        var ending = {
            x: 300, y:-200,
            points: [[0,0], [-10, 10], [0,-10]],
            color: "green",
            text: "ending",
            object: {greeting: "goodbye"},
        };
        var interpolator = elt.interpolate_mapping(starting, ending);
        var before = interpolator(0);
        var middle = interpolator(0.5);
        var after = interpolator(1.0);
        expect(before).toEqual(starting);
        expect(after).toEqual(ending);
        expect(middle.x).toEqual(200);
    });

    it("doesn't interpolate trivial mappings", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var starting = {
            x: 100, y:200,
        };
        var ending = {
            x: 100, y:200,
        };
        var interpolator = elt.interpolate_mapping(starting, ending);
        expect(interpolator).toBe(null);
    });

    it("finds objects by position", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var c = elt.frame_circle({r:22, x:3, y:5, color:"pink", name:"circle"});
        var pc = c.pseudocolor_array;
        var color_index = elt.color_array_to_index(pc);
        // mocks
        elt.color_index_at = function () { return color_index; };
        var event = {};
        expect(elt.object_name_at_position(event, 100, 300)).toBe("circle");
    });

    it("doesn't find objects if validation fails", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var c = elt.frame_circle({r:22, x:3, y:5, color:"pink", name:"circle"});
        var pc = c.pseudocolor_array;
        var color_index = elt.color_array_to_index(pc);
        // mocks
        var found = false;
        elt.color_index_at = function (on_canvas) { 
            if (on_canvas === elt.invisible_canvas) {
                found = true;
                return color_index; 
            }
            // otherwise fail the validation
            return "garbage";
        };
        var event = {};
        expect(elt.object_name_at_position(event, 100, 300)).toBe(null);
        expect(found).toBeTruthy();
    });

    it("computes vector distance", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var v = {x: 33, y:33};
        var v2 = {x: 36, y:37};
        expect(elt.vdistance(v, v2)).toEqual(5);
    });

    it("does coordinate calculations", () => {
        // just increasing coverage, not chacking closely.
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        expect(elt.converted_location(1,2)).toBeTruthy();
        expect(elt.visible_canvas.canvas_to_pixel(2,3)).toBeTruthy();
        expect(elt.visible_canvas.model_to_pixel(2,3)).toBeTruthy();
    });

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

    it("resets", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var points = [[50,0], [40,-20], [40,-40], [30,-60]];
        var p = elt.polygon({points:points, cx:10, cy:-10, degrees:33, color:"green",
            fill:false, lineWidth:16, close:true, name:"polly"});
        expect(elt.get_object_info("polly").color).toBe("green");
        elt.reset_canvas(true);
        expect(elt.get_object_info("polly")).toBeFalsy();
        expect(elt.object_list.length).toBe(0);
    });

    it("does frame shapes", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var f = elt.rframe(1,2,3,4,"frame");
        var c = f.frame_circle({r:22, x:3, y:5, color:"pink", name:"circle"})
        var r = f.frame_rect({w:22, h:100, x:3, y:5, color:"red", name:"rect"})
        expect(elt.get_object_info("circle").frame).toBe(f);
        expect(elt.get_object_info("rect").frame).toBe(f);
        expect(f.active_region(true)).toBeTruthy();
    });

    it("scrambles pseudocolors on collision", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        elt.color_counter = 47;
        var c = elt.frame_circle({r:22, x:3, y:5, color:"pink", name:"circle"})
        elt.color_counter = 47;
        var r = elt.frame_rect({w:22, h:100, x:3, y:5, color:"red", name:"rect"})
        expect(c.pseudocolor == r.pseudocolor).toBeFalsy();
    });

    it("resets and restores events", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var c = elt.frame_circle({r:22, x:3, y:5, color:"pink", name:"circle"})
        var callback = function (event) {
            // do nothing
        };
        c.on("click", callback);
        var save_event_info = elt.reset_events();
        expect(elt.event_info.object_event_handlers).toEqual({});
        elt.restore_events(save_event_info);
        expect(elt.event_info.object_event_handlers["click"]["circle"]).toBe(callback);
    });

    it("watches mouse move on mouseover", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        elt.watch_event("mouseover");
        expect(elt.event_info.event_types["mousemove"]).toBeTruthy();
    });

    it("focuses", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        elt.focus_canvas();
        expect(elt.visible_canvas.canvas.attr("tabindex")).toBe("0");
    });

    it("supports delayed events", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var test = false;
        var event_object = {overridden: false};
        var callback = function (event) {
            expect(event).toBe(event_object);
            expect(event.overridden).toBe(false);
            test = true;
        };
        elt.delay_event("click", callback, {overridden: true});
        elt.delay_event("click", callback, event_object);
        expect(test).toBe(false);
        elt.drain_delayed_events();
        expect(test).toBe(true);
    });

    it("doesn't index transparent colors", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var color_array = [100, 100, 100, 100];
        expect(elt.color_array_to_index(color_array)).toBe(null);
    });

    it("replaces object with same name", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var c = elt.frame_circle({r:22, x:3, y:5, color:"pink", name:"same"})
        expect(elt.get_object_info("same").r).toBe(22);
        var r = elt.frame_rect({w:22, h:100, x:3, y:5, color:"red", name:"same"})
        expect(elt.get_object_info("same").h).toBe(100);
        expect(elt.object_list.length).toBe(1);
    });

    it("sets visibilities", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var c = elt.frame_circle({r:22, x:3, y:5, color:"pink", name:"same"})
        expect(elt.get_object_info("same").hide).toBeFalsy();
        elt.set_visibilities(["same"], false);
        // eventually check that object is not drawn here:
        elt.draw_object_info(elt.get_object_info("same"));
        expect(elt.get_object_info("same").hide).toBeTruthy();
        elt.set_visibilities(["same"], true);
        expect(elt.get_object_info("same").hide).toBeFalsy();
    });

    it("permits changing missing objects", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        elt.change("missing", {color: "pink"});
    });

    it("abbreviates events", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var points = [[50,0], [40,-20], [40,-40], [30,-60]];
        var p = elt.polygon({points:points, cx:10, cy:-10, degrees:33, color:"green",
            fill:false, lineWidth:16, close:true, name:"polly"});
        var callback = function(event) {
            // nothing yet...
        };
        elt.abbreviated_on_canvas_event("click", callback, "polly");
        expect(elt.event_info.object_event_handlers["click"]["polly"]).toBeTruthy();
    });

    it("can't get an unnamed object", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        expect(() => { elt.get_object_info({}); }).toThrow();
    });

    it("disables, enables redraws", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        expect(elt.disable_auto_redraw).toBeFalsy();
        elt.allow_auto_redraw(false);
        expect(elt.disable_auto_redraw).toBeTruthy();
        var c = elt.frame_circle({r:22, x:3, y:5, color:"pink", name:"circle"})
        c.change({"color": "brown"});
        expect(elt.redraw_pending).toBe(true);
        elt.allow_auto_redraw(true);
        expect(elt.disable_auto_redraw).toBeFalsy();
    });

    it("stores a url image", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var array = elt.name_image_url("xyz_name", "http://example.com/x.png");
        expect(elt.visible_canvas.named_images["xyz_name"]).toBeTruthy();
        var img = elt.named_image({image_name: "xyz_name", name:"img",
                 x:10, y:11, dx:22, dy:33, w:44, h:55, degrees:66,
                 sx:77, sy:88, sWidth:99, sHeight:11});
        expect(elt.get_object_info("img").image_name).toBe("xyz_name");
        var img2 = elt.named_image({image_name: "xyz_name", name:"img2",
                 x:10, y:11, dx:22, dy:33, w:44, h:55, degrees:66});
        expect(elt.get_object_info("img2").image_name).toBe("xyz_name");
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

    it("doesn't store an image of wrong size", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        expect(() => { elt.name_image_data("xyz_name", [4, 5], 1, 1); }).toThrow();
        expect(elt.visible_canvas.named_images["xyz_name"]).toBeFalsy();
    });

    it("parses a color", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var array = elt.color_string_to_array("rgba(1,2,3,0)");
        expect(array).toEqual([1,2,3,0]);
    });

    it("doesn't parse a bad color", () => {
        mockCanvas(window);
        var elt = jQuery("<b>test</b>");
        elt.dual_canvas_helper();
        var array = elt.color_string_to_array("rgba(1,2,3,b)");
        expect(array).toBeFalsy();
        //var array2 = elt.color_string_to_array("xgba(1,2,3,0)");
        //expect(array2).toBeFalsy();
    });

});