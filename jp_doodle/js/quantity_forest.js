/*

JQuery plugin helper viewing hierarchies of quantities, like sizes of files and directories.

Presumes element has been initialized as a dual canvas.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/

"use strict";

(function($) {
    $.fn.quantity_forest = function (options, element) {
        element = element || this;

        var settings = $.extend({
            width: 600,
            dy: 50,
            dh: 20,
            background: "cornsilk",
            id_click: null,
            top_label: ".",
            x_vector: {x: 1, y: 0},
            y_vector: {x: 0, y: 1},
            labels: true,
            degrees: 0,
            font: "normal 10px Arial",
            clearHeight: null,
        }, options);

        element.forest_settings = settings;

        element.reset_roots = function(roots) {
            settings.roots = roots;
            element.draw_forest();
        }

        // tooltip
        let arraytip = $("<div>tooltip here</div>").appendTo(element);
        arraytip.css({
            position: "absolute",
            width: "140px",
            height: "auto",
            background: settings.background,
            font: "12px sans-serif",
            opacity: 0
        });

        let mouseclick = function(event) {
            if (settings.id_click) {
                var info = event.object_info;
                settings.id_click(info.name);
            } else {
                arraytip.html("<div>no click callback defined</div>")
            }
        };

        let mouseover = function(event) {
            var info = event.object_info;
            var pixel_offset = event.pixel_location;
            arraytip.html("<div>" + info.label + "</div>");
            let element_offset = element.offset();
            arraytip.offset({
                left: pixel_offset.x + element_offset.left + 30,
                top: pixel_offset.y + element_offset.top + 30,
            });
            arraytip.css({opacity: 0.8});
        }

        //element.rect({x: 0, y:0, w:settings.width, h:settings.dy, color:"#ddd"});
        //element.rect({x: 0, y:0, w:settings.width, h:settings.dh, color:"#999"});
        //element.text({x: 0, y:-settings.dh, text: settings.top_label});

        element.draw_forest = function () {
            arraytip.css({opacity: 0});
            element.reset_canvas();
            element.text({x: 0, y:-settings.dh, text: settings.top_label, font:settings.font, background:settings.background});
            let pick_a_color = function () {
                var arr = element.next_pseudocolor();
                return element.array_to_color(arr);
            };
            var initial_group = {
                parent: null,
                x_start: 0,
                x_end: settings.width,
                members: settings.roots.map(function(root) { return {root: root, parent:null}; }),
            };
            var texts = [];
            var format_groups = function(groups, level) {
                var next_groups = [];
                var total_size = 0;
                for (var g=0; g<groups.length; g++) {
                    var group = groups[g];
                    var group_size = 0;
                    var members = group.members;
                    for (var m=0; m<members.length; m++) {
                        var member = members[m];
                        group_size += member.root.size;
                    }
                    group.size = group_size;
                    total_size += group_size;
                }
                //var level_frame = element.frame_region(
                //    0, level * settings.dy, settings.width, (level + 1) * settings.dy,
                //    0, 0, settings.width, settings.dy,
                //);
                var level_offset = element.vscale(level * settings.dy, settings.y_vector);
                var level_frame = element.vector_frame(settings.x_vector, settings.y_vector, level_offset);
                var x_scale = settings.width * 1.0 / total_size;
                var x_cursor = 0;
                //element.print('total size', total_size, " x_scale:", x_scale);
                // add a clearing rectangle if configured
                if (settings.clearHeight && settings.background) {
                    var cleary = settings.clearHeight - level * settings.dy;
                    if (cleary > 0) {
                    level_frame.frame_rect({
                            x: 0, y:0, w:settings.width, h:cleary, color:settings.background
                        });
                    }
                }
                for (var g=0; g<groups.length; g++) {
                    var group = groups[g];
                    group.x_start = x_cursor;
                    var members = group.members;
                    for (var m=0; m<members.length; m++) {
                        var member = members[m];
                        var root = member.root;
                        if (!root.color) {
                            root.color = pick_a_color();
                        }
                        member.x_start = x_cursor;
                        var scaled_size = x_scale * root.size;
                        //element.print("at", x_cursor, scaled_size, settings.dh)
                        var rect = level_frame.frame_rect({
                            x: x_cursor, y:0, w:scaled_size, h:settings.dh, color:root.color,
                            name: root.id, label: root.label,
                        });
                        rect.on("mousemove", mouseover);
                        rect.on("click", mouseclick);
                        x_cursor += scaled_size;
                        member.x_end = x_cursor;
                        if (settings.labels) {
                            texts.push(
                                [
                                    level_frame,
                                    {
                                        degrees: settings.degrees,
                                        text: root.label,
                                        x: 0.5 * (member.x_start+member.x_end),
                                        y: 0,
                                        //align: "center",
                                        valign: "center",
                                        background: settings.background,
                                        font: settings.font,
                                    }])
                        }
                        if ((root.expanded) && (root.children)) {
                            var children = root.children;
                            if (children.length > 0) {
                                let new_group = {
                                    parent: member,
                                    frame: level_frame,
                                    members: children.map(
                                        function(root) {
                                            return { root: root, parent: member, frame: level_frame };
                                        }
                                    ),
                                };
                                next_groups.push(new_group);
                            }
                        }
                    }
                    group.x_end = x_cursor;
                    if (group.parent) {
                        // draw polygon on parents frame to prevent overwriting texts
                        var back_y = settings.dh;
                        shift = (group.parent.x_end - group.parent.x_start) * 0.2;
                        var points = [
                            [group.x_start, settings.dy],
                            [group.parent.x_start+shift, back_y],
                            [group.parent.x_end-shift, back_y],
                            [group.x_end, settings.dy],
                        ];
                        group.frame.polygon({points: points, color: group.parent.root.color});
                        level_frame.frame_rect({
                            x:group.x_start+1, y:1,
                            w:group.x_end - group.x_start-2, h:settings.dh-2,
                            color: group.parent.root.color,
                            fill:false, lineWidth:3,
                        })
                    }
                }
                if (next_groups.length > 0) {
                    format_groups(next_groups, level + 1);
                }
            };
            format_groups([initial_group], 0);
            for (var i=0; i<texts.length; i++) {
                var frame = texts[i][0];
                var desc = texts[i][1];
                frame.text(desc);
            }
            element.fit(null, 20);
        };

        element.draw_forest();
        //element.fit(null, 20);
    };

    $.fn.quantity_forest.example = function(element) {
        var child1 = {
            id: "first child",
            label: "child1",
            size: 15,
            //color: "green",
            get_children: null,
            expanded:false
        };
        var child2 = {
            id: "second child",
            label: "child2",
            size: 25,
            color: "magenta",
            children: null,
            expanded:false
        };
        var root1 = {
            id: "first root",
            label: "root1",
            size: 35,
            color: "cyan",
            children: null,
            expanded:false
        };
        var root2 = {
            id: "second root",
            label: "root2",
            size: 25,
            color: "blue",
            children: [child1, child2],
            expanded:true
        };

        var canvas_config = {
            width: 600,
            height: 400,
            //translate_scale: {x: x, y:y, w:w, h:h},
        };
        element.dual_canvas_helper(canvas_config);

        var forest_config = {
            roots: [root1, root2],
            width: 600,
            dy: 50,
            dh: 20,
            id_click: function(id) { alert("click on id: " + id); },
            degrees: 30,
        }
        element.quantity_forest(forest_config);
    }
})(jQuery);
