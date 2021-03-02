
import numpy as np
from jp_doodle import dual_canvas

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
    epsilon=1e-10):
    """
    Display the array as an image with the specified width and height.
    """
    array = np.array(array)
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
    widget = dual_canvas.DualCanvasWidget(width=width + 2 * margin, height=height + 2 * margin)
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
    return widget
    