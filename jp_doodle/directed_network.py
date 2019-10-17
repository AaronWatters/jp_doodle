"""
Python wrapper and related helpers for directed_network using proxy widgets.
"""

from jp_doodle import doodle_files, dual_canvas, nd_frame, data_tables
from jp_doodle.dual_canvas import clean_dict
import jp_proxy_widget
import csv
from IPython.display import display, HTML
from sklearn.preprocessing import StandardScaler
import numpy as np

directed_network_js = doodle_files.vendor_path("js/directed_network.js")
gd_graph_js = doodle_files.vendor_path("js/gd_graph.js")
additional_js = [gd_graph_js, directed_network_js]

class Network_Widget(jp_proxy_widget.JSProxyWidget):

    "Wrapper for an nd-scatter structure."
    
    def __init__(self, config=None, display=False, *pargs, **kwargs):
        "Create a canvas drawing area widget."
        super(Network_Widget, self).__init__(*pargs, **kwargs)
        data_tables.widen_notebook()
        nd_frame.load_requirements(self, additional=additional_js)
        if config is None:
            config = {}
        self.js_init("""
            element.empty();
            element.d_network = element.directed_network(config);
        """, config = config)
        if display:
            self.display_all()

    def display_all(self):
        self.element.d_network.display_all()

    def node(
        self,
        node_name,
        color=None,
        background=None,
        font=None,
        position=None,
        **other_args
        ):
        if position is not None:
            if type(position) is not dict:
                (x, y) = position
                position = {"x": x, "y": y}
        s = clean_dict(color=color, background=background, font=font, position=position)
        s.update(other_args)
        self.element.d_network.node(node_name, s)

    def edge(
        self,
        source_name,
        destination_name,
        weight=1,
        color=None,
        lineWidth=None,
        lineDash=None,
        **other_args
        ):
        s = clean_dict(color=color, lineWidth=lineWidth, lineDash=lineDash)
        s.update(other_args)
        self.element.d_network.edge(source_name, destination_name, weight, s)

