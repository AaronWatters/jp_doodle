
"""
H5Gizmos wrapper for aircraft_axes.js.
"""

from . import dual_canvas
from . import doodle_files
from H5Gizmos import do, get
from H5Gizmos.python import gz_jQuery

class AircraftAxes(gz_jQuery.jQueryComponent):

    default_config = dict(
        width=200,
        )
    
    def __init__(self, options=None, on_change=None, delay=0.1):
        """Create an aircraft axes 2D slider.
        on_change should accept on_change(roll, pitch, yaw) in radians -pi to pi.
        """
        super().__init__(init_text=None, tag="<div/>")
        settings = self.default_config.copy()
        if options:
            settings.update(options)
        self.settings = settings
        self.pitch = self.yaw = self.roll = 0
        self.on_change = None
        if on_change is not None:
            self.on_change = gz_jQuery.DeJitterCallback(on_change, delay)

    def add_dependencies(self, gizmo):
        super().add_dependencies(gizmo)
        add_js_files(self)

    def configure_jQuery_element(self, element):
        options = self.settings.copy()
        if options.get("on_change") is None:
            options["on_change"] = self.on_change_record_coords
        #gizmo = self.gizmo
        self.axes = self.cache("axes", element.aircraft_axes(options))
        do(self.axes.report())

    def on_change_record_coords(self, coords):
        self.pitch = coords["pitch"]
        self.yaw = coords["yaw"]
        self.roll = coords["roll"]
        if self.on_change:
            self.on_change(self.roll, self.pitch, self.yaw)

    def report(self):
        do(self.axes.report())

    def reset_coords(self, yaw=0, pitch=0, roll=0):
        "set coords and call on_change if defined."
        do(self.axes.reset_coords(yaw, pitch, roll))

def add_js_files(to_gizmo_component):
    for path in dual_canvas.required_javascript_modules:
        to_gizmo_component.js_file(path)
    axes_path = doodle_files.vendor_path("js/aircraft_axes.js")
    to_gizmo_component.js_file(axes_path)
