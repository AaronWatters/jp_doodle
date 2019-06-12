"""
Python wrapper for DataTables functionality using proxy widgets

For details please refer to: http://www.datatables.net
"""

from jp_doodle import doodle_files
import jp_proxy_widget
import csv
from IPython.display import display, HTML

datatables_js = doodle_files.vendor_path("DataTables/datatables.js")
datatables_helper_js = doodle_files.vendor_path("js/jp_datatables_helper.js")
datatables_css = doodle_files.vendor_path("DataTables/datatables.css")

def widen_notebook():
    display(HTML("<style>.container { width:100% !important; }</style>"))

def load_datatable_requirements(widget):
    widget.load_css(datatables_css)
    widget.require_js("datatables_js", datatables_js)
    widget.load_js_files([datatables_helper_js])

class Table1(jp_proxy_widget.JSProxyWidget):
    "Very simple wrapper."
    def __init__(self, headers, rows, row_names=None, limit=None, *pargs, **kwargs):
        super(Table1, self).__init__(*pargs, **kwargs)
        self.limit = limit
        self.headers = headers
        rows = list(rows)
        if row_names is None:
            row_names = list(map(str, range(len(rows))))
        if limit:
            rows = rows[:limit]
            row_names = row_names[:limit]
        self.rows = rows
        load_datatable_requirements(self)
        self.js_init("""
            element.empty();
            var options = {
                entries: rows,
                column_names: col_names,
                row_names: row_names,
            }
            element.jp_datatables_helper(options);
        """, rows=rows, row_names=row_names, col_names=headers)
    

class Table0(jp_proxy_widget.JSProxyWidget):
    "Very simple wrapper."

    def __init__(self, headers, rows, jupyter=True, limit=None, *pargs, **kwargs):
        super(Table0, self).__init__(*pargs, **kwargs)
        self.limit = limit
        self.headers = headers
        self.rows = rows
        headers_html = self.format_headers_html(headers)
        body_html = self.format_body_html(rows)
        self.table_html = self.format_table(headers_html, body_html)
        self.options = self.get_options()
        if jupyter:
            load_datatable_requirements(self)
            self.js_init("""
                    element.empty();
                    var table_element = $(table);
                    element.requirejs( ["datatables_js"], function() {
                        table_element.DataTable(options);
                    });
                    table_element.appendTo(element);
                """, table=self.table_html, options=self.options)

    def get_options(self):
        return {
            "scrollX": True,
            }

    def format_headers_html(self, headers):
        L = []
        a = L.append
        a("<tr>")
        for elt in headers:
            a("<th> " + str(elt) + " </th>")
        a("</tr>")
        return "\n        ".join(L)

    def format_body_html(self, rows):
        L = []
        a = L.append
        count = 0
        for row in rows:
            if self.limit and count > self.limit:
                break
            count += 1
            a("<tr>")
            for elt in row:
                a("<td> " + str(elt) + " </td>")
            a("</tr>")
        return "\n             ".join(L)

    def format_table(self, headers_html, body_html):
        return """
        <table class="display" cellspacing="0" width="100%s">
        <thead>
        <tr>
        %s
        </tr>
        </thead>
        <tbody>
        %s
        </tbody>
        </table>
        """ % ("%", headers_html, body_html)

def CSVwidget(csv_path, dialect='excel', jupyter=True, limit=None, klass=Table1):
    f = open(csv_path)
    reader = csv.reader(f, dialect=dialect)
    headers = reader.next()
    return klass(headers, reader, jupyter=jupyter, limit=limit)

def TSVwidget(tsv_path, limit=None, klass=Table1):
    return CSVwidget(tsv_path, dialect="excel-tab", limit=limit)

if __name__ == "__main__":
    headers = "some header names".split()
    body = ["random body choice".split(), "another line example".split()]
    B = Table0(headers, body, jupyter=False)
    print (B.table_html)
