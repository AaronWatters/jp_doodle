"""
Tools to automatically capture a jp_doodle canvas
and other tools mainly useful for creating user documentation.
"""

from jupyter_ui_poll import (
    ui_events, 
    with_ui_events,
    run_ui_poll_loop
)
import time
from IPython.display import display, HTML


class JSEval:

    """
    Polling manager used to evaluate a string expression in Javascript in a js_proxy_widget context.
    """
    #  XXX This could be moved to js_proxy_widget as it is generally useful.
    
    def __init__(self, widget, string_expression):
        self.widget = widget
        self.expr = string_expression
        self.results = None
        self.sync()
        run_ui_poll_loop(self.done)

    def sync(self):
        self.widget.js_init("""
            var evaled = null;
            var error = null;
            try {
                evaled = eval(expr);
            } catch (e) {
                error = "exception: " + e;
            };
            finish(evaled, error)
        """, expr=self.expr, finish=self.finish)
        
    def finish(self, result, error):
        self.results = (result, error)
        
    def done(self):
        return self.results
    
    def value(self):
        results = self.results
        if not results:
            raise ValueError("no results yet.")
        (result, error) = results
        if error:
            raise ValueError("error reported: " + repr(error))
        return result
     
def javascript_eval(widget, string_expression):
    """
    Return the result of evaluating the Javascript string_expreession in the widget context.
    """
    e = JSEval(widget, string_expression)
    e.sync()
    return e.value()

IMAGE_COUNTER = 0

class SaveAndEmbed:

    """
    Context manager which saves a canvas as PNG image to a file
    and embeds the saved image in the output.
    """

    sleep_seconds = 0.5

    def __init__(self, canvas_widget, image_filename, prefix="<div>Image result</div>\n"):
        self.canvas_widget = canvas_widget
        self.image_filename = image_filename
        self.prefix = prefix

    def __enter__(self):
        pass

    def sync(self):
        test = javascript_eval(self.canvas_widget, "1+1")
        assert test == 2

    def __exit__(self, *ignored_arguments):
        w = self.canvas_widget
        # synchronize -- force execution of widget methods on javascript side
        self.sync()
        # sleep to allow draw operations...
        time.sleep(self.sleep_seconds)
        w.save_pixels_to_png_async(self.image_filename)
        self.sync()
        # now file should exist: embed html
        lines = []
        if self.prefix:
            lines.append(self.prefix)
        global IMAGE_COUNTER
        IMAGE_COUNTER += 1
        lines.append('<img src="%s"/>' % (self.image_filename,))
        html = "\n".join(lines)
        display(HTML(html))
