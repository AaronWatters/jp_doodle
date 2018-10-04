/*

JQuery plugin helper for exploring heat map style arrays with row and column names

Assumes the element has been initialized using dual_canvas_helper.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/
"use strict";

(function($) {

    $.fn.array_explorer = function (options, element) {
        element = element || this;

        var settings = $.extend({
            array: [ [0,1,0], [1,0,1], [0,1,0]],  // for example
            column_names: ["left", "center", "right"],  // for example
            row_names: ["top", "middle", "bottom"],   // for example
            max_color: "orange",
            min_color: "blue",
            width: 400,
            height: 330,
            cwidth: 50,  // set to falsey to disable column annotations
            cheight: 50,  // set to falsey to disable row annotation
            spacer: 10,
            color_width: 10,
            selected_row: 0,
            selected_col: 0,
            whiten: "rgba(255,255,255,0.5)",   // set to falsey for no whiten
            background: "cornsilk",
            nswatches:  100,  // number of color samples in color bar
            lineWidth: 3,
            hover_color: "rgba(255,0,0,0.3)",
            nbins: 10, // number of bins for histograms
        }, options);

        // Shared calculated state variables
        var mouse_down_row_col = null;
        var nrows = 0;
        var ncols = 0;
        var minrow = 0;
        var maxrow = 0;
        var mincol = 0;
        var maxcol = 0;
        var scol = [];
        var srow = [];
        var nswatches = settings.nswatches;
        var array_area = null;   // rectangle for receiving events.
        var array_selection = null;  // selected sub_array
        var col_labels_area = null;
        var row_labels_area = null;
        var column_names = settings.column_names;
        var row_names = settings.row_names;
        var array = settings.array;
        var width = settings.width;
        var height = settings.height;
        var cwidth = settings.cwidth;
        var cheight = settings.cheight;
        var spacer = settings.spacer;
        var selected_row = settings.selected_row;
        var selected_col = settings.selected_col;
        var color_interpolator = element.color_interpolator(settings.min_color, settings.max_color);
        var color_width = settings.color_width;
        var min_value = array[0][0];
        var max_value = array[0][0];
        var nrows = column_names.length;
        var ncols = row_names.length;
        var lineWidth = settings.lineWidth;
        var selected_charts = [];
        var hover_charts = null;
        var selection_color = null;
        
        // color selecdtion
        var colorizer = $("<div/>");

        colorizer.appendTo(element);
        
        colorizer.dialog({
                autoOpen: false,
                resizable: true
        });
        
        colorizer.dual_canvas_helper({width:100, height:100});
        colorizer.color_chooser({
            x: 0, y: 0, side:200, font: "normal 7px Arial",
            callback: (function (a,c) { selection_color = c; }),
        });
        colorizer.fit();
        
        element.show_chooser = function() {
            colorizer.dialog("open");
        };   

        element.hide_chooser = function() {
            colorizer.dialog("close");
        };
    
        var reset_data = function() {
            width = settings.width;
            height = settings.height;
            cwidth = settings.cwidth;
            cheight = settings.cheight;
            column_names = settings.column_names;
            row_names = settings.row_names;
            array = settings.array;
            selected_row = settings.selected_row;
            selected_col = settings.selected_col;
            color_interpolator = element.color_interpolator(settings.min_color, settings.max_color);
            lineWidth = settings.lineWidth;
            ncols = column_names.length;
            nrows = row_names.length;
            if (nrows != array.length) {
                throw new Error("row names don't match array");
            }
            if (ncols != array[0].length) {
                throw new Error("col names don't match array");
            }
            min_value = array[0][0];
            max_value = array[0][0];
            for (var i=0; i<nrows; i++) {
                var row = array[i];
                min_value = Math.min(min_value, ...row);
                max_value = Math.max(max_value, ...row);
            }
            // xxxxx hack
            if ((max_value - min_value) < 0.01) {
                maxvalue = min_value + 0.1;
            }
            reset_selection_charts();
            element.hide_chooser();
        };

        var reset_selection_charts = function() {
            for (var i=0; i<selected_charts.length; i++) {
                selected_charts[i].remove();
            }
            selected_charts = [];
            var current_selection = selection_charts(selected_row, selected_col);
            hover_charts = selection_charts(0, 0, "invisible", 1);
            selected_charts = [hover_charts, current_selection];
            element.selected_charts = selected_charts;
            element.current_selection = current_selection;
        };

        var refocus = function(start_row, start_col, row, col) {
            mouse_down_row_col = null;
            selected_row = 0;
            selected_col = 0
            var row0 = Math.min(start_row, row);
            var col0 = Math.min(start_col, col);
            var rown = Math.max(start_row, row);
            var coln = Math.max(start_col, col);
            if ((row0 >= rown) || (rown > nrows)) {
                throw new Error("bad rows");
            }
            if ((col0 >= coln) || (coln > ncols)) {
                throw new Error("bad columns");
            }
            var new_array = [];
            var new_col_names = [];
            var new_row_names = [];
            for (var row=row0; row<rown; row++) {
                var new_row = [];
                new_row_names.push(row_names[row]);
                for (var col=col0; col<coln; col++) {
                    new_row.push(array[row][col]);
                }
                new_array.push(new_row);
            }
            for (var col=col0; col<coln; col++) {
                new_col_names.push(column_names[col]);
            }
            array = new_array;
            column_names = new_col_names;
            row_names = new_row_names;
            reset_selection_charts();
            delayed_redraw();
        };

        var get_color = function(value) {
            var lambda = (value - min_value) / (max_value - min_value);
            return color_interpolator(lambda)
        };

        // Frames (re-initialize later)
        var array_frame = element.vector_frame();
        var top_frame = element.vector_frame();
        var left_frame = element.vector_frame();
        // uninverted frame for axis
        var left_axis_frame = element.vector_frame();
        var color_frame = element.vector_frame();
        var test_frame = element.vector_frame();
        //var col_jitter_frame = element.vector_frame();
        //var row_jitter_frame = element.vector_frame();

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

        var redraw = function () {
            mouse_down_row_col = null;
            clear_frames();
            draw_array();
            draw_charts();
            draw_color_bar();
            highlights();
            element.fit();
            add_event_handlers();
        };

        var delayed_redraw = function () {
            // reset event handlers, just in case
            element.reset_events();
            // delay a redraw to prevent handling stray mouse events too early.
            setTimeout(redraw, 200);
        };

        var clear_frames = function () {
            array_frame.reset_frame();
            top_frame.reset_frame();
            left_frame.reset_frame();
            left_axis_frame.reset_frame();
            color_frame.reset_frame();
            test_frame.reset_frame();
            //col_jitter_frame.reset_frame();
            //row_jitter_frame.reset_frame();
        };

        var draw_array = function () {
            // Main array central frame.
            nrows = row_names.length;
            ncols = column_names.length;
            array_frame.set_region(
                0, 0, width, height, 
                0, nrows, ncols, 0);

            // Column labels along the bottom
            srow = [];
            for (var i=0; i<ncols; i++) {
                array_frame.text({x:i+0.5, y:nrows, text:" "+column_names[i], 
                    degrees:-90, valign:"center", background:settings.background});
                srow.push(array[selected_row][i]);
            }
            minrow = Math.min(...srow);
            maxrow = Math.max(minrow+0.1, ...srow);
            col_labels_area = array_frame.rect({
                x:0, y:nrows, w:width, h:-cheight, color:"rgba(0,0,255,0)", name:"cols"});

            // Row labels along the right.
            scol = [];
            for (var j=0; j<nrows; j++) {
                array_frame.text({x:ncols, y:j+0.5, text:" "+row_names[j], 
                    valign:"center", background:settings.background});
                scol.push(array[j][selected_col]);
            }
            mincol = Math.min(...scol);
            maxcol = Math.max(mincol+0.1, ...scol);
            row_labels_area = array_frame.rect({
                x:ncols, y:nrows, w:cheight, h:height, color:"rgba(0,0,255,0)", name:"rows"});
                
            // draw the heatmap image
            var nbytes = ncols * nrows * 4;
            var byte_array = new Uint8Array(nbytes);
            for (var i=0; i<ncols; i++) {
                for (var j=0; j<nrows; j++) {
                    var boffset = (j * ncols + i) * 4;
                    var color = get_color(array[j][i]);
                    // Could optimize this by refactoring color interpolation to expose array values.
                    var color_array = element.color_string_to_array(color);
                    // a little bigger to nuke white lines at margins
                    //array_frame.frame_rect({x:i, y:j, w:1.01, h:1.01, color:color});
                    for (var b=0; b<4; b++) {
                        byte_array[boffset + b] = color_array[b];
                    }
                }
            }
            element.name_image_data("heatmap", byte_array, ncols, nrows);
            array_frame.named_image({image_name: "heatmap", x:0, y:0, w:width, h:-height})
        };

        var draw_charts = function () {
            top_frame.reset_frame();
            left_axis_frame.reset_frame();

            // top row chart frame
            top_frame.set_region(
                0, height+spacer, width, height+cheight+spacer,
                0, min_value, ncols, max_value);
            //top_frame.frame_rect({x:0, y:minrow, w:ncols, h:maxrow-minrow, color:"cornsilk"});
        
            top_frame.right_axis({min_value:min_value, max_value:max_value, max_tick_count:5, 
                add_end_points:true, axis_origin: {x:ncols, y:0}});
        
            // uninverted y for axis
            left_axis_frame.set_region(
                -spacer, 0, -cwidth-spacer, height,
                min_value, 0, max_value, nrows);
            left_axis_frame.bottom_axis({min_value:min_value, max_value:max_value, 
                max_tick_count:5, add_end_points:true});
            for (var i=0; i<selected_charts.length; i++) {
                selected_charts[i].draw();
            }
        };

        var selection_charts = function (row, col, color_override, offset) {
            // xxxx shouldn't need to do this here?
            nrows = row_names.length;
            ncols = column_names.length;
            offset = offset || 0;
            var charts = {row: row, col:col, color_override:color_override, offset: offset};
            charts.draw = function () {
                charts.remove();
                charts.chart_color = function(value) {
                    if (charts.color_override) {
                        return charts.color_override;
                    }
                    return get_color(value);
                };
                var rightoffset = - offset * (cheight + spacer);
                charts.top_frame = element.frame_region(
                    0, height+spacer, width, height+cheight+spacer,
                    0, min_value, ncols, max_value);
                charts.left_frame = element.frame_region(
                    -spacer, 0, -cwidth-spacer, height,
                    min_value, nrows, max_value, 0
                );
                var bottomoffset = offset * (cwidth + spacer);
                // (re) draw the chart on the figure
                // don't draw anything if the color_override is "invisible"
                if (charts.color_override=="invisible") {
                    return;
                }
                // histogram computations
                var nbins = settings.nbins;
                var delta = (max_value - min_value) * (1.0 / nbins);
                var get_bins = function(data) {
                    result = [];
                    for (var i=0; i<nbins; i++) {
                        result.push(0);
                    }
                    for (var i=0; i<nbins; i++) {
                        var offset = data[i] - min_value;
                        var bin = Math.min(nbins-1, Math.floor(offset/delta));
                        result[bin]++;
                    }
                    return result;
                }

                // top_chart
                var row_values = [];
                for (var i=0; i<ncols; i++) {
                    var value = array[charts.row][i];
                    row_values.push(value);
                    var color = charts.chart_color(value);
                    charts.top_frame.line({x1:i, x2:i+1, y1:value, y2:value, color:color, lineWidth:lineWidth});
                    var midi = i + 0.5;
                    charts.top_frame.line({x1:midi, x2:midi, y1:min_value, y2:value, color:color, lineWidth:lineWidth});
                    //charts.rightframe.circle({x: charts.random_row[i], y:value, r:lineWidth, color:color});
                }

                // upper right chart
                if (charts.row == selected_row) {
                    // histogram
                    var right_bins = get_bins(row_values);
                    var right_bin_max = Math.max(...right_bins);
                    charts.rightframe = element.frame_region(
                        width + spacer + cwidth, height + spacer + rightoffset, 
                        width + spacer + cwidth * 2, height + spacer + cheight + rightoffset,
                        0, min_value, right_bin_max, max_value
                    );
                    // background
                    charts.rightframe.frame_rect({
                        x:0, y:min_value, w:right_bin_max, h:max_value-min_value, color:settings.background,
                    })
                    for (var i=0; i<nbins; i++) {
                        var binvalue = min_value + i * delta;
                        charts.rightframe.frame_rect({
                            x:0, y:binvalue, w:right_bins[i], h:delta, color:charts.chart_color(binvalue+delta*0.5),
                        })
                    }
                    charts.rightframe.text({x:0, y:max_value, text:row_names[charts.row], 
                        color:charts.chart_color(max_value), background:settings.background});
                } else {
                    charts.rightframe = element.frame_region(
                        width + spacer + cwidth, height + spacer + rightoffset, 
                        width + spacer + cwidth * 2, height + spacer + cheight + rightoffset,
                        min_value, min_value, max_value, max_value
                    );
                    // background
                    charts.rightframe.frame_rect({
                        x:min_value, y:min_value, w:max_value-min_value, h:max_value-min_value, color:settings.background,
                    })
                    for (var i=0; i<ncols; i++) {
                        var value = array[charts.row][i];
                        var selected_value = array[selected_row][i];
                        var color = charts.chart_color(value);
                        charts.rightframe.circle({y: selected_value, x:value, r:lineWidth, color:color});
                    }
                    charts.rightframe.text({x:min_value, y:max_value, text:row_names[charts.row], 
                        color:charts.chart_color(max_value), background:settings.background});
                    charts.rightframe.text({x:max_value, y:max_value, text:row_names[selected_row], 
                        color:charts.chart_color(max_value), background:settings.background, degrees:-90});
                }

                // left chart
                var col_values = [];
                for (var j=0; j<nrows; j++) {
                    var value = array[j][charts.col];
                    col_values.push(value);
                    var color = charts.chart_color(value);
                    charts.left_frame.line({y1:j, y2:j+1, x1:value, x2:value, color:color, lineWidth:lineWidth})
                    var midj = j + 0.5;
                    charts.left_frame.line({y1: midj, y2: midj, x1:value, x2:mincol, color:color, lineWidth:lineWidth})
                    //charts.bottomframe.circle({y: charts.random_col[j], x:value, r:lineWidth, color:color})
                }
                // bottom chart
                if (charts.col == selected_col) {
                    // histogram
                    var bottom_bins = get_bins(col_values);
                    var bottom_bin_max = Math.max(...bottom_bins);
                    charts.bottomframe = element.frame_region(
                        bottomoffset-cwidth-spacer, -cwidth * 2 - spacer, 
                        bottomoffset-spacer, -cwidth - spacer,
                        max_value, 0, min_value, bottom_bin_max
                    );
                    // background
                    charts.bottomframe.frame_rect({
                        x:min_value, y:0, h:bottom_bin_max, w:max_value-min_value, color:settings.background,
                    })
                    for (var i=0; i<nbins; i++) {
                        var binvalue = min_value + i * delta;
                        charts.bottomframe.frame_rect({
                            y:0, x:binvalue, h:bottom_bins[i], w:delta, color:charts.chart_color(binvalue+delta*0.5),
                        })
                    }
                    charts.bottomframe.text({y:bottom_bin_max, x:max_value, text:column_names[charts.col], 
                        color:charts.chart_color(max_value), background:settings.background});
                } else {
                    charts.bottomframe = element.frame_region(
                        bottomoffset-cwidth-spacer, -cwidth * 2 - spacer, 
                        bottomoffset-spacer, -cwidth - spacer,
                        max_value, min_value, min_value, max_value
                    );
                    // background
                    charts.bottomframe.frame_rect({
                        x:min_value, y:min_value, w:max_value-min_value, h:max_value-min_value, color:settings.background,
                    })
                    for (var i=0; i<nrows; i++) {
                        var value = array[i][charts.col];
                        var selected_value = array[i][selected_col];
                        var color = charts.chart_color(value);
                        charts.bottomframe.circle({y: selected_value, x:value, r:lineWidth, color:color});
                    }
                    charts.bottomframe.text({x:min_value*1.1, y:max_value, text:column_names[selected_col],
                        color:charts.chart_color(max_value), background:settings.background, degrees:-90});
                    charts.bottomframe.text({x:max_value, y:max_value*1.1, text:column_names[charts.col], 
                        color:charts.chart_color(max_value), background:settings.background});
                }

                if (charts.color_override) {
                    // also colorize the array area
                    //   Important -- no events to prevent spurious mouseout events
                    charts.array_rect = array_frame.frame_rect({x:charts.col, y:charts.row, w:1, h:1, 
                        color:charts.color_override, name:true, events:false});
                }
                var outline_color = charts.color_override || "black";
                charts.column_outline = array_frame.frame_rect({
                    x:charts.col, y:0, w:1, h:nrows, color:outline_color, fill:false, lineWidth:lineWidth,
                    name:true, events:false,
                });
                charts.row_outline = array_frame.frame_rect({
                    x:0, y:charts.row, w:ncols, h:1, color:outline_color, fill:false, lineWidth:lineWidth,
                    name:true, events:false,
                });
            };
            charts.remove = function () {
                // remove these charts from the figure (undefined or null objects skipped)
                if (charts.top_frame) {
                    element.forget_objects([
                        charts.top_frame,
                        charts.rightframe,
                        charts.left_frame,
                        charts.bottomframe,
                        charts.array_rect,
                        charts.column_outline,
                        charts.row_outline,
                    ]);
                }
            };
            return charts;
        };

        var draw_color_bar = function () {
            // color pallet frame to far left
            color_frame.set_region(
                -color_width-cwidth-2*spacer, 0, -cwidth-2*spacer, height,
                0, min_value, 1, max_value
            )
        
            color_frame.left_axis({min_value:min_value, max_value:max_value, max_tick_count:10, 
                add_end_points:true});
        
            var dvalue = (max_value - min_value) * 1.0 / nswatches;
            for (var k=0; k<nswatches; k++) {
                var value = min_value + k * dvalue;
                var color = get_color(value);
                color_frame.frame_rect({x:0, y:value, w:1, h:dvalue*1.5, color:color});
            }
            
            // add a reset button
            var reset_button = color_frame.text({x:0, y:max_value * 1.1, text:"reset", color:"blue", name:"reset"});
            reset_button.on("click", function () { reset_data(); redraw(); });
            // add a colorize button
            var reset_button = color_frame.text({x:0, y:max_value * 1.05, text:"multi-select", color:"red", name:"colorize"});
            reset_button.on("click", element.show_chooser);
        };

        var highlights = function () {
            var whiten = settings.whiten;
            if (whiten) {
                // whiten out unselected areas
                // lower left
                array_frame.frame_rect({x:0, y:0, w:selected_col, h:selected_row, color:whiten})
                // upper left
                array_frame.frame_rect({
                    x:0, y:selected_row+1,
                    w:selected_col, h:nrows-selected_row-1, color:whiten});
                // lower right
                array_frame.frame_rect({
                    x:selected_col+1, y:0,
                    w:ncols-selected_col-1, h:selected_row, color:whiten});
                // upper right
                array_frame.frame_rect({
                    x:selected_col+1, y:selected_row+1,
                    w:ncols-selected_col-1, h:nrows-selected_row-1, color:whiten});
            }
            // invisible rectangle for events
            array_area = array_frame.frame_rect({
                name: "array_area",
                x:0, y:0, w:ncols, h:nrows, color: "rgba(0,0,0,0)",
            });
            
            // movable rectangle for region selection
            array_selection = array_frame.frame_rect({
                name: "array_selection", x:0, y:0, w:2, h:2, color:"red", fill:false, lineWidth:4,
                events: false, hide:true
            });
        };

        var info_div = $("<div>info here</div>").appendTo(element);
        if (!settings.debug) {
            info_div.css({display: "none", visibility:"hidden"});
        }

        // event handling
        var on_mouse_array = function(event) {
            var debug_log = function(message) {
                if (settings.debug) {
                    var expanded = "<div>" + event.type + "@" + row + "," +col + ": " + message + "</div>";
                    info_div.html(expanded);
                    if (event.type != "mousemove") {
                        console.log(expanded);
                    }
                }
            }
            let element_offset = element.offset();
            var frame_location = array_frame.event_model_location(event);
            var colx = frame_location.x;
            var rowy = frame_location.y;
            var col = Math.floor(colx);
            var row = Math.floor(rowy);
            // by default, don't draw the hover charts
            //if (hover_charts.color_override !== "invisible") {
            //    hover_charts.color_override = "invisible";
            //    draw_charts();
            //}
            if ((col<0) || (col>=ncols)) {
                col = selected_col;
                colx = col;
            }
            if ((row<0) || (row>=nrows)) {
                row = selected_row;
                rowy = row;
            }
            let pixel_offset = array_frame.pixel_offset(colx, rowy);
            let tips = [];
            tips.push("<div>" + row + ": " + row_names[row] + "</div>");
            tips.push("<div>" + col + ": " + column_names[col] + "</div>");
            tips.push("<div>" + array[row][col].toPrecision(4) + "</div>");
            //tips.push("<div>" + frame_location.x + "</div>");
            //tips.push("<div>" + frame_location.y + "</div>");
            arraytip.html("<div>" + tips.join(' ') + "</div>");
            arraytip.offset({
                left: pixel_offset.x + element_offset.left + 30,
                //left: axis_pixel_origin.x + element_offset.left,
                top: pixel_offset.y + element_offset.top + 30,
            })
            if (!mouse_down_row_col) {
                debug_log("showing selection")
                var array_selection_color = selection_color || "red";
                array_selection.change({x: col, y: row, w:1, h:1, hide:false, color:array_selection_color});
                if ((col != hover_charts.col) || (row != hover_charts.row)) {
                    // show the hover charts in transparent red
                    hover_charts.row = row;
                    hover_charts.col = col;
                    hover_charts.color_override = settings.hover_color;
                    draw_charts();
                }
            }
            var start_col = null;
            var start_row = null;
            if (mouse_down_row_col) {
                start_row = mouse_down_row_col[0];
                start_col = mouse_down_row_col[1];
                var swidth = col - start_col || 1;
                var sheight = row - start_row || 1;
                array_selection.change({x: start_col, y: start_row, w:swidth, h:sheight, 
                    hide:false, color:"red"});
                if ((swidth != 1) || (sheight != 1)) {
                    selection_color = null;
                    colorizer.reset_color_choice();
                }
            }
            arraytip.css({opacity: 0.8});
            var event_type = event.type;
            if (event_type == "mousedown") {
                mouse_down_row_col = [row, col];
                debug_log("mouse down started " + mouse_down_row_col);
            }
            if (event_type == "mouseup") {
                //element.print("mouseup", row, col, mouse_down_row_col);
                array_selection.change({hide:true});
                if ((mouse_down_row_col) && (start_row != row) && (start_col != col)) {
                    debug_log("refocussing " + [start_row, start_col, row, col])
                    return refocus(start_row, start_col, row, col);
                }
                mouse_down_row_col = null;
            }
            if (event_type == "click") {
                if ((selection_color) && (selected_row!=row) && (selected_col!=col)) {
                    var new_charts = selection_charts(row, col, selection_color, selected_charts.length);
                    selected_charts.unshift(new_charts);
                    debug_log("adding chart " + selection_color + " " + new_charts.offset);
                    selection_color = null;  // have to choose a new one
                    colorizer.reset_color_choice();
                } else {
                    selected_row = row;
                    selected_col = col;
                    element.current_selection.row = row;
                    element.current_selection.col = col;
                    element.hide_chooser();
                    //reset_selection_charts();
                    debug_log("changing primary selection");
                    redraw();
                }
            }
        };

        var on_mouseout_array = function(event) {
            array_selection.change({hide: true});
            hover_charts.color_override = "invisible";
            draw_charts();
        }

        var add_event_handlers = function () {
            array_area.on("click", on_mouse_array);
            array_area.on("mousedown", on_mouse_array);
            array_area.on("mousemove", on_mouse_array);
            array_area.on("mouseout", on_mouseout_array);
            array_area.on("mouseup", on_mouse_array);
            col_labels_area.on("click", on_mouse_array);
            col_labels_area.on("mousemove", on_mouse_array);
            row_labels_area.on("click", on_mouse_array);
            row_labels_area.on("mousemove", on_mouse_array);
        };

        // draw initial layout
        reset_data();
        redraw();
    };  // $.fn.array_explorer

    $.fn.array_explorer.example = function(element) {
        var column_names = ['Th0_0.5h_1_1', 'Th0_14h_4_1', 'Th0_16h_1_1', 'Th0_16h_7_1', 'Th0_18h_5_1', 'Th0_1h_1_1', 
            'Th0_20h_5_1', 'Th0_20h_6_1', 'Th0_25h_6_1', 'Th0_2h_2_1', 'Th0_2h_7_1', 'Th0_30h_6_1', 'Th0_30h_9_1', 
            'Th0_36h_6_1', 'Th0_42h_6_1', 'Th0_42h_7_1', 'Th0_48h_6_1', 'Th0_4h_3_1', 'Th0_54h_6_1', 'Th0_54h_7_1'];
        var row_names = ['0610007p14rik', '0610012g03rik', '1190002n15rik', '1500010j02rik', '1700081l11rik', 
            '2010002n04rik', '2010109k11rik', '2310004i24rik', '2310008h04rik', '2310033p09rik', '2610019f03rik', 
            '2810021b07rik', '3110003a17rik', '3110057o12rik', '4632428n05rik', '4930420k17rik', '4930583h14rik']
        var array = [
            [-1.4,0.3,0.1,0.4,0.3,-1.7,0.5,0.3,0.5,-1.7,-2.2,0.3,0.2,0.3,0.8,1.2,1.1,-1.0,0.9,1.1,],
            [-0.2,0.7,1.2,1.4,1.4,0.0,0.5,1.1,0.0,-0.8,-1.6,-0.0,-1.3,-0.2,-0.5,-0.6,-0.2,-2.4,0.7,0.8,],
            [0.6,-0.8,-0.1,-0.7,-1.0,0.8,0.3,-0.9,-0.1,-0.5,-0.7,-1.0,0.2,0.8,0.8,0.8,3.0,-1.7,-0.1,0.4,],
            [-1.2,-0.1,-0.5,-0.5,-0.3,-1.1,-0.1,0.5,0.4,-1.4,-1.8,0.5,0.4,0.5,0.9,0.8,1.6,-1.5,1.3,1.6,],
            [1.9,-0.5,-0.6,-0.3,-0.0,1.8,-0.7,-0.3,-0.8,1.9,1.8,-0.5,-0.5,-0.7,-0.8,-0.7,-0.6,1.0,-0.6,-0.7,],
            [-1.2,1.2,-1.3,-0.7,0.9,-0.1,-0.6,-0.3,-1.2,0.5,1.0,-0.2,-0.8,-1.1,-0.6,-0.2,2.3,1.7,0.1,0.5,],
            [0.7,-0.3,-0.1,0.1,-1.0,0.5,0.8,-0.7,0.2,1.6,-1.4,-0.1,0.9,-0.2,0.2,1.4,-3.1,-0.0,-0.1,0.7,],
            [-1.5,0.5,-0.0,0.6,0.6,-0.8,-0.4,0.1,-0.8,-0.1,-0.4,-0.7,-0.9,-0.3,0.7,0.8,1.1,-2.2,1.8,1.9,],
            [-0.3,-0.2,0.0,0.4,-0.4,-0.8,0.3,-0.5,0.8,-1.2,-2.7,0.1,0.4,-0.0,0.5,0.7,2.6,-0.9,0.5,0.6,],
            [-1.1,0.6,1.0,0.1,0.6,0.1,1.7,0.7,0.9,-0.3,0.9,0.5,0.4,0.2,-0.3,-1.0,-1.1,0.4,-1.8,-2.4,],
            [1.6,-0.6,-0.4,-0.6,-0.5,2.1,-0.7,-0.3,-0.7,2.3,1.6,-0.8,-0.6,-0.6,-0.6,-0.4,-0.6,0.7,-0.6,-0.4,],
            [-1.3,0.8,1.0,1.2,1.0,-2.1,0.7,-0.5,-0.1,-0.6,-0.9,0.4,0.4,0.3,0.3,0.3,-0.0,-2.4,0.1,1.1,],
            [1.8,-0.8,0.0,-0.6,-1.5,0.8,-0.0,-0.7,0.6,1.2,1.5,0.4,0.7,0.5,-0.3,-0.9,-1.6,1.2,-1.3,-1.1,],
            [0.0,-0.8,-0.7,-0.5,-0.3,-0.9,-0.5,-0.9,-0.4,-0.4,-0.7,-0.3,-0.4,1.0,1.0,0.9,3.3,-0.7,0.3,1.0,],
            [0.9,0.6,0.4,0.3,0.4,1.0,-0.3,0.2,-1.0,1.4,1.9,-1.0,-1.0,-1.1,-1.0,-0.8,-0.5,1.8,-1.2,-1.0,],
            [-0.2,-1.8,-1.0,-0.4,-1.0,1.0,-0.3,-0.6,0.3,1.1,0.2,0.1,0.0,-0.3,0.6,1.8,0.2,-2.2,0.7,1.6,],
            [-0.6,-0.4,-0.7,-0.5,-0.7,-0.3,-0.4,-0.5,-0.5,-0.8,-0.5,-0.5,-0.4,0.1,0.6,0.7,3.5,-0.6,1.2,1.3,],
            ];
        var array_config = {
            array: array,
            column_names: column_names,
            row_names: row_names,
        };
        element.empty();
        var canvas_config = {
            width: 600,
            height: 400,
            //translate_scale: {x: x, y:y, w:w, h:h},
        };
        element.dual_canvas_helper(canvas_config);
        element.array_explorer(array_config);
    };

})(jQuery);