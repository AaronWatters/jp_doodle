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
            finish(evaled, error);
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

class JavascriptExample:

    """
    Automatically execute code for a javascript example widget.
    Show the code and the widget and embed an image of the widget.
    """

    language = "Javascript"

    def __init__(
        self, prologue_markdown, code, image_filename, 
        width=320, height=120, 
        prefix=None, hide_after=True, frame=True, autoframe=10):
        (self.prologue_markdown, self.code, self.image_filename) = (prologue_markdown, code, image_filename)
        self.width = width
        self.height = height
        self.widget = None
        self.prefix = prefix
        self.hide_after = hide_after
        self.autoframe = autoframe

    def embed_prologue(self):
        from IPython.display import display, Markdown
        display(Markdown(self.prologue_markdown))

    def embed_code(self):
        from IPython.display import display, Markdown
        L = ["```%s" % self.language]
        L.append(self.code)
        L.append("```")
        txt = "\n".join(L)
        display(Markdown(txt))

    def execute_widget(self, widget):
        from jp_doodle import dual_canvas
        from IPython.display import display
        if widget is None:
            widget = dual_canvas.DualCanvasWidget(width=self.width, height=self.height)
        display(widget)
        self.exec_code(widget)

    def exec_code(self, widget):
        widget.js_init(self.code)
        if self.autoframe:
            #widget.fit()
            widget.lower_left_axes(color="#999", max_tick_count=5)
            widget.fit(margin=self.autoframe)

    def embed_widget(self, embed=True):
        from jp_doodle import auto_capture, dual_canvas
        self.widget = dual_canvas.DualCanvasWidget(width=self.width, height=self.height)
        if embed:
            with auto_capture.SaveAndEmbed(self.widget, self.image_filename, self.prefix, self.hide_after):
                self.execute_widget(self.widget)
        else:
            self.execute_widget(self.widget)

    def __call__(self):
        self.embed_prologue()
        self.embed_code()
        self.embed_widget()

class PythonExample(JavascriptExample):

    language = "Python"

    def exec_code(self, widget):
        code = "if 1:\n" + self.code
        g = globals()
        l = {"widget": widget}
        exec(code, g, l)
        if self.autoframe:
            widget.fit()
            widget.lower_left_axes(color="#999", max_tick_count=5)
            widget.fit(margin=self.autoframe)



IMAGE_COUNTER = 0

class SaveAndEmbed:

    """
    Context manager which saves a canvas as PNG image to a file
    and embeds the saved image in the output.
    """

    sleep_seconds = 0.5

    def __init__(self, canvas_widget, image_filename, prefix="<div>Image from widget:</div>\n", hide_after=False):
        self.canvas_widget = canvas_widget
        self.image_filename = image_filename
        self.prefix = prefix
        self.hide_after = hide_after

    def __enter__(self):
        pass

    def sync(self):
        test = javascript_eval(self.canvas_widget, "1+1")
        assert test == 2

    def __exit__(self, *ignored_arguments):
        w = self.canvas_widget
        # synchronize -- force execution of widget methods on javascript side
        self.sync()
        # sleep to allow draw operations to complete...
        time.sleep(self.sleep_seconds)
        w.save_pixels_to_png_async(self.image_filename)
        self.sync()
        # now file should exist: embed html
        lines = []
        if self.prefix:
            lines.append(self.prefix)
        #global IMAGE_COUNTER
        #IMAGE_COUNTER += 1
        lines.append('<img src="%s"/>' % (self.image_filename,))
        html = "\n".join(lines)
        display(HTML(html))
        if self.hide_after:
            w.element.hide()

def embed_hidden(canvas_widget, image_filename, prefix=None):
    return SaveAndEmbed(canvas_widget, image_filename, prefix, hide_after=True)

