
from jp_doodle import doodle_files
from jp_doodle import dual_canvas
import jp_proxy_widget
import numpy as np

array_explorer_js = doodle_files.vendor_path("js/array_explorer.js")

def read_tsv_array(fn):
    """
    Read a table of numbers in a tab separated value representation.
    The first line  gives the column names.
    The remaining lines give the row name followed by numeric entry
    values for that row.
    """
    # open with universal newline support
    f = open(fn, "rU")
    heading = f.readline()
    assert heading[0] == "\t", "expect tab first in headings " + repr(heading)
    column_names = [x.strip() for x in heading[1:].split("\t")]
    row_names = []
    all_data = []
    for dataline in f:
        data = [x.strip() for x in dataline.split("\t")]
        rowname = data[0]
        valuestr = data[1:]
        values = map(float, valuestr)
        assert len(values) == len(column_names), repr(
            (len(values), len(column_names)))
        row_names.append(rowname)
        all_data.append(values)
    all_data = np.array(all_data)
    return (row_names, column_names, all_data)

def display_array(to_canvas_widget, row_names, col_names, data, config=None):
    to_canvas_widget.load_js_files([array_explorer_js])
    data_array = np.array(data)
    array_config = {
                "width": 290, "height": 300,
                "array": data.tolist(),
                "column_names": col_names,
                "row_names": row_names,
                "name_limit": 15,
            }
    if config:
        array_config.update(config)
    to_canvas_widget.element.array_explorer(array_config);

def snapshot_array(row_names, col_names, data, width=590, height=600, config=None):
    result = dual_canvas.SnapshotCanvas("array_experiment.png", width=width, height=height)
    display_array(result, row_names, col_names, data, config)
    return result

def snapshot_tsv_array(fn, **kw):
    (row_names, column_names, all_data) = read_tsv_array(fn)
    return snapshot_array(row_names, column_names, all_data, **kw)
