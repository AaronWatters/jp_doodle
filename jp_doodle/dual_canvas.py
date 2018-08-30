"""
Python convenience wrapper for creating dual canvases within proxy widgets.
"""

import jp_proxy_widget
from jp_doodle import doodle_files
from IPython.display import HTML, display, Image
import os
import shutil
import time
import ipywidgets as widgets

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

    # xxxx Not all methods may make sense for all subclasses.

    def circle(self, x, y, r, color="black", fill=True, **other_args):
        "Draw a circle or arc on the canvas frame."
        s = dict(x=x, y=y, r=r, color=color, fill=fill)
        s.update(other_args)
        self.call_method("circle", s)

    def line(self, x1, y1, x2, y2, color="black", lineWidth=None, **other_args):
        "Draw a line segment on the canvas frame."
        s = dict(x1=x1, y1=y1, x2=x2, y2=y2, color=color)
        if lineWidth:
            s["lineWidth"] = lineWidth
        s.update(other_args)
        self.call_method("line", s)

    def text(self, x, y, text, color="black", degrees=0, align="left", font=None, **other_args):
        "Draw some text on the canvas frame."
        s = dict(x=x, y=y, text=text, color=color, degrees=degrees, align=align)
        if font:
            s["font"] = font
        s.update(other_args)
        self.call_method("text", s)

    def rect(self, x, y, w, h, color="black", degrees=0, fill=True, **other_args):
        "Draw a rectangle on the canvas frame."
        s = dict(x=x, y=y, w=w, h=h, color=color, degrees=degrees, fill=fill)
        s.update(other_args)
        self.call_method("rect", s)

    def polygon(self, points, color="black", close=True, fill=True, **other_args):
        "Draw a polygon or polyline on the canvas frame"
        s = dict(points=points, color=color, close=close, fill=fill)
        s.update(other_args)
        self.call_method("polygon", s)

    def named_image(self, image_name, x, y, w, h, degrees=0, sx=None, sy=None, sWidth=None, sHeight=None, **other_args):
        s = dict(
            x=x, y=y, w=w, h=h, image_name=image_name, 
            sx=sx, sy=sy, sHeight=sHeight, sWidth=sWidth, degrees=degrees)
        s.update(other_args)
        self.call_method("named_image", s)

    def reset_canvas(self):
        "Re-initialize the canvas drawing area."
        self.element.reset_canvas()

    def call_method(self, method_name, *arguments):
        """call method for target frame (for subclassing)"""
        self.element[method_name](*arguments)

    def fit(self, stats=None, margin=0):
        "Adjust the translate and scale so that the visible objects are centered and visible."
        self.element.fit(stats, margin)

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

    def name_image_url(self, image_name, url, no_redraw=False):
        "Load an image by URL and give it a name for reference.  Redraw canvas when load completes, unless disabled."
        self.element.name_image_url(image_name, url, no_redraw)

    def name_image_array(self, image_name, np_array):
        import numpy as np
        shape = np_array.shape
        ndim = len(shape)
        assert ndim > 1, "image data should have at least 2 dimensions"
        assert ndim < 4, "image data should have no more than 3 dimensions"
        # For now KISS: try to convert array to nrows x ncols x 4 for rgba values
        if ndim == 2:
            (nrows, ncols) = shape
            coerced = np.zeros((nrows, ncols, 4), dtype=np.ubyte)
            for i in range(3):
                coerced[:, :, i] = np_array
            coerced[:, :, 3] = 255   # fully opaque
            np_array = coerced
        elif ndim == 3:
            (nrows, ncols, ncolors) = shape
            assert ncolors >= 3, "only 3 or 4 color channels supported"
            if ncolors == 3:
                coerced = np.zeros((nrows, ncols, 4), dtype=np.ubyte)
                for i in range(3):
                    coerced[:, :, i] = np_array[:, :, i]
                coerced[:, :, 3] = 255   # fully opaque
                np_array = coerced
            else:
                assert ncolors == 4, "more than 4 color channels are not supported"
                coerced = np.zeros(shape, dtype=np.ubyte)
                coerced[:,:,:] = np_array
                np_array = coerced
        image_bytes = bytearray(np_array.tobytes())
        (nrows, ncols, ncolors) = np_array.shape
        assert ncolors == 4
        self.element.name_image_data(image_name, image_bytes, ncols, nrows)

    def callback_with_pixel_color(self, pixel_x, pixel_y, callback):
        "For testing.  Deliver the color at pixel as a list of four integers to the callback(list_of_integers)."
        self.element.callback_with_pixel_color(pixel_x, pixel_y, callback)

    def do_lasso(self, lasso_callback, delete_after=True, **config):
        "Use a polygon to select named elements.  Return name --> description mappint to the callback."
        self.element.do_lasso(lasso_callback, config, delete_after)

    def named_vector_frame(self, name, x_vector, y_vector, xy_offset):
        """
        Attach a named vector frame to the widget element and return an interface for accessing it.
        The vectors must be given as dictionaries like so: {"x": x_value, "y": y_value}.
        """
        # xxxx this doesn't make sense as a frame method?
        self.js_init("""
        // Attach the frame by name to the element
        element[name] = element.vector_frame(x_vector, y_vector, xy_offset);
        """, name=name, x_vector=x_vector, y_vector=y_vector, xy_offset=xy_offset)
        # return an interface wrapper for the named frame
        return FrameInterface(self, name)

    def named_rframe(self, name, scale_x, scale_y, translate_x=0, translate_y=0):
        """
        Attach a named rectangular frame to the widget element and return an interface for accessing it.
        """
        # xxxx this doesn't make sense as a frame method?
        self.js_init("""
        // Attach the frame by name to the element
        element[name] = element.rframe(scale_x, scale_y, translate_x, translate_y);
        """, name=name, scale_x=scale_x, scale_y=scale_y, translate_x=translate_x, translate_y=translate_y)
        # return an interface wrapper for the named frame
        return FrameInterface(self, name)

    def named_frame_region(self, name, minx, miny, maxx, maxy, frame_minx, frame_miny, frame_maxx, frame_maxy):
        """
        Attach a named frame region to the widget element and return an interface for accessing it.
        """
        # xxxx this doesn't make sense as a frame method?
        self.js_init("""
        // Attach the frame by name to the element
        element[name] = element.frame_region(minx, miny, maxx, maxy, frame_minx, frame_miny, frame_maxx, frame_maxy);
        """, name=name, minx=minx, miny=miny, maxx=maxx, maxy=maxy,
        frame_minx=frame_minx, frame_miny=frame_miny, frame_maxx=frame_maxx, frame_maxy=frame_maxy)
        # return an interface wrapper for the named frame
        return FrameInterface(self, name)

    def lower_left_axes(self, min_x, min_y, max_x, max_y, **other_args):
        s = dict(min_x=min_x, min_y=min_y, max_x=max_x, max_y=max_y)
        s.update(other_args)
        #self.call_method("lower_left_axes", s)
        self.element.lower_left_axes(s)


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

    def pixels_array_async(self, callback, x=None, y=None, w=None, h=None):
        """
        Get all pixels in the canvas as an array, or pixels in rectangular region if specified.
        Deliver the result to the callback(a) as a numpy array.
        All parameters are in pixel offsets, not canvas transformed coordinates.
        """
        from jp_proxy_widget.hex_codec import hex_to_bytearray
        import numpy as np
        def converter_callback(imgData):
            width = imgData["width"]
            height = imgData["height"]
            data = imgData["data"]
            data_bytes = hex_to_bytearray(data)
            array1d = np.array(data_bytes, dtype=np.ubyte)
            bytes_per_pixel = 4
            image_array = array1d.reshape((height, width, bytes_per_pixel))
            callback(image_array)
        self.js_init("""
            var pixels = element.pixels(x, y, w, h);
            callback(pixels);
        """, callback=converter_callback, x=x, y=y, w=w, h=h)

    def save_pixels_to_png_async(self, file_path, x=None, y=None, w=None, h=None, after=None):
        import scipy.misc as sm
        def save_callback(image_array):
            sm.imsave(file_path, image_array)
            if after:
                after()
        self.pixels_array_async(save_callback, x, y, w, h)

class FrameInterface(CanvasOperationsMixin):

    "Wrapper for frame inside a dual_canvas which is attached to the widget element by name."

    def __init__(self, from_widget, attribute_name):
        self.from_widget = from_widget
        self.attribute_name = attribute_name
        self.element = self.from_widget.element[self.attribute_name]


class SnapshotCanvas(DualCanvasWidget):

    "Canvas with support for making an image snapshot saved to a file and displayed in notebook."

    snapshot_counter = 0
    snapshot_widget = None

    def __init__(self, filename, width=None, height=None, config=None, *pargs, **kwargs):
        super(SnapshotCanvas, self).__init__(width, height, config, *pargs, **kwargs)
        self.snapshot_filename = filename
        self.check_file()
        self.snapshot_id = self.fresh_id()
        self.snapshot_text_id = self.fresh_id()
        self.snapshot_widget = self._make_snapshot_widget()
        self.tabs = None

    def snapshot_tabs(self, widget_title="Canvas", button_text="Take Snapshot", snapshotTitle="Snapshot"):
        "Display self and a snapshot button together with snapshot image after."
        if self.tabs is not None:
            raise ValueError("cannot display_all more than once.")
        button = self.snapshot_button(button_text)
        assembly = widgets.VBox(children=[self, button])
        #display(assembly)
        #display(self.snapshot_widget)
        self.tabs = widgets.Tab(children=[assembly, self.snapshot_widget])
        self.tabs.set_title(0, widget_title)
        self.tabs.set_title(1, snapshotTitle)
        self.tabs.selected_index = 0
        return self.tabs

    def set_snapshot_text(self, text):
        self.js_init("""
        $("#"+text_id).html("<div>" + text + "</div>");
        """, text=text, text_id=self.snapshot_text_id)

    def display_all(self, widget_title="Canvas", button_text="Take Snapshot", snapshotTitle="Snapshot"):
        tabs = self.snapshot_tabs(widget_title, button_text, snapshotTitle)
        display(tabs)

    def check_file(self):
        "If snapshot doesn't exist save a placeholder image initially."
        filename = self.snapshot_filename
        if not os.path.isfile(filename):
            placeholder_source = doodle_files.vendor_path("js/NoSnapshot.png")
            shutil.copyfile(placeholder_source, filename)

    def _make_snapshot_widget(self):
        if self.snapshot_widget is not None:
            raise ValueError("do not make more than one snapshot widget per canvas.")
        html_text = '<img src="%s" id="%s"/>' % (self.snapshot_filename, self.snapshot_id)
        html_text += '\n <div id="%s">%s</div>' % (self.snapshot_text_id, self.snapshot_filename)
        snapshot_widget = widgets.HTML(value=html_text)
        #snapshot_widget = widgets.Accordion(children=[html_widget])
        #snapshot_widget.set_title(0, title)
        #snapshot_widget.selected_index = None  # hide initially when widget is active
        self.snapshot_widget = snapshot_widget
        self.set_snapshot_text("No snapshot yet taken this session.")
        return snapshot_widget

    def snapshot_button(self, text=None):
        fn = self.snapshot_filename
        if text is None:
            text = "snapshot to " + repr(fn)
        result = jp_proxy_widget.JSProxyWidget()
        result.js_init("""
        element.empty();
        var button = $("<button>" + text + "</button>").appendTo(element);
        element.click(snapshot_callback)
        """, text=text, snapshot_callback=self.snapshot_callback)
        return result

    def snapshot_callback(self, *ignored_arguments):
        filename = self.snapshot_filename
        try:
            self.save_pixels_to_png_async(filename, after=self.after_save)
        except Exception as e:
            self.element["print"]("Snapshot exception: " + repr(e))
        else:
            self.element["print"]("New snapshot: " + repr(filename))

    def after_save(self, *ignored_arguments):
        """change the snapshot image src to force a reload"""
        nonce = self.fresh_id()
        identity = self.snapshot_id
        filename = self.snapshot_filename
        self.js_init("""
        debugger;
        var img = $("#" + identity);
        var src = img.attr("src");
        img.attr("src", src + "?nonce=" + nonce);
        // element.print("saved " + img.attr("src") + " please save widget state.");
        """, identity=identity, nonce=nonce, filename=filename)
        #self.snapshot_widget.selected_index = 0
        self.set_snapshot_text(filename + " saved.  Save widget state to keep in notebook.")
        self.tabs.selected_index = 1

    def fresh_id(self):
        SnapshotCanvas.snapshot_counter += 1
        ms = int(time.time() * 1000)
        return "snapshot_id_%s_%s" % (SnapshotCanvas.snapshot_counter, ms)

