from jp_doodle.dual_canvas import swatch
from jp_doodle.auto_capture import embed_hidden, PythonExample
import inspect

DO_EMBEDDINGS = False

def show(frame, file_prefix=None, do_display=True):
    if DO_EMBEDDINGS:
        if file_prefix is None:
            file_prefix = inspect.stack()[1][3]
        filename = file_prefix + ".png"
        canvas_widget = frame.get_canvas()
        with embed_hidden(canvas_widget, filename):
            if do_display:
                frame.show()
    else:
        if do_display:
            frame.show()

def python_example(markdown, code, width=320, height=120):
    file_prefix = inspect.stack()[1][3]
    filename = file_prefix + ".png"
    EG = PythonExample(markdown, code, filename, width, height)
    EG.embed_prologue()
    EG.embed_code()
    EG.embed_widget(DO_EMBEDDINGS)

def py_circle_example():
    return python_example(
"A circle in python",
'''
    widget.circle(name="full filled", x=20, y=-10, r=50, color="orange");
''')

def py_arrow_example():
    return python_example(
"""
### 2.2 Drawing arrows

The `arrow` method draws an arrow between a head position and a tail position.
""",
'''
    widget.arrow(
        head_length=30,
        x1=50, y1=10,   # The tail end point of the line
        x2=320, y2=70,  # The head end point of the line
        color="red",   # Optional color (default: "black")
        lineWidth=4,    # Optional line width
        lineDash=[2,2], # Optional line dash pattern
        head_angle=45,  # Optional head segment angle in degrees (default 45)
        head_offset=10,  # Optional offset of head from endpoint
        symmetric=True, # If true draw two arrow head segments (default False)
    )
''')

def py_line_example():
    return python_example(
"""
### 2.1 Drawing lines

The `line` method draws a line segment between two end points.
""",
'''
    widget.line(
        x1=50, y1=10,   # One end point of the line
        x2=320, y2=30,  # The other end point of the line
        color="cyan",   # Optional color (default: "black")
        lineWidth=4,    # Optional line width
        lineDash=[5,2,1], # Optional line dash pattern
    )
''')
