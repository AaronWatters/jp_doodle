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
from imageio import imsave, imread

required_javascript_modules = [
    doodle_files.vendor_path("js/canvas_2d_widget_helper.js"),
    doodle_files.vendor_path("js/dual_canvas_helper.js"),
]

def load_requirements(widget=None, silent=True, additional=()):
    """
    Load Javascript prerequisites into the notebook page context.
    """
    if widget is None:
        widget = jp_proxy_widget.JSProxyWidget()
        silent = False
    # Make sure jQuery and jQueryUI are loaded.
    widget.check_jquery()
    # load additional jQuery plugin code.
    all_requirements = list(required_javascript_modules) + list(additional)
    widget.load_js_files(all_requirements)
    if not silent:
        widget.element.html("<div>Requirements for <b>dual_canvas</b> have been loaded.</div>")
        display(widget)


class CanvasOperationsMixin(object):
    """
    Mixin for shared operations for different forms of canvas frames.
    """

    # xxxx Not all methods may make sense for all subclasses.

    name_counter = 0
    tooltip_default = None

    def get_canvas(self):
        raise NotImplementedError("must implement at subclass")

    def fresh_name(self, prefix="anonymous"):
        CanvasOperationsMixin.name_counter += 1
        ms = int(time.time() * 1000)
        return "%s_%s_%s" % (prefix, CanvasOperationsMixin.name_counter, ms)

    def check_name(self, options, prefix="anon_name"):
        name = options.get("name")
        if name == True or ((not name) and options.get('events')):
            options["name"] = self.fresh_name(prefix)
        return options.get("name")

    def wrap_name(self, name):
        if not name:
            return name  # Don't wrap a falsey name
        return GeometryWrapper(self.get_canvas(), name)

    def circle(self, x, y, r, color="black", fill=True, method_name="circle", **other_args):
        "Draw a circle or arc on the canvas frame."
        s = clean_dict(x=x, y=y, r=r, color=color, fill=fill)
        s.update(other_args)
        name = self.check_name(s, method_name)
        self.call_method(method_name, s)
        return self.wrap_name(name)

    def frame_circle(self, x, y, r, color="black", fill=True, **other_args):
        "Draw a circle or arc on the canvas frame with radius adjusted to the frame."
        return self.circle(x, y, r, color, fill, method_name="frame_circle", **other_args)

    def line(self, x1, y1, x2, y2, color="black", lineWidth=None, lineDash=None, **other_args):
        "Draw a line segment on the canvas frame."
        s = clean_dict(x1=x1, y1=y1, x2=x2, y2=y2, color=color, lineDash=lineDash)
        if lineWidth:
            s["lineWidth"] = lineWidth
        s.update(other_args)
        name = self.check_name(s, "line")
        self.call_method("line", s)
        return self.wrap_name(name)

    def star(
            self, x, y, radius, points=5, color="black", fill=True, lineWidth=None, lineDash=None,
            **other_args):
        "Draw an arrow."
        s = clean_dict(
            x=x, y=y, radius=radius, points=points, color=color, fill=fill,
            lineDash=lineDash, lineWidth=lineWidth,
        )
        if lineWidth:
            s["lineWidth"] = lineWidth
        s.update(other_args)
        name = self.check_name(s, "star")
        self.call_method("star", s)
        return self.wrap_name(name)

    def arrow(
            self, x1, y1, x2, y2, head_length, color="black", lineWidth=None, lineDash=None,
            head_angle=45, head_offset=0, symmetric=False,
            **other_args):
        "Draw an arrow."
        s = clean_dict(
            x1=x1, y1=y1, x2=x2, y2=y2, color=color, lineDash=lineDash,
            head_length=head_length, head_angle=head_angle, head_offset=head_offset,
            symmetric=symmetric)
        if lineWidth:
            s["lineWidth"] = lineWidth
        s.update(other_args)
        name = self.check_name(s, "arrow")
        self.call_method("arrow", s)
        return self.wrap_name(name)

    def double_arrow(
            self, x1, y1, x2, y2, head_length, color="black", lineWidth=None, lineDash=None,
            head_angle=45, head_offset=0, symmetric=False,
            back_color="black", back_angle=45, line_offset=0, back_offset=0,
            **other_args):
        "Draw an arrow in both directions."
        s = clean_dict(
            x1=x1, y1=y1, x2=x2, y2=y2, color=color, lineDash=lineDash,
            head_length=head_length, head_angle=head_angle, head_offset=head_offset,
            back_color=back_color, back_angle=back_angle, line_offset=line_offset, back_offset=back_offset,
            symmetric=symmetric)
        if lineWidth:
            s["lineWidth"] = lineWidth
        s.update(other_args)
        name = self.check_name(s, "double_arrow")
        self.call_method("double_arrow", s)
        return self.wrap_name(name)

    def text(self, x, y, text, color="black", degrees=0, align="left", font=None, **other_args):
        "Draw some text on the canvas frame."
        s = clean_dict(x=x, y=y, text=text, color=color, degrees=degrees, align=align)
        if font:
            s["font"] = font
        s.update(other_args)
        name = self.check_name(s, "text")
        self.call_method("text", s)
        return self.wrap_name(name)

    def rect(self, x, y, w, h, color="black", degrees=0, fill=True, dx=0, dy=0, method_name="rect", **other_args):
        "Draw a rectangle on the canvas frame."
        s = clean_dict(x=x, y=y, w=w, h=h, color=color, degrees=degrees, fill=fill, dx=dx, dy=dy)
        s.update(other_args)
        name = self.check_name(s, method_name)
        self.call_method(method_name, s)
        return self.wrap_name(name)

    def frame_rect(self, x, y, w, h, color="black", degrees=0, fill=True, dx=0, dy=0, **other_args):
        "Draw a rectangle on the canvas frame adjusted by frame transform."
        return self.rect(x, y, w, h, color, degrees, fill, dx, dy, method_name="frame_rect", **other_args)

    def polyline(self, points, color="black", **other_args):
        return self.polygon(points, color, close=False, fill=False, **other_args)

    def polygon(self, points, color="black", close=True, fill=True, **other_args):
        "Draw a polygon or polyline on the canvas frame"
        # convert tuples to lists automagically
        lpoints = []
        for p in points:
            if type(p) != dict:
                p = list(p)
            lpoints.append(p)
        s = clean_dict(points=lpoints, color=color, close=close, fill=fill)
        s.update(other_args)
        name = self.check_name(s, "polygon")
        self.call_method("polygon", s)
        return self.wrap_name(name)

    def named_image(self, image_name, x, y, w, h, degrees=0, sx=None, sy=None, sWidth=None, sHeight=None, **other_args):
        s = clean_dict(
            x=x, y=y, w=w, h=h, image_name=image_name, 
            sx=sx, sy=sy, sHeight=sHeight, sWidth=sWidth, degrees=degrees)
        s.update(other_args)
        name = self.check_name(s, "image")
        self.call_method("named_image", s)
        return self.wrap_name(name)

    def reset_canvas(self):
        "Re-initialize the canvas drawing area."
        self.element.reset_canvas()

    def call_method(self, method_name, *arguments):
        """call method for target frame (for subclassing)"""
        self.element[method_name](*arguments)

    def fit(self, stats=None, margin=0):
        "Adjust the translate and scale so that the visible objects are centered and visible."
        self.element.fit(stats, margin)

    def change(self, name, **changed_options):
        "Change the configuration of a named object and request redraw."
        self.element.change(name, changed_options)

    def forget_objects(self, names):
        "Remove named objects from the canvas object list and request redraw."
        self.element.forget_objects(names)

    def set_visibilities(self, names, visibility):
        "Make named objects visible or invisible."
        self.element.set_visibilities(names, visibility)

    def on_canvas_event(self, event_type, callback, for_name=None, abbreviated=True, delay=True):
        "Register an event handler for the canvas or for a named element."
        mycanvas = self.get_canvas()
        # Translate 3 levels
        callback2 = mycanvas.callable(callback, level=3)
        # receive abbreviated event information by default to save bandwidth
        if abbreviated:
            return mycanvas.element.abbreviated_on_canvas_event(event_type, callback2, for_name, delay)
        else:
            return mycanvas.element.on_canvas_event(event_type, callback2, for_name)

    def off_canvas_event(self, event_type, for_name=None):
        "Unregister the event handler for the canvas or for a named element."
        self.element.off_canvas_event(event_type, for_name)

    def name_image_url(self, image_name, url, no_redraw=False):
        "Load an image by URL and give it a name for reference.  Redraw canvas when load completes, unless disabled."
        self.element.name_image_url(image_name, url, no_redraw)

    def request_redraw(self):
        self.element.request_redraw()

    def name_image_array(self, image_name, np_array,
            low_color=None, high_color=None):
        import numpy as np
        shape = np_array.shape
        ndim = len(shape)
        assert ndim > 1, "image data should have at least 2 dimensions"
        assert ndim < 4, "image data should have no more than 3 dimensions"
        # For now KISS: try to convert array to nrows x ncols x 4 for rgba values
        if ndim == 2:
            # grey scale, interpolate at javascript level
            (nrows, ncols) = shape
            coerced = np.zeros(shape, dtype=np.ubyte)
            coerced[:, :] = np_array
            #coerced = np.zeros((nrows, ncols, 4), dtype=np.ubyte)
            #for i in range(3):
            #    coerced[:, :, i] = np_array
            #coerced[:, :, 3] = 255   # fully opaque
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
        # (nrows, ncols, ncolors) = np_array.shape
        # assert ncolors == 4
        self.element.name_image_data(image_name, image_bytes, ncols, nrows, 
            low_color, high_color)

    def callback_with_pixel_color(self, pixel_x, pixel_y, callback, ms_delay=500):
        "For testing.  Deliver the color at pixel as a list of four integers to the callback(list_of_integers)."
        #self.element.callback_with_pixel_color(pixel_x, pixel_y, callback)
        # delay to be able to test animations and transitions.
        self.js_init("""
            setTimeout(
                (function() { element.callback_with_pixel_color(pixel_x, pixel_y, callback); }),
                ms_delay
            );
        """, pixel_x=pixel_x, pixel_y=pixel_y, callback=callback, ms_delay=ms_delay)

    def do_lasso(self, lasso_callback, delete_after=True, **config):
        "Use a polygon to select named elements.  Return name --> description mappint to the callback."
        self.element.do_lasso(lasso_callback, config, delete_after)

    def transition(self, object_name, to_values, seconds_duration=1):
        "transition configuration values of object with name smoothly over duration."
        self.element.transition(object_name, to_values, seconds_duration)

    def vector_frame(self, x_vector, y_vector, xy_offset, name=None):
        """
        Attach a named vector frame to the widget element and return an interface for accessing it.
        The vectors must be given as dictionaries like so: {"x": x_value, "y": y_value}.
        """
        # xxxx this doesn't make sense as a frame method?
        if not name:
            name = self.fresh_name("vector_frame")
        self.js_init("""
        // Attach the frame by name to the element
        element[name] = element.vector_frame(x_vector, y_vector, xy_offset, name);
        """, name=name, x_vector=x_vector, y_vector=y_vector, xy_offset=xy_offset)
        # return an interface wrapper for the named frame
        return FrameInterface(self, name)

    def rframe(self, scale_x, scale_y, translate_x=0, translate_y=0, name=None):
        """
        Attach a named rectangular frame to the widget element and return an interface for accessing it.
        """
        # xxxx this doesn't make sense as a frame method?
        if not name:
            name = self.fresh_name("rframe")
        self.js_init("""
        // Attach the frame by name to the element
        element[name] = element.rframe(scale_x, scale_y, translate_x, translate_y, name);
        """, name=name, scale_x=scale_x, scale_y=scale_y, translate_x=translate_x, translate_y=translate_y)
        # return an interface wrapper for the named frame
        return FrameInterface(self, name)

    def frame_region(self, minx, miny, maxx, maxy, frame_minx, frame_miny, frame_maxx, frame_maxy, name=None):
        """
        Attach a named frame region to the widget element and return an interface for accessing it.
        """
        # xxxx this doesn't make sense as a frame method?
        if not name:
            name = self.fresh_name("frame_region")
        self.js_init("""
        // Attach the frame by name to the element
        element[name] = element.frame_region(minx, miny, maxx, maxy, frame_minx, frame_miny, frame_maxx, frame_maxy, name);
        """, name=name, minx=minx, miny=miny, maxx=maxx, maxy=maxy,
        frame_minx=frame_minx, frame_miny=frame_miny, frame_maxx=frame_maxx, frame_maxy=frame_maxy)
        # return an interface wrapper for the named frame
        return FrameInterface(self, name)

    def add_axis_color_configs(self, config, color):
        if color is not None:
            for cfg in ("tick_line_config", "tick_text_config"):
                d = config.get(cfg, {})
                d["color"] = color
                config[cfg] = d

    def lower_left_axes(self, min_x=None, min_y=None, max_x=None, max_y=None, 
            max_tick_count=None, color=None, **other_args):
        s = clean_dict(min_x=min_x, min_y=min_y, max_x=max_x, max_y=max_y, 
                max_tick_count=max_tick_count)
        s.update(other_args)
        self.add_axis_color_configs(s, color)
        #self.call_method("lower_left_axes", s)
        self.element.lower_left_axes(s)

    def left_axis(self, min_value=None, max_value=None, method_name="left_axis", **other_args):
        s = clean_dict(min_value=min_value, max_value=max_value)
        s.update(other_args)
        return self.call_method(method_name, s)

    def bottom_axis(self, min_value=None, max_value=None, **other_args):
        return self.left_axis(min_value, max_value, method_name="bottom_axis", **other_args)

    def top_axis(self, min_value=None, max_value=None, **other_args):
        return self.left_axis(min_value, max_value, method_name="top_axis", **other_args)

    def right_axis(self, min_value=None, max_value=None, **other_args):
        return self.left_axis(min_value, max_value, method_name="right_axis", **other_args)

    def delay_redraw(self):
        """
        Context manager to group operations and delay redraws until all the operations are complete.

        >>> with my_canvas.delay_redraw();
        ...    complex_update1(my_canvas)
        ...    complex_update2(my_canvas)

        Above the complex updates will happen all at once and the user will not
        see the canvas in a partially updated state.
        """
        return DisableRedrawContextManager(self.get_canvas())

    def show(self):
        "Display the canvas"
        display(self.get_canvas())

    def deserialize_json_objects(self, object_list):
        """
        Install serialized json objects into the canvas or frame.
        """
        return self.element.deserialize_json_objects(object_list)

    def enable_tooltip(
        self,
        width="140px",
        height="auto",
        background="white",
        font="12px san-serif",
        tooltip_attribute="tooltip",   # if "canvas_name" then show the name by default
        on_events="mousemove",
        shift_left=10,
        shift_top=10,
        visible_opacity=0.8,
        ):
        """
        Enable a tooltip to open over named elements which have a tooltip attribute.
        """
        # Based on the tooltip implementation in array_explorer.
        canvas = self.get_canvas()
        canvas.js_init("""
            let tooltip = $("<div>tooltip here</div>").appendTo(element);
            tooltip.css({
                position: "absolute",
                width: width,
                height: height,
                background: background,
                font: font,
                opacity: 0,  // initially invisible.
            });
            element.jp_doodle_tooltip = tooltip;
            var event_handler = function(event) {
                var name = event.canvas_name;
                var tooltip_text = null;
                if (name) {
                    tooltip_text = event.object_info[tooltip_attribute]
                }
                if (tooltip_text) {
                    var element_offset = element.visible_canvas.offset();
                    var canvas_location = element.event_model_location(event);
                    var pixel_offset = element.event_pixel_location(event);
                    tooltip.offset({
                        left: pixel_offset.x + element_offset.left + shift_left,
                        top: pixel_offset.y + element_offset.top + shift_top,
                    });
                    tooltip.css({opacity: visible_opacity});
                    tooltip.html("<div>" + tooltip_text + "</div>");
                }
            };
            element.jp_doodle_tooltip_handler = event_handler;
            for (var i=0; i<event_types.length; i++) {
                var event_type = event_types[i];
                element.on_canvas_event(event_type, event_handler);
            }
            element.on_canvas_event("mouseout", function(event) {
                tooltip.css({opacity: 0});
            })
            """, 
            width=width, 
            height=height, 
            background=background, 
            font=font,
            shift_top=shift_top,
            shift_left=shift_left,
            visible_opacity=visible_opacity,
            tooltip_attribute=tooltip_attribute,
            event_types=on_events.split())


def clean_dict(**kwargs):
    "Like dict but with no None values"
    result = {}
    for kw in kwargs:
        v = kwargs[kw]
        if v is not None:
            result[kw] = v
    return result


# XXX the auto_flush part of the context manager should be a standard proxy_widgets feature.

class DisableRedrawContextManager(object):
    """
    Temporarily disable redraws on a canvas and also collect canvas messages into a single group.
    This can speed up scene updates and prevent the canvas from flashing partially modified scenes.
    """

    def __init__(self, canvas):
        self.canvas = canvas
        self.save_flush = canvas.auto_flush

    def __enter__(self):
        canvas = self.canvas
        # xxx maybe should save previous setting somehow.
        canvas.element.allow_auto_redraw(False)
        self.save_flush = canvas.auto_flush
        canvas.auto_flush = False

    def __exit__(self, type, value, traceback):
        canvas = self.canvas
        canvas.element.allow_auto_redraw(True)
        canvas.auto_flush = self.save_flush
        if (self.save_flush):
            canvas.flush()

class SaveImageMixin:

    """
    Logic for saving canvas image to array or file.
    """

    def pixels_array_async(self, callback, x=None, y=None, w=None, h=None, canvas_element=None):
        """
        Get all pixels in the canvas as an array, or pixels in rectangular region if specified.
        Deliver the result to the callback(a) as a numpy array.
        All parameters are in pixel offsets, not canvas transformed coordinates.
        The canvas_element if provided should be a string which evaluates in javascript
        to the target canvas (in the js_init context).
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
            var target = element;
            if (canvas_element) {
                target = eval(canvas_element);
            }
            var pixels = target.pixels(x, y, w, h);
            callback(pixels);
        """, callback=converter_callback, x=x, y=y, w=w, h=h, canvas_element=canvas_element)

    def save_pixels_to_png_async(
        self, file_path, x=None, y=None, w=None, h=None, 
        after=None, error=None, canvas_element=None):
        #import scipy.misc as sm
        def save_callback(image_array):
            try:
                imsave(file_path, image_array)
                if after:
                    after()
            except Exception as e:
                if error:
                    error(e)
                raise e
        self.pixels_array_async(save_callback, x, y, w, h, canvas_element=canvas_element)


class TopLevelCanvasMixin(CanvasOperationsMixin, SaveImageMixin):

    "Common operations for top level canvas objects."

    def get_canvas(self):
        return self

    def on_rendered(self, callable, *positional, **keyword):
        """
        After the widget has rendered, call the callable.
        This can be used to initialize an animation after the widget is visible, for example.
        xxxx this should probably be added to jp_proxy_widget.
        """
        def call_it():
            return callable(*positional, **keyword)
        self.js_init("call_it();", call_it=call_it)

    def in_dialog(self):
        self.element.dialog()

    def json_serialization_async(self, callback):
        """
        Get a JSON compatible serialization of the current canvas object configuration
        asynchronously delivered to a callback function at some later time.
        Note that image URLs are not converted to image arrays and relative URLs will not be portable.
        """
        self.js_init("""
            var json = element.json_serialize();
            callback(json);
        """, callback=callback)


class DualCanvasWidget(jp_proxy_widget.JSProxyWidget, TopLevelCanvasMixin):
    
    "Wrapper for dual_canvas jQuery extension object."

    default_config = dict(width=400, height=400)
    
    def __init__(self, width=None, height=None, font=None, config=None, *pargs, **kwargs):
        "Create a canvas drawing area widget."
        super(DualCanvasWidget, self).__init__(*pargs, **kwargs)
        load_requirements(self)
        if config is None:
            config = self.default_config.copy()
        if height is not None:
            config["height"] = height
        if width is not None:
            config["width"] = width
        if font is not None:
            config["font"] = font
        self.canvas_config = config
        # Standard initialization
        self.js_init("""
            element.empty();
            element.dual_canvas_helper(config);

            // other configuration: attach request animation frame for easy Python access.
            element.requestAnimationFrame = function(callback) {
                requestAnimationFrame(callback);
            };
            """, config=config)

    def requestAnimationFrame(self, callback):
        return self.element.requestAnimationFrame(callback)


class JSONDualCanvasWidget(jp_proxy_widget.JSProxyWidget, TopLevelCanvasMixin):

    "Dual canvas widget created from JSON serialization"

    def __init__(self, json_serialization, *pargs, **kwargs):
        "Create a canvas drawing area widget."
        super(JSONDualCanvasWidget, self).__init__(*pargs, **kwargs)
        load_requirements(self)
        self.initial_json = json_serialization
        # Standard initialization
        self.js_init("""
            element.empty();
            element.dual_canvas_json(json_serialization);
            """, json_serialization=json_serialization)


class FrameInterface(CanvasOperationsMixin):

    "Wrapper for frame inside a dual_canvas which is attached to the widget element by name."

    def __init__(self, from_widget, attribute_name):
        self.from_widget = from_widget
        self.attribute_name = attribute_name
        self.element = self.from_widget.element[self.attribute_name]

    def hide(self, hidden=True):
        self.element.change({"hide": True})

    def get_canvas(self):
        return self.from_widget

    def reset_frame(self):
        self.element.reset_frame()

    def set_region(self, minx, miny, maxx, maxy, frame_minx, frame_miny, frame_maxx, frame_maxy):
        self.element.set_region(minx, miny, maxx, maxy, frame_minx, frame_miny, frame_maxx, frame_maxy)

    def in_dialog(self):
        self.from_widget.in_dialog()

    def fit(self, stats=None, margin=0):
        self.from_widget.fit(stats=stats, margin=margin)


class SnapshotCanvas(DualCanvasWidget):

    "Canvas with support for making an image snapshot saved to a file and displayed in notebook."

    snapshot_counter = 0
    snapshot_widget = None

    def __init__(self, filename, width=None, height=None, config=None, *pargs, **kwargs):
        super(SnapshotCanvas, self).__init__(width, height, config, *pargs, **kwargs)
        self.snapshot_filename = filename
        self.check_file()
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
        self.snapshot_label_widget.value = text

    def display_all(self, widget_title="Canvas", button_text="Take Snapshot", snapshotTitle="Snapshot"):
        tabs = self.snapshot_tabs(widget_title, button_text, snapshotTitle)
        display(tabs)
        self.element[0].scrollIntoView()

    def check_file(self):
        "If snapshot doesn't exist save a placeholder image initially."
        filename = self.snapshot_filename
        if not os.path.isfile(filename):
            placeholder_source = doodle_files.vendor_path("js/NoSnapshot.png")
            shutil.copyfile(placeholder_source, filename)

    def _make_snapshot_widget(self):
        if self.snapshot_widget is not None:
            raise ValueError("do not make more than one snapshot widget per canvas.")
        (img_data, w, h) = self.img_data()
        im = self.image_widget = widgets.Image(
            value=img_data,
            format="png",
            width=w,
            height=h,
        )
        lb = self.snapshot_label_widget = widgets.Label(
            value=self.snapshot_filename + repr((w,h))
        )
        self.snapshot_widget = widgets.VBox(children=[im, lb])
        self.set_snapshot_text("No snapshot yet taken this session.")
        return self.snapshot_widget

    def img_data(self):
        filename = self.snapshot_filename
        img_data = open(filename, "rb").read()
        im = imread(filename)
        (h, w) = im.shape[:2]
        return (img_data, w, h)

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
            self.save_pixels_to_png_async(filename, after=self.after_save, error=self.save_error)
        except Exception as e:
            self.element["print"]("Snapshot exception: " + repr(e))
        else:
            self.element["print"]("New snapshot: " + repr(filename))

    def save_error(self, e):
        self.element["print"]("Snapshot save exception: " + repr(e))

    def after_save(self, *ignored_arguments):
        filename = self.snapshot_filename
        (img_data, w, h) = self.img_data()
        im = self.image_widget
        im.value = img_data
        im.width = w
        im.height = h
        self.set_snapshot_text(repr(filename) + " saved.  Save widget state to keep in notebook.")
        if self.tabs is not None:
            self.tabs.selected_index = 1


class GeometryWrapper:

    """
    Wrapper for a visible object on the canvas with convenient methods.
    """

    def __init__(self, on_canvas, name):
        self.on_canvas = on_canvas
        self.name = name

    def change(self, **changed_options):
        return self.on_canvas.change(self.name, **changed_options)

    def forget(self):
        return self.on_canvas.forget_objects([self.name])

    def visible(self, visibility=True):
        return self.on_canvas.set_visibilities([self.name], visibility)

    def on(self, event_type, callback):
        return self.on_canvas.on_canvas_event(event_type, callback, for_name=self.name)

    def off(self, event_type):
        return self.on_canvas.off_canvas_event(event_type, for_name=self.name)

    def transition(self, seconds_duration=1, **to_values):
        return self.on_canvas.transition(self.name, to_values, seconds_duration)

def swatch(
    pixels=500,
    model_height=2.0,
    cx=0,
    cy=0,
    snapfile=None,
    show=True,
    ):
    pixel_height = pixels
    dc_config = {
        "width": pixel_height,
        "height": pixel_height,
    }
    if snapfile:
        canvas = SnapshotCanvas(filename=snapfile, width=pixel_height, height=pixel_height, config=dc_config)
    else:
        canvas = DualCanvasWidget(width=pixel_height, height=pixel_height, config=dc_config)
    radius = model_height * 0.5
    frame = canvas.frame_region(
        0, 0, pixel_height, pixel_height,
        cx-radius, cy-radius, cx+radius, cy+radius)
    if show:
        if snapfile:
            canvas.display_all()
        else:
            display(canvas)
    return frame
