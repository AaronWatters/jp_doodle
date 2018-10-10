/*

JQuery plugin helper for designed for building dataTables useful in Jupyter.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

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
            element.datatable_element = {};
            element.table_columns_index = {};
            element.table_rows_index = {};
            var table = element.construct_html_table();
            var table_options = element.datatable_settings.table_options;
            // https://stackoverflow.com/questions/17237812/datatable-jquery-table-header-width-not-aligned-with-body-width
            table.css({"width":"100%"});
            // Table must be inserted in DOM before reformatting (???)
            table.appendTo(element);
            element.datatable_element = table.DataTable(table_options);
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
            for (let i=0; i<row_names.length; i++) {
                let row_name = row_names[i];
                let row_info = {
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
            $("<th>#</th>").appendTo(tr);
            $("<th> &nbsp; </th>").appendTo(tr);
            for (let i=0; i<column_names.length; i++) {
                let column_name = column_names[i];
                column_info = {
                    index: i,
                    name: column_name,
                    items: [],
                    hidden: false,  // don't show values if hidden
                    visible: true,  // don't take up space if not visible
                    column: function() { return element.datatable_element.column(i + 2); },
                };
                element.table_columns_index[column_name] = column_info;
                element.construct_header(column_info).appendTo(tr);
            }
            return tr;
        };

        element.indexed_column_info = function(i) {
            var column_names = element.datatable_settings.column_names;
            if ((i>=0) && (i<column_names.length)) {
                return element.table_columns_index[column_names[i]];
            }
            return null;
        };

        element.toggle_column = function (column_info) {
            var column_index = column_info.index;
            var previous_column_info = element.indexed_column_info(column_index-1);
            var next_column_info = element.indexed_column_info(column_index+1);
            column_info.hidden = !(column_info.hidden);
            if ((column_info.hidden) && (previous_column_info) && (previous_column_info.hidden)) {
                column_info.visible = false;
            }
            if ((column_info.hidden) && (next_column_info) && (next_column_info.hidden)) {
                //next_column.visible(false);
                next_column_info.visible = false;
            }
            if ((!column_info.hidden) && (next_column_info)) {
                next_column_info.visible = true;
            }
            element.fix_visibilities();
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
            var toggle = function(event) {
                element.toggle_column(column_info);
                event.preventDefault();
                return false;
            };
            minimizer.on("click", toggle);
            maximizer.on("click", toggle);
            column_info.maximizer = maximizer;
            column_info.minimizer = minimizer;
            column_info.header = span
            column_info.check = function () {
                column_info.column().visible(column_info.visible);
                if (column_info.visible) {
                    if (column_info.hidden) {
                        span.hide();
                        minimizer.hide();
                        maximizer.show();
                    } else {
                        span.show();
                        minimizer.show();
                        maximizer.hide();
                    }
                    for (var i=0; i<column_info.items.length; i++) {
                        column_info.items[i].check();
                    }
                }
            }
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
                row_info.minimizer.hide();
                row_info.maximizer.show();
                for (var i=0; i<row_info.items.length; i++) {
                    row_info.items[i].hide();
                }
                if (row_info.visible) {
                    tr.show();
                } else {
                    tr.hide();
                }
            };
            row_info.show = function () {
                tr.show();
                row_info.minimizer.show();
                row_info.maximizer.hide();
                for (var i=0; i<row_info.items.length; i++) {
                    row_info.items[i].check();
                }
            };
            row_info.check = function () {
                if (row_info.hidden) {
                    row_info.hide();
                } else {
                    row_info.show();
                }
            }
            return tr;
        };

        element.construct_row_control = function (row_info) {
            var td = $("<td/>");
            var minimizer = $("<a> &mdash; </a>");
            var maximizer = $("<a> &hellip; </a>");
            maximizer.hide();
            minimizer.appendTo(td);
            maximizer.appendTo(td);
            var toggle = function(event) {
                element.toggle_row(row_info);
            };
            minimizer.on("click", toggle);
            maximizer.on("click", toggle);
            //row_info.header = span;
            row_info.maximizer = maximizer;
            row_info.minimizer = minimizer;
            return td;
        };

        element.construct_row_name = function (row_info) {
            var td = $("<td/>");
            var span = $("<span> " + row_info.name + " </span>");
            span.appendTo(td);
            if (element.datatable_settings.row_name_css) {
                span.css(element.datatable_settings.row_name_css);
            }
            row_info.name_element = td;
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
                    //td.hide();
                    span.hide();
                },
                show: function () {
                    //td.show();
                    span.show();
                },
                check: function () {
                    if ((row_info.hidden) || (column_info.hidden)) {
                        item.hide();
                    } else {
                        item.show();
                    }
                }
            };
            row_info.items.push(item);
            column_info.items.push(item);
            return td;
        };

        element.indexed_row_info = function(i) {
            var row_names = element.datatable_settings.row_names;
            if ((i>=0) && (i<row_names.length)) {
                return element.table_rows_index[row_names[i]];
            }
            return null;
        };

        element.toggle_row = function (row_info) {
            debugger
            var row_index = row_info.index;
            var previous_row_info = element.indexed_row_info(row_index-1);
            var next_row_info = element.indexed_row_info(row_index+1);
            row_info.hidden = !(row_info.hidden);
            if ((row_info.hidden) && (previous_row_info) && (previous_row_info.hidden)) {
                row_info.visible = false;
            }
            if ((row_info.hidden) && (next_row_info) && (next_row_info.hidden)) {
                //next_column.visible(false);
                next_row_info.visible = false;
            }
            if ((!row_info.hidden) && (next_row_info)) {
                next_row_info.visible = true;
            }
            element.fix_visibilities();
        };

        element.fix_visibilities = function () {
            var row_index = element.table_rows_index;
            for (row_name in row_index) {
                row_index[row_name].check();
            }
            var column_index = element.table_columns_index;
            for (column_name in column_index) {
                column_index[column_name].check();
            }
        };

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