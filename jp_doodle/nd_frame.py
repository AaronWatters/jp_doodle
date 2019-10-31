"""
Python wrapper and related helpers for nd_frame functionality using proxy widgets.
"""

from jp_doodle import doodle_files, dual_canvas
import jp_proxy_widget
import csv
from IPython.display import display, HTML
from jp_doodle.dual_canvas import clean_dict

nd_frame_js = doodle_files.vendor_path("js/nd_frame.js")

def load_requirements(widget=None, silent=True, additional=()):
    all_files = [nd_frame_js] + list(additional)
    return dual_canvas.load_requirements(widget, silent, additional=all_files)


default_axes = {
    "x": {"x": 1},
    "y": {"y": 1},
    "z": {"z": 1},
}

class ND_Frame(dual_canvas.CanvasOperationsMixin):

    def __init__(
        self,
        in_canvas,
        dedicated_frame,
        feature_names=["x", "y", "z"],
        feature_axes=default_axes,
    ):
        self._internal_name = self.fresh_name("ND_Frame")
        load_requirements(in_canvas)
        self.in_canvas = in_canvas
        self.dedicated_frame = dedicated_frame
        self.feature_names = feature_names
        in_canvas.js_init("""
            var frame = element[frame_name];
            element[internal_name] = element.nd_frame({
                dedicated_frame: frame,
                feature_names: feature_names,
                feature_axes: feature_axes,
            });
            """,
            frame_name=dedicated_frame.attribute_name,
            feature_names=feature_names,
            feature_axes=feature_axes,
            internal_name=self._internal_name)
        self.element = in_canvas.element[self._internal_name]

    def get_canvas(self):
        return self.in_canvas

    def fit(self, zoom):
        "Fit the 2d frame to the 3d data."
        self.element.fit(zoom)

    def circle(self, location, r, color="black", fill=True, method_name="circle", **other_args):
        "Draw a circle or arc on the canvas frame."
        s = clean_dict(location=location, r=r, color=color, fill=fill)
        s.update(other_args)
        name = self.check_name(s, method_name)
        self.call_method(method_name, s)
        return self.wrap_name(name)

    def frame_circle(self, location, r, color="black", fill=True, **other_args):
        "Draw a circle or arc on the canvas frame with radius adjusted to the frame."
        return self.circle(location, r, color, fill, method_name="frame_circle", **other_args)

    def line(self, location1, location2, color="black", lineWidth=None, **other_args):
        "Draw a line segment on the canvas frame."
        s = clean_dict(location1=location1, location2=location2, color=color, lineWidth=lineWidth)
        s.update(other_args)
        name = self.check_name(s, "line")
        self.call_method("line", s)
        return self.wrap_name(name)

    def text(self, location, text, color="black", degrees=0, align="left", font=None, **other_args):
        "Draw some text on the canvas frame."
        s = clean_dict(location=location, text=text, color=color, degrees=degrees, align=align)
        if font:
            s["font"] = font
        s.update(other_args)
        name = self.check_name(s, "text")
        self.call_method("text", s)
        return self.wrap_name(name)

    def rect(self, location, w, h, color="black", degrees=0, fill=True, method_name="rect", **other_args):
        "Draw a rectangle on the canvas frame."
        s = clean_dict(location=location, w=w, h=h, color=color, degrees=degrees, fill=fill)
        s.update(other_args)
        name = self.check_name(s, method_name)
        self.call_method(method_name, s)
        return self.wrap_name(name)

    def frame_rect(self, location, w, h, color="black", degrees=0, fill=True, **other_args):
        "Draw a rectangle on the canvas frame adjusted by frame transform."
        return self.rect(location, w, h, color, degrees, fill, method_name="frame_rect", **other_args)

    def polyline(self, locations, color="black", **other_args):
        return self.polygon(locations, color, close=False, fill=False, **other_args)

    def polygon(self, locations, color="black", close=True, fill=True, **other_args):
        "Draw a polygon or polyline on the canvas frame"
        # convert tuples to lists automagically
        lpoints = []
        for p in locations:
            if type(p) != dict:
                p = list(p)
            lpoints.append(p)
        s = clean_dict(locations=lpoints, color=color, close=close, fill=fill)
        s.update(other_args)
        name = self.check_name(s, "polygon")
        self.call_method("polygon", s)
        return self.wrap_name(name)

    def orbit_all(self, radius, center3d=None):
        self.call_method("orbit_all", radius, center3d)

    def orbit(self, center3d, radius, shift2d):
        self.call_method("orbit", list(center3d), float(radius), list(shift2d))

    def orbit_off(self):
        self.call_method("orbit_off")

    def rotate_degrees(self, center3d, radius, direction2d, degreesPerSecond):
        self.call_method("rotate_degrees", list(center3d), float(radius), list(direction2d), float(degreesPerSecond))

    def rotation_off(self):
        self.call_method("rotation_off")

    def call_method(self, method_name, *arguments):
        """call method for target frame (for subclassing)"""
        self.element[method_name](*arguments)

    def reset(self):
        self.element.reset()

    def show(self):
        display(self.in_canvas)

def swatch3d(
    pixels=500,
    model_height=2.0,
    cx=0,
    cy=0,
    ):
    pixel_height = pixels
    dc_config = {
        "width": pixel_height,
        "height": pixel_height,
    }
    canvas = dual_canvas.DualCanvasWidget(width=pixel_height, height=pixel_height, config=dc_config)
    radius = model_height * 0.5
    frame = canvas.frame_region(
        0, 0, pixel_height, pixel_height,
        cx-radius, cy-radius, cx+radius, cy+radius)
    result = ND_Frame(canvas, frame)
    result.show()
    return result

