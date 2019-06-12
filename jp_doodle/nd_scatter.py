"""
Python wrapper and related helpers for nd_scatter functionality using proxy widgets.
"""

from jp_doodle import doodle_files, dual_canvas, nd_frame
import jp_proxy_widget
import csv
from IPython.display import display, HTML

nd_scatter_js = doodle_files.vendor_path("js/nd_scatter.js")

class ND_Scatter_Widget(jp_proxy_widget.JSProxyWidget):

    "Wrapper for an nd-scatter structure."
    
    def __init__(self, jsondata=None, config=None, *pargs, **kwargs):
        "Create a canvas drawing area widget."
        super(ND_Scatter_Widget, self).__init__(*pargs, **kwargs)
        nd_frame.load_requirements(self, additional=[nd_scatter_js])
        if config is None:
            config = {}
        self.js_init("""
            element.empty();
            element.scatter_plot = element.nd_scatter(config);
            element.scatter_plot.make_scaffolding();
        """, config = config)
        if jsondata is not None:
            self.element.scatter_plot.define_json(jsondata)
        
        