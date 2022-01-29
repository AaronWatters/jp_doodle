"""
Python convenience wrapper for creating dual canvases within H5Gizmos.
"""

from . import dual_canvas
from H5Gizmos import do, DoAllMethods
from H5Gizmos.python import gz_jQuery

class DoodleGizmo(dual_canvas.CanvasOperationsMixin, gz_jQuery.jQueryComponent):

    default_config = dict(width=400, height=400)
    
    def __init__(self, width=None, height=None, font=None, config=None, title="canvas"):
        "Create a canvas drawing area gizmo."
        super().__init__(init_text=None, tag="<div/>", title=title)
        if config is None:
            config = self.default_config.copy()
        if height is not None:
            config["height"] = height
        if width is not None:
            config["width"] = width
        if font is not None:
            config["font"] = font
        self.canvas_config = config

    def add_dependencies(self, gizmo):
        super().add_dependencies(gizmo)
        add_js_files(self)

    def configure_jQuery_element(self, element):
        gizmo = self.gizmo
        do(element.empty())
        canvas = self.cache("canvas", gizmo.jQuery("<div/>").appendTo(element))
        do(canvas.dual_canvas_helper(self.canvas_config))
        self.doodle = DoAllMethods(canvas)

    def get_canvas(self):
        return self

def add_js_files(to_gizmo_component):
    for path in dual_canvas.required_javascript_modules:
        to_gizmo_component.js_file(path)
