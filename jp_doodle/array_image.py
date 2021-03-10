
import numpy as np
from jp_doodle import dual_canvas

def default_hover_callback(x, y, array):
    [Y, X] = array.shape[:2]
    prefix = repr((x, y)) + ": "
    suffix = "out of bounds"
    if 0 <= x < X and 0 <= y < Y:
        suffix = repr(array[y, x])
    return prefix + suffix

def show_array(
    array, 
    width=None, 
    height=None, 
    #axes=True,   # axes have problems...
    background=None,
    scale=True, 
    shift_min=True, 
    margin=50,
    textcolor="red",
    textbackground="yellow",
    font="normal 15px Courier",
    hover_text_callback=default_hover_callback,
    hover_color="rgba(200,100,50,0.5)",
    epsilon=1e-10,
    widget=None):
    """
    Display the array as an image with the specified width and height.
    """
    array = np.array(array)
    source_array = array
    if scale:
        M = array.max()
        m = array.min()
        if m > 0 and not shift_min:
            m = 0.0
        diff = M - m
        grey_max = 255
        if diff < epsilon:
            diff = 1.0
        array = (array - m) * (grey_max / diff)
    (iheight, iwidth) = array.shape[:2]
    if width is None:
        width = iwidth
    if height is None:
        height = iheight
    if widget is None:
        widget = dual_canvas.DualCanvasWidget(width=width + 2 * margin, height=height + 2 * margin)
    widget.reset_canvas()
    if background:
        widget.rect(0, 0, w=width + 2 * margin, h=height + 2 * margin, color=background)
    name = "array image"
    widget.name_image_array(name, array)
    frame = widget.frame_region(
        minx=margin, miny=margin, maxx=width + margin, maxy=height + margin, 
        frame_minx=0, frame_miny=iheight, frame_maxx=iwidth, frame_maxy=0)
    full = frame.named_image("array image", 0, iheight, width, height, name=True)
    widget.text(width+margin, height+margin+5, str(iwidth), align="right", color=textcolor, font=font, background=textbackground)
    widget.text(margin-5, margin, str(iheight), degrees=90, color=textcolor, font=font, background=textbackground)
    if hover_text_callback:
        hover_info = widget.text(margin, height+margin+5, str(array.shape),
            color=textcolor, font=font, background=textbackground, name=True)
        widget.hover_info = hover_info
        upline = frame.frame_rect(x=0, y=0, w=1, h=0, color=hover_color, name=True, events=False)
        downline = frame.frame_rect(x=0, y=0, w=1, h=0, color=hover_color, name=True, events=False)
        leftline = frame.frame_rect(x=0, y=0, w=0, h=1, color=hover_color, name=True, events=False)
        rightline = frame.frame_rect(x=0, y=0, w=0, h=1, color=hover_color, name=True, events=False)
        def on_hover(event):
            position = event['model_location']
            x = int(position["x"])
            y = int(position["y"])
            upline.change(x=x, h=y)
            downline.change(x=x, y=y+1, h=iheight-y-1)
            leftline.change(y=y, w=x)
            rightline.change(y=y, x=x+1, w=iwidth-x-1)
            try:
                cb_text = hover_text_callback(x, y, source_array)
            except Exception as e:
                e_text = repr(e)
                hover_info.change(text=e_text)
                raise
            else:
                hover_info.change(text=cb_text)
        full.on("mousemove", on_hover)
        def on_out(event):
            upline.change(h=0)
            downline.change(h=0)
            leftline.change(w=0)
            rightline.change(w=0)
        full.on("mouseout", on_out)
    widget.image_display = full
    return widget

