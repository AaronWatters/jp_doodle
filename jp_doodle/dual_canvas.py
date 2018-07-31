"""
Python convenience wrapper for creating dual canvases within proxy widgets.
"""

import jp_proxy_widget
from jp_doodle import doodle_files
from IPython.display import HTML, display

required_javascript_modules = [
    doodle_files.vendor_path("js/canvas_2d_widget_helper.js"),
    doodle_files.vendor_path("js/dual_canvas_helper.js"),
]

def load_requirements(widget=None, silent=True):
    """
    Load Javascript prerequisites into the notebook page context.
    """
    if widget is None:
        widget = jp_proxy_widget.JSProxyWidget()
        silent = False
    # Make sure jQuery and jQueryUI are loaded.
    widget.check_jquery()
    # load additional jQuery plugin code.
    widget.load_js_files(required_javascript_modules)
    if not silent:
        widget.element.html("<div>Requirements for <b>dual_canvas</b> have been loaded.</div>")
        display(widget)


class CanvasOperationsMixin(object):
    """
    Mixin for shared operations for different forms of canvas frames.
    """

    def circle(self, x, y, radius, color, fill=True, **other_args):
        "Draw a circle or arc on the canvas frame."
        s = dict(x=x, y=y, r=radius, color=color, fill=fill)
        s.update(other_args)
        self.call_method("circle", s)

    def line(self, x1, y1, x2, y2, color, lineWidth=None, **other_args):
        "Draw a line segment on the canvas frame."
        s = dict(x1=x1, y1=y1, x2=x2, y2=y2, color=color)
        if lineWidth:
            s["lineWidth"] = lineWidth
        s.update(other_args)
        self.call_method("line", s)

    def text(self, x, y, text, color, degrees=0, align="left", font=None, **other_args):
        "Draw some text on the canvas frame."
        s = dict(x=x, y=y, text=text, color=color, degrees=degrees, align=align)
        if font:
            s["font"] = font
        s.update(other_args)
        self.call_method("text", s)

    def rect(self, x, y, width, height, color, degrees=0, fill=True, **other_args):
        "Draw a rectangle on the canvas frame."
        s = dict(x=x, y=y, w=width, h=height, color=color, degrees=degrees, fill=fill)
        s.update(other_args)
        self.call_method("rect", s)

    def polygon(self, points, color, close=True, fill=True, **other_args):
        "Draw a polygon or polyline on the canvas frame"
        s = dict(points=points, color=color, close=close, fill=fill)
        s.update(other_args)
        self.call_method("polygon", s)


class DualCanvasWidget(jp_proxy_widget.JSProxyWidget, CanvasOperationsMixin):
    
    "Wrapper for dual_canvas jQuery extension object."

    default_config = dict(width=400, height=400)
    
    def __init__(self, width=None, height=None, config=None, *pargs, **kwargs):
        "Create a canvas drawing area widget."
        super(DualCanvasWidget, self).__init__(*pargs, **kwargs)
        load_requirements(self)
        if config is None:
            config = self.default_config.copy()
        if height is not None:
            config["height"] = height
        if width is not None:
            config["width"] = width
        # Standard initialization
        self.js_init("""
            element.empty();
            element.dual_canvas_helper(config);
            """, config=config)

    def reset_canvas(self):
        "Re-initialize the canvas drawing area."
        self.element.reset_canvas()

    def call_method(self, method_name, *arguments):
        """call method for target frame (for subclassing)"""
        self.element[method_name](*arguments)

    def fit(self, margin=0):
        "Adjust the translate and scale so that the visible objects are centered and visible."
        self.element.fit(None, margin)

    def change_element(self, name, **changed_options):
        "Change the configuration of a named object and request redraw."
        self.element.change_element(name, changed_options)

    def forget_objects(self, names):
        "Remove named objects from the canvas object list and request redraw."
        self.element.forget_object(names)

    def set_visibilities(self, names, visibility):
        "Make named objects visible or invisible."
        self.element.set_visibilities(names, visibility)

    def on_canvas_event(self, event_type, callback, for_name=None):
        "Register an event handler for the canvas or for a named element."
        self.element.on_canvas_event(event_type, callback, for_name)

    def off_canvas_event(self, event_type, for_name=None):
        "Unregister the event handler for the canvas or for a named element."
        self.element.off_canvas_event(event_type, for_name)

    def callback_with_pixel_color(self, pixel_x, pixel_y, callback):
        "For testing.  Deliver the color at pixel as a list of four integers to the callback(list_of_integers)."
        self.element.callback_with_pixel_color(pixel_x, pixel_y, callback)



