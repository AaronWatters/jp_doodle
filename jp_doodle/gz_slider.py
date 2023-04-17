
"""
H5Gizmos wrapper for xy_slider.js.
"""

from . import dual_canvas
from . import doodle_files
from H5Gizmos import do, get
from H5Gizmos.python import gz_jQuery

class XYSlider(gz_jQuery.jQueryComponent):

    default_config = dict(
        length= 500,
        xmin= -180,
        xmax= 180,
        ymin= -90,
        ymax= 90,
        initialx= 0,
        initialy= 0,
        )
    
    def __init__(self, options=None, on_change=None, delay=0.1):
        "Create a 2D slider."
        super().__init__(init_text=None, tag="<div/>")
        settings = self.default_config.copy()
        if options:
            settings.update(options)
        self.settings = settings
        self.x = settings["initialx"]
        self.y = settings["initialy"]
        self.on_change = None
        if on_change is not None:
            self.on_change = gz_jQuery.DeJitterCallback(on_change, delay)

    def add_dependencies(self, gizmo):
        super().add_dependencies(gizmo)
        add_js_files(self)

    def configure_jQuery_element(self, element):
        options = self.settings.copy()
        if options.get("on_change") is None:
            options["on_change"] = self.on_change_record_xy
        #gizmo = self.gizmo
        do(element.xy_slider(options))

    def on_change_record_xy(self, x, y):
        self.x = x
        self.y = y
        if self.on_change:
            self.on_change(x, y)

def add_js_files(to_gizmo_component):
    for path in dual_canvas.required_javascript_modules:
        to_gizmo_component.js_file(path)
    xy_path = doodle_files.vendor_path("js/xy_slider.js")
    to_gizmo_component.js_file(xy_path)
