/*

JQuery plugin helper for designed for building dataTables useful in Jupyter.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

Next:
 - combine adjacent minimized rows using hide column
 - investigate combining hidden rows
 - change entry api
 - edit entry with keyboard navigation following Excel -- update validation callback
 - delete row/column -- deletion callback
 - insert column

*/
"use strict";

(function($) {
    $.fn.jp_datatables_helper = function (options, element) {
        element = element || this;

        var settings = $.extend({
            column_names: ["left", "right"],  // for example
            row_names: ["top", "bottom"], // for example
            entries: [
                ["left top", "right top"],
                ["left bottom", "right bottom"], 
            ],  // for example
            edit: true,
            row_name_css: {"font-weight": "bold"},
            header_css: {"font-style": "italic"},
            entry_css: {"background-color": ""},
            selected_css: {"background-color": "#dd9"},
            table_options: {scrollX: true},
        }, options);
        
        element.datatable_settings = settings;
        element.datatable_element = null;
        element.table_columns_index = null;
        element.table_rows_index = null;

        element.reset_datatable = function () {
            if (element.datatable_element) {
                element.datatable_element.destroy(true);
                element.datatable_element = null;
            }
            //element.datatable_element = {};
            element.table_columns_index = {};
            element.table_rows_index = {};
            var table = element.construct_html_table();
            var table_options = element.datatable_settings.table_options;
            // Table must be inserted in DOM before reformatting (???)
            // https://stackoverflow.com/questions/17237812/datatable-jquery-table-header-width-not-aligned-with-body-width
            table.css({"width":"100%"});
            var div = $("<div/>");
            div.css({overflow: "auto"});
            table.appendTo(div);
            div.appendTo(element);
            div.show();
            element.html_table = table;
            element.datatable_element = table.DataTable(table_options);
            element.datatable_element.on( 'draw', function () {
                //alert( 'Table redrawn' );
                element.fix_visibilities(true);  // hide only
            } );
            //element.datatable_element.columns.adjust().draw();
        };

        element.construct_html_table = function () {
            var table = $("<table/>");
            element.construct_thead().appendTo(table);
            element.construct_tbody().appendTo(table);
            return table;
        };

        element.construct_thead = function () {
            var thead = $("<thead/>");
            element.construct_headers().appendTo(thead);
            return thead;
        };

        element.construct_tbody = function () {
            var tbody = $("<tbody/>");
            var entries = element.datatable_settings.entries;
            var row_names = element.datatable_settings.row_names;
            for (var i=0; i<row_names.length; i++) {
                var row_name = row_names[i];
                var row_info = {
                    index: i,
                    name: row_name,
                    items: [],
                    hidden: false,  // don't show values if hidden
                    visible: true,   // don't take up space if not visible
                };
                element.table_rows_index[row_names[i]] = row_info;
                element.construct_row(row_info, entries[i]).appendTo(tbody);
            }
            return tbody;
        };

        element.construct_headers = function () {
            var column_names = element.datatable_settings.column_names;
            var tr = $("<tr/>");
            $("<th> # </th>").appendTo(tr);
            $("<th> &nbsp; </th>").appendTo(tr);
            for (let i=0; i<column_names.length; i++) {
                let column_name = column_names[i];
                let column_info = {
                    index: i,
                    name: column_name,
                    items: [],
                    hidden: false,  // don't show values if hidden
                    visible: true,  // don't take up space if not visible
                    column: function() { return element.datatable_element.column(i + 1); },
                };
                element.table_columns_index[column_name] = column_info;
                element.construct_header(column_info).appendTo(tr);
            }
            return tr;
        };

        element.construct_header = function (column_info) {
            var th = $("<th/>");
            var span = $("<span> " + column_info.name + " </span>");
            span.appendTo(th);
            if (element.datatable_settings.header_css) {
                span.css(element.datatable_settings.header_css);
            }
            var minimizer = $("<a> &mdash; </a>");
            var maximizer = $("<a> &hellip; </a>");
            maximizer.hide();
            minimizer.appendTo(th);
            maximizer.appendTo(th);
            minimizer.on("click", function(event) {
                element.toggle_column(column_info);
                event.preventDefault();
                return false;
            });
            maximizer.on("click", function(event) {
                element.toggle_column(column_info);
                event.preventDefault();
                return false;
            });
            column_info.header = span;
            column_info.maximizer = maximizer;
            column_info.minimizer = minimizer;
            return th;
        };

        element.construct_row = function (row_info, row_values) {
            var column_names = element.datatable_settings.column_names;
            var tr = $("<tr/>");
            element.construct_row_name(row_info).appendTo(tr);
            element.construct_row_control(row_info).appendTo(tr);
            for (var i=0; i<row_values.length; i++) {
                var column_info = element.table_columns_index[column_names[i]];
                element.construct_row_item(row_info, column_info, row_values[i]).appendTo(tr);
            }
            row_info.row = tr;
            row_info.hide = function () {
                tr.hide();
                for (var i=0; i<row_info.items.length; i++) {
                    row_info.items[i].hide();
                }
            };
            row_info.show = function () {
                tr.show();
                for (var i=0; i<row_info.items.length; i++) {
                    row_info.items[i].show();
                }
            };
            return tr;
        };

        element.construct_row_name = function (row_info) {
            var td = $("<td> " + row_info.name + " </td>");
            row_info.name_element = td;
            if (element.datatable_settings.row_name_css) {
                td.css(element.datatable_settings.row_name_css);
            }
            return td;
        };

        element.construct_row_control = function (row_info) {
            var td = $("<td/>");
            var minimizer = $("<a> &mdash; </a>");
            var maximizer = $("<a> &hellip; </a>");
            maximizer.hide();
            minimizer.appendTo(td);
            maximizer.appendTo(td);
            minimizer.on("click", function(event) {
                element.toggle_row(row_info);
            });
            maximizer.on("click", function(event) {
                element.toggle_row(row_info);
            });
            //row_info.header = span;
            row_info.maximizer = maximizer;
            row_info.minimizer = minimizer;
            return td;
        };

        element.construct_row_item = function (row_info, column_info, value) {
            var td = $("<td/>");
            var span = $("<span> " + value + "</span>");
            span.appendTo(td);
            if (element.datatable_settings.entry_css) {
                td.css(element.datatable_settings.entry_css);
            }
            var item = {
                td: td,
                span: span,
                value: value,
                hide: function () {
                    td.hide();
                    span.hide();
                },
                show: function () {
                    td.show();
                    span.show();
                },
            }
            row_info.items.push(item);
            column_info.items.push(item);
            return td;
        };

        element.toggle_row = function(row_info) {
            var row_index = row_info.index;
            var previous_row_info = null;
            var row_names = element.datatable_settings.row_names;
            if (row_index > 0) {
                previous_row_info = element.table_rows_index[row_names[row_index - 1]];
            }
            var next_row_info = null;
            if (row_index < row_names.length - 1) {
                next_row_info = element.table_rows_index[row_names[row_index + 1]];
            }
            var items = row_info.items;
            // XXXX could refactor common code here...
            var method = "hide";
            var reverse_method = "show";
            //var column = column_info.column();
            if (row_info.hidden) {
                var method = "show";
                var reverse_method = "hide";
                //column.visible(true);
                row_info.visible = true;
                if (next_row_info) {
                    //next_column.visible(true);
                    next_row_info.visible = true;
                }
            }
            row_info.hidden = !(row_info.hidden);
            //row_info.name_element[method]();
            //row_info.minimizer[method]();
            //row_info.maximizer[reverse_method]();
            for (var i=0; i<items.length; i++) {
                //items[i][method]();
            }
            if ((row_info.hidden) && (previous_row_info) && (previous_row_info.hidden)) {
                //column.visible(false);
                row_info.visible = false;
            }
            if ((row_info.hidden) && (next_row_info) && (next_row_info.hidden)) {
                //next_column.visible(false);
                next_row_info.visible = false;
            }
            /*
            for (var row_name in element.table_rows_index) {
                var info = element.table_rows_index[row_name];
                if (info.visible) {
                    info.row.show();
                } else {
                    info.row.hide();
                }
            }
            */
            element.fix_visibilities();
        };

        element.toggle_column = function (column_info) {
            var column_index = column_info.index;
            var previous_column_info = null;
            var column_names = element.datatable_settings.column_names;
            if (column_index > 0) {
                previous_column_info = element.table_columns_index[column_names[column_index - 1]];
            }
            var next_column_info = null;
            //var next_column = null;
            if (column_index < column_names.length - 1) {
                next_column_info = element.table_columns_index[column_names[column_index + 1]];
                //next_column = next_column_info.column();
            }
            var items = column_info.items;
            var method = "hide";
            var reverse_method = "show";
            //var column = column_info.column();
            if (column_info.hidden) {
                var method = "show";
                var reverse_method = "hide";
                //column.visible(true);
                column_info.visible = true;
                if (next_column_info) {
                    //next_column.visible(true);
                    next_column_info.visible = true;
                }
            }
            column_info.hidden = !(column_info.hidden);
            //column_info.header[method]();
            //column_info.minimizer[method]();
            //column_info.maximizer[reverse_method]();
            for (var i=0; i<items.length; i++) {
                //items[i][method]();
            }
            if ((column_info.hidden) && (previous_column_info) && (previous_column_info.hidden)) {
                //column.visible(false);
                column_info.visible = false;
            }
            if ((column_info.hidden) && (next_column_info) && (next_column_info.hidden)) {
                //next_column.visible(false);
                next_column_info.visible = false;
            }
            /*
            // datatables doesn't like to change the layout of hidden columns. make them visible then lay them out then fix visibility.
            for (var column_name in element.table_columns_index) {
                var info = element.table_columns_index[column_name];
                info.column().visible(true);
            }
            element.datatable_element.columns.adjust().draw();
            for (var column_name in element.table_columns_index) {
                var info = element.table_columns_index[column_name];
                //info.column().visible(info.visible);
            }
            */
            element.fix_visibilities();
        }

        element.fix_visibilities = function (hide_only) {
            if (!hide_only) {
                // make all columns visible
                //for (var column_name in element.table_columns_index) {
                //    var info = element.table_columns_index[column_name];
                //    info.column().visible(true);
                //}
                // make all rows visible
                for (var row_name in element.table_rows_index) {
                    var info = element.table_rows_index[row_name];
                    //info.row.show();
                }
            }
            // ... then set column visibilities
            for (var column_name in element.table_columns_index) {
                var info = element.table_columns_index[column_name];
                if (!info.visible) {
                    //info.column().visible(info.visible);
                    //info.hide();
                }
            }
            // ... then hide invisible rows
            for (var row_name in element.table_rows_index) {
                var info = element.table_rows_index[row_name];
                if (info.visible) {
                    //info.row.show();
                } else {
                    //info.hide();
                }
            }
        }
        // create the table the first time
        element.requirejs( ["datatables_js"], function() {
            element.reset_datatable();
        });
    };
    $.fn.jp_datatables_helper.example = function(element) {
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
        var options = {
            entries: array,
            column_names: column_names,
            row_names: row_names,
        }
    };
})(jQuery);