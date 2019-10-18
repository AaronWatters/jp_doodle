"""
Python wrapper and related helpers for directed_network using proxy widgets.
"""

from jp_doodle import doodle_files, dual_canvas, nd_frame, data_tables
from jp_doodle.dual_canvas import clean_dict
import jp_proxy_widget
import csv
from IPython.display import display, HTML
import numpy as np

directed_network_js = doodle_files.vendor_path("js/directed_network.js")
gd_graph_js = doodle_files.vendor_path("js/gd_graph.js")
additional_js = [gd_graph_js, directed_network_js]

class Network_Widget(jp_proxy_widget.JSProxyWidget, dual_canvas.SaveImageMixin):

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
        self.customize()
        if display:
            self.display_all()

    def customize(self):
        """
        Add special user interface elements for Jupyter.
        """
        # add a button to save as PNG image
        self.js_init("""
            var d_network = element.d_network;
            var list_buttons = d_network.side_lists;
            d_network.add_button("<b>save as PNG</b>", list_buttons, callback);
        """, callback=self.save_png)

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

    def save_png(self, file_path=None):
        if file_path is None:
            file_path = "Network.png"
        self.clear_information()
        self.inform("Attempting to save as " + repr(file_path))
        def after():
            self.inform("Saved image " + repr(file_path))
        def error(e):
            self.inform("Image save failed.")
            self.inform("Exception: " + e)
        self.save_pixels_to_png_async(
            file_path, 
            canvas_element="element.d_network.canvas_element",
            after=after, error=error)

    def clear_information(self):
        self.element.d_network.clear_information()

    def inform(self, message):
        self.element.d_network.inform(message)

def graph(
        network_json=None,
        canvas_size=500,
        info_height=150,
        selector_size=90,
        sidebar_size=150,
        gap=10,
        min_color="#00f",
        min_threshold_color="#aaa",
        max_threshold_color="#bbb",
        max_color="orange",
        default_layout="grid",  # or "relax" or "skeleton"
        separator_radius=6,
        link_radius=1,
        min_change=1,
        undo_limit=10,
        font="normal 10px Arial",  # default node font
        color="#999", # default node font
        shape="text", # or "circle", "rect"
        radius=4,  # radius for circle or rect
        background=None,  # default node background
        src_font=None,  # overrides for src nodes
        src_color=None,
        src_background=None,
        src_shape=None,
        src_radius=None,
        **other_attributes
    ):
    s = clean_dict(
        network_json=network_json,
        canvas_size=canvas_size,
        info_height=info_height,
        selector_size=selector_size,
        sidebar_size=sidebar_size,
        gap=gap,
        min_color=min_color,
        min_threshold_color=min_threshold_color,
        max_threshold_color=max_threshold_color,
        max_color=max_color,
        default_layout=default_layout,  # or "relax" or "skeleton"
        separator_radius=separator_radius,
        link_radius=link_radius,
        min_change=min_change,
        undo_limit=undo_limit,
        font=font,
        color=color,
        background=background,
        shape=shape,
        radius=radius,
        src_font=src_font,
        src_color=src_color,
        src_background=src_background,
        src_shape=src_shape,
        src_radius=src_radius,
    )
    s.update(other_attributes)
    return Network_Widget(s)
