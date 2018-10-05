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
            for (var i=0; i<row_names.length; i++) {
                element.table_rows_index[row_names[i]] = {};
                element.construct_row(row_names[i], entries[i]).appendTo(tbody);
            }
            return tbody;
        };

        element.construct_headers = function () {
            var column_names = element.datatable_settings.column_names;
            var tr = $("<tr/>");
            $("<th>#</th>").appendTo(tr);
            for (var i=0; i<column_names.length; i++) {
                element.table_columns_index[column_names[i]] = {}
                element.construct_header(column_names[i]).appendTo(tr);
            }
            return tr;
        };

        element.construct_header = function (value) {
            var th = $("<th>" + value + "</th>");
            if (element.datatable_settings.header_css) {
                th.css(element.datatable_settings.header_css);
            }
            return th;
        };

        element.construct_row = function (row_name, row_values) {
            var tr = $("<tr/>");
            element.construct_row_name(row_name).appendTo(tr);
            for (var i=0; i<row_values.length; i++) {
                element.construct_row_item(row_values[i]).appendTo(tr);
            }
            return tr;
        };

        element.construct_row_name = function (value) {
            var td = $("<td>" + value + "</td>");
            if (element.datatable_settings.row_name_css) {
                td.css(element.datatable_settings.row_name_css);
            }
            return td;
        };

        element.construct_row_item = function (value) {
            var td = $("<td>" + value + "</td>");
            if (element.datatable_settings.entry_css) {
                td.css(element.datatable_settings.entry_css);
            }
            return td;
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