from jp_doodle.dual_canvas import swatch
from jp_doodle.auto_capture import embed_hidden, PythonExample, JavascriptExample
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

def js_example(markdown, code, width=320, height=120, axes=True):
    file_prefix = inspect.stack()[1][3]
    filename = file_prefix + ".png"
    EG = JavascriptExample(markdown, code, filename, width, height, axes=axes)
    EG.embed_prologue()
    EG.embed_code()
    EG.embed_widget(DO_EMBEDDINGS)

def js_frame_example():
    return js_example(
"""
### Create a reference frame inside a dual canvas

Pixel coordinates are rarely the most convenient coordinate systems to
use for scientific visualizations.  Reference frames allow drawing using
transformed coordinates.  The `frame_region` method creates a frame
by mapping reference points in the pixel space to reference
points in the reference frame coordinate space.  Objects can then
be drawn on the reference frame and the underlying coordinates will be
converted automatically.

The following Javascript creates a reference `frame` from the canvas `element`
and draws some reference marks on the frame.  Reference axes in canvas coordinates
are also shown in grey.
""",
"""
// Map pixel coords (10,10) and (400,100)
//  to frame coords (-1, 0) and (1, 2)
var frame = element.frame_region(
        10, 10, 400, 100,
        -1, 0, 1, 2);
// draw some reference marks on the frame:
frame.text({x:-1, y:0, text:"-1,0", color:"red", background:"yellow"} );
frame.text({x:1, y:2, text:"1,2", align:"right", color:"red", background:"yellow"} );
frame.lower_left_axes({min_x:-1, min_y:0, max_x:1, 
                         max_y:2, x_anchor:0, y_anchor:1, max_tick_count:5, color:"blue"})
"""
    )

def js_2_frame_example():
    return js_example(
"""
### Create two reference frames inside a dual canvas

It is possible to create many reference frames inside a dual canvas each with a different
coordinate transform.  The following Javascript places two canvases side-by-side and
annotates them similarly using the same frame coordinates.
""",
"""
// Map pixel coords (10,10) and (190,100) to frame coords (-1, 0) and (1, 2) in frame1
var frame1 = element.frame_region(
        10, 10, 190, 100,
        -1, 0, 1, 2);
// draw some reference marks on the frame1:
frame1.text({x:-1, y:0, text:"-1,0", color:"red", background:"yellow"} );
frame1.text({x:1, y:2, text:"1,2", align:"right", color:"red", background:"yellow"} );
frame1.lower_left_axes({min_x:-1, min_y:0, max_x:1, 
                         max_y:2, x_anchor:0, y_anchor:1, max_tick_count:5, color:"blue"})
// Map pixel coords (210,10) and (400,100) to frame coords (-1, 0) and (1, 2) in frame2
var frame2 = element.frame_region(
        210, 10, 400, 100,
        -1, 0, 1, 2);
// draw some reference marks on the frame1:
frame2.text({x:-1, y:0, text:"-1,0", color:"red", background:"cyan"} );
frame2.text({x:1, y:2, text:"1,2", align:"right", color:"red", background:"cyan"} );
frame2.lower_left_axes({min_x:-1, min_y:0, max_x:1, 
                         max_y:2, x_anchor:0, y_anchor:1, max_tick_count:5, color:"green"})
"""
    )

def py_arrow_example():
    return python_example(
"""
### Drawing arrows

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

def js_arrow_example():
    return js_example(
"""
### Drawing arrows

The `arrow` method draws an arrow between a head position and a tail position.
""",
'''
    element.arrow({
        head_length:30,
        x1:50, y1:10,   // The tail end point of the line
        x2:320, y2:70,  // The head end point of the line
        color:"red",   // Optional color (default: "black")
        lineWidth:4,    // Optional line width
        lineDash:[2,2], // Optional line dash pattern
        head_angle:45,  // Optional head segment angle in degrees (default 45)
        head_offset:10,  // Optional offset of head from endpoint
        symmetric:true, // If true draw two arrow head segments (default False)
    });
''')

def py_double_arrow_example():
    return python_example(
"""
### Drawing double arrows

The `double_arrow` method draws an arrow between a head position and a tail position
with head marks at both ends.
""",
'''
    widget.double_arrow(
        head_length=30,
        x1=50, y1=10,   # The tail end point of the line
        x2=320, y2=70,  # The head end point of the line
        color="red",   # Optional color (default: "black")
        back_color="blue",  # Optional color of back arrow
        lineWidth=4,    # Optional line width
        lineDash=[2,2], # Optional line dash pattern
        head_angle=45,  # Optional head segment angle in degrees (default 45)
        back_angle=90,   # Optional back head segment angle
        head_offset=10,  # Optional offset of head from endpoint
        back_offset=0,   # Optional, offset of back pointing head mark
        symmetric=False, # If true draw two arrow head segments (default False)
        line_offset=5,  # offset of back arrow from forward arros
    )
''')

def js_double_arrow_example():
    return js_example(
"""
### Drawing double arrows

The `double_arrow` method draws an arrow between a head position and a tail position
with head marks at both ends.
""",
'''
    element.double_arrow({
        head_length:30,
        x1:50, y1:10,   // The tail end point of the line
        x2:320, y2:70,  // The head end point of the line
        color:"red",   // Optional color (default: "black")
        back_color:"blue",  // Optional color of back arrow
        lineWidth:4,    // Optional line width
        lineDash:[2,2], // Optional line dash pattern
        head_angle:45,  // Optional head segment angle in degrees (default 45)
        back_angle:90,   // Optional back head segment angle
        head_offset:10,  // Optional offset of head from endpoint
        back_offset:0,   // Optional, offset of back pointing head mark
        symmetric:false, // If true draw two arrow head segments (default False)
        line_offset:5,  // offset of back arrow from forward arros
    });
''')

def py_event_example():
    return python_example(
"""
### Attaching event callbacks

The `object.on(etype, callback)`
attaches a `callback` to be called when the object
recieves an event of type `etype`.
""",
'''
    # this circle cannot be mutated and does not respond to events because it is not named.
    widget.circle(x=0, y=0, r=100, color="#e99")

    # this text is named and can be mutated and can respond to events
    txt1 = widget.text(x=0, y=0, text="Hello World", degrees=45, name=True,
            font= "40pt Arial", color="#ee3", background="#9e9", align="center", valign="center")

    # add a click event bound to the txt which transitions the text rotation
    def on_click(*ignored):
        txt1.transition(text="That tickles", degrees=720, color="#f90", background="#009", seconds_duration=5)
        
    txt1.on("click", on_click)
''')

def py_line_example():
    return python_example(
"""
### Drawing lines

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

def js_line_example():
    return js_example(
"""
### Drawing lines

The `line` method draws a line segment between two end points.
""",
'''
    element.line({
        x1:50, y1:10,   // One end point of the line
        x2:320, y2:100,  // The other end point of the line
        color:"cyan",   // Optional color (default: "black")
        lineWidth:4,    // Optional line width
        lineDash:[5,2,1], // Optional line dash pattern
    })
''')

def py_polyline_example():
    return python_example(
"""
### Drawing polylines

The `polyline` method draws sequence of connected line segments.
""",
'''
    points = [(50,20), (40, 60), (140, 111), (300,4), (100,70)]
    widget.polyline(
        points=points, # The vertices of the polyline path
        color="green",   # Optional color (default: "black")
        lineWidth=3,    # Optional line width
        lineDash=[5,5], # Optional line dash pattern
    )
''')

def js_polyline_example():
    return js_example(
"""
### Drawing polylines

The `polygon` method with `fill:false` and `close:false` draws sequence of connected line segments.
""",
'''
    var points = [[50,20], [40, 60], [140, 111], [300,4], [100,70]];
    element.polygon({
        points:points, // The vertices of the polyline path
        color:"green",   // Optional color (default: "black")
        lineWidth:3,    // Optional line width
        lineDash:[5,5], // Optional line dash pattern
        fill:false,
        close:false,
    });
''')

def py_polygon_example():
    return python_example(
"""
### Drawing polygons

The `polygon` method draws closed sequence of connected line segments.
""",
'''
    points = [(50,20), (40, 60), (140, 111), (300,4), (100,70)]
    widget.polygon(
        points=points, # The vertices of the polyline path
        color="green",   # Optional color (default: "black")
        lineWidth=3,    # Optional line width
        lineDash=[5,5], # Optional line dash pattern
        fill=False,     # Optional, if True (default) fill interior
    )
''')

def js_polygon_example():
    return js_example(
"""
### Drawing polygons

The `polygon` method (with the default of `close:true`) draws closed sequence of connected line segments.
""",
'''
    var points = [[50,20], [40, 60], [140, 111], [300,4], [100,70]];
    element.polygon({
        points:points, // The vertices of the polyline path
        color:"green",   // Optional color (default: "black")
        lineWidth:3,    // Optional line width
        lineDash:[5,5], // Optional line dash pattern
        fill:false,
        // close:true,  // default value
    });
''')


def js_circle_example():
    return js_example(
"""
### Drawing circles with canvas relative radius

The `circle` method draws a circle sized relative to the canvas
coordinate system.  Circles on two frames with the same radius
will have the same size.
""",
'''   
    // map (10,10), (100,100) to (-3,0),(3,6) in the frame
    frame = element.frame_region(
        10, 10, 100, 100,
        -3, 0, 3, 6,
    )
    // Draw a circle positioned relative to the frame and sized relative to the canvas.
    frame.circle({
        x:4,
        y:2.5,
        r:20,  // radius "r" is in canvas coordinates, not frame coordinates
        color:"blue",
        fill:false,
        lineWidth:5,
        lineDash:[5,5],
    })
    frame.lower_left_axes({max_tick_count:5, color:"green"});
''')

def py_circle_example():
    return python_example(
"""
### Drawing circles with canvas relative radius

The `circle` method draws a circle sized relative to the canvas
coordinate system.  Circles on two frames with the same radius
will have the same size.
""",
'''   
    frame = widget.frame_region(
        minx=10, miny=10, maxx=100, maxy=100,
        frame_minx=-3, frame_miny=0, frame_maxx=3, frame_maxy=6,
    )
    # Draw a circle positioned relative to the frame and sized relative to the canvas.
    frame.circle(
        x=4,
        y=2.5,
        r=20,  # radius "r" is in canvas coordinates, not frame coordinates
        color="blue",
        fill=False,
        lineWidth=5,
        lineDash=[5,5],
    )
''')

def js_frame_circle_example():
    return js_example(
"""
### Drawing circles with frame relative radius

The `frame_circle` method draws a circle sized relative to the current reference frame
coordinate system.  Frame circles on two frames with the same radius
may have different sizes if the scaling differs between the frames.
""",
'''   
    frame = element.frame_region(
        10, 10, 100, 100,
        -3, 0, 3, 6,
    )
    // Draw a circle positioned and sized relative to the frame.
    frame.frame_circle({
        x:4,
        y:2.5,
        r:3,  // radius "r" is in frame coordinates
        color:"blue",
        fill:true,
    });
    frame.lower_left_axes({max_tick_count:5, color:"green"});
''')

def py_frame_circle_example():
    return python_example(
"""
### Drawing circles with frame relative radius

The `frame_circle` method draws a circle sized relative to the current reference frame
coordinate system.  Frame circles on two frames with the same radius
may have different sizes if the scaling differs between the frames.
""",
'''   
    frame = widget.frame_region(
        minx=10, miny=10, maxx=100, maxy=100,
        frame_minx=-3, frame_miny=0, frame_maxx=3, frame_maxy=6,
    )
    # Draw a circle positioned and sized relative to the frame.
    frame.frame_circle(
        x=4,
        y=2.5,
        r=3,  # radius "r" is in frame coordinates
        color="blue",
        fill=True,
    )
''')

def py_star_example():
    return python_example(
"""
### Drawing stars

The `star` method draws a star on the canvas.
""",
'''   
    # Draw a star (always positioned and sized relative to the frame)
    widget.star(
        x=40, y=25, radius=30,
        points=5,   # optional number of points
        point_factor=2.1,  # optional scale factor for outer radius
        color="magenta",
        fill=False,
        lineWidth=5,
        lineDash=[5,5],
    )
''')

def js_star_example():
    return js_example(
"""
### Drawing stars

The `star` method draws a star on the canvas.
""",
'''   
    // Draw a star (always positioned and sized relative to the frame)
    element.star({
        x:40, y:25, radius:30,
        points:5,   // optional number of points
        point_factor:2.1,  // optional scale factor for outer radius
        color:"magenta",
        fill:false,
        lineWidth:5,
        lineDash:[5,5],
    })
''')

def py_rect_example():
    return python_example(
"""
### Drawing rectangles with canvas relative size

The `rect` method draws a rectangle sized relative to the canvas
coordinate system.  `rect`s on two frames with the same width and height
will have the same size.
""",
''' 
    frame = widget.frame_region(
        minx=10, miny=10, maxx=100, maxy=100,
        frame_minx=-3, frame_miny=0, frame_maxx=3, frame_maxy=6,
    )

    # Draw a rectangle positioned and sized relative to the frame.
    (x,y) = (4, 2.5)
    frame.rect(
        x=x, y=y,  # rectangle position relative to the frame
        w=50, h=40,  # width and height relative to the canvas
        dx=-10, dy=-10,  # offset of lower left corner from (x,y) relative to the canvas
        color="green",
        degrees=10,  # optional rotation in degrees
        fill=False,
        lineWidth=5,
        lineDash=[5,5],
    )
    # Draw a reference point at (x, y)
    frame.circle(x, y, 5, "red")
    frame.lower_left_axes(color="pink")
''')

def js_rect_example():
    return js_example(
"""
### Drawing rectangles with canvas relative size

The `rect` method draws a rectangle sized relative to the canvas
coordinate system.  `rect`s on two frames with the same width and height
will have the same size.
""",
''' 
    frame = element.frame_region(
        10, 10, 100, 100,
        -3, 0, 3, 6,
    );

    // Draw a rectangle positioned and sized relative to the frame.
    var x = 4;
    var y = 2.5;
    frame.rect({
        x:x, y:y,  // rectangle position relative to the frame
        w:50, h:40,  // width and height relative to the canvas
        dx:-10, dy:-10,  // offset of lower left corner from (x,y) relative to the canvas
        color:"green",
        degrees:10,  // optional rotation in degrees
        fill:false,
        lineWidth:5,
        lineDash:[5,5],
    });
    // Draw a reference point at (x, y)
    frame.circle({x:x, y:y, r:5, color:"red"});
    frame.lower_left_axes({color:"pink", max_tick_count:5})
''')

def py_canvas_rect_example():
    return python_example(
"""
### Drawing rectangles with frame relative size

The `frame_rect` method draws a rectangle sized relative to the current reference frame
coordinate system.  `frame_rect`s on two frames with the same width and height
may have the different sizes.
""",
'''    
    frame = widget.frame_region(
        minx=10, miny=10, maxx=100, maxy=100,
        frame_minx=-3, frame_miny=0, frame_maxx=3, frame_maxy=6,
    )
    # Draw a rectangle positioned and sized relative to the frame.
    (x,y) = (4, 2.5)
    frame.frame_rect(
        x=x, y=y,  # rectangle position
        w=5, h=4,  # width and height relative to frame
        dx=-1, dy=-1,  # offset of lower left corner from (x,y) relative to frame
        color="green",
        fill=False,
        degrees=10,  # optional rotation in degrees
        lineWidth=5,
        lineDash=[5,5],
    )
    # Draw a reference point at (x, y)
    frame.circle(x, y, 5, "red")
    frame.lower_left_axes(color="pink")
''')

def js_canvas_rect_example():
    return js_example(
"""
### Drawing rectangles with frame relative size

The `frame_rect` method draws a rectangle sized relative to the current reference frame
coordinate system.  `frame_rect`s on two frames with the same width and height
may have the different sizes.
""",
'''  
    frame = element.frame_region(
        10, 10, 100, 100,
        -3, 0, 3, 6,
    );
    // Draw a rectangle positioned and sized relative to the frame.
    var x = 4;
    var y = 2.5;
    frame.frame_rect({
        x:x, y:y,  // rectangle position
        w:5, h:4,  // width and height relative to frame
        dx:-1, dy:-1,  // offset of lower left corner from (x,y) relative to frame
        color:"green",
        fill:false,
        degrees:10,  // optional rotation in degrees
        lineWidth:5,
        lineDash:[5,5],
    })
    // Draw a reference point at (x, y)
    frame.circle({x:x, y:y, r:5, color:"red"});
    frame.lower_left_axes({color:"pink", max_tick_count:5})
''')


def py_text_example():
    return python_example(
"""
### Drawing text

The `text` method draws a text screen on the canvas.
The position of the text is determined by the current reference frame
but the text font parameters are relative to the shared canvas coordinate space.
""",
'''   
    (x, y) = (50,20)
    widget.text(
        x=x, y=y, 
        text="We the people",
        color="white",   # Optional color (default: "black")
        font="italic 52px Courier",   # optional
        background="#a00",  # optional
        degrees=-15,  # optional rotation in degrees
        align="center", # or "left" or "right", optional
        valign="center",  # or "bottom", optional
    )
    # Draw a reference point at (x, y)
    widget.circle(x, y, 5, "magenta")
''')

def js_text_example():
    return js_example(
"""
### Drawing text

The `text` method draws a text screen on the canvas.
The position of the text is determined by the current reference frame
but the text font parameters are relative to the shared canvas coordinate space.
""",
'''   
    var x = 240;
    var y = 30;
    element.text({
        x:x, y:y, 
        text:"We the people",
        color:"white",   // Optional color (default: "black")
        font:"italic 52px Courier",   // optional
        background:"#a00",  // optional
        degrees:-15,  // optional rotation in degrees
        align:"center", // or "left" or "right", optional
        valign:"center",  // or "bottom", optional
    })
    // Draw a reference point at (x, y)
    element.circle({x:x, y:y, r:5, color:"red"});
''')

def js_axes_example():
    return js_example(
"""
### Drawing axes

The `left_axis`, `right_axis`, `bottom_axis`, `top_axis`, and `lower_left_axis` methods
draw axes on the canvas.
""",
'''   
    element.left_axis({
        min_value:10,
        max_value:80,
        axis_origin:{x:40, y:0},
        max_tick_count:3,
        color:"green",
        add_end_points:true
    })
    element.right_axis({
        min_value:10,
        max_value:80,
        axis_origin:{x:240, y:0},
        max_tick_count:7,
        color:"red"
    })
    element.bottom_axis({
        min_value:60,
        max_value:110,
        axis_origin:{x:0, y:0},
        max_tick_count:5,
        color:"blue"
    })
    element.top_axis({
        min_value:130,
        max_value:180,
        axis_origin:{x:0, y:0},
        max_tick_count:5,
        color:"orange"
    })
    element.lower_left_axes({
        min_x:50, 
        min_y:30, 
        max_x:210, 
        max_y:90, 
        x_anchor:130, 
        y_anchor:66, 
        max_tick_count:4, 
        color:"brown"
    });
''', axes=False)

def py_full_image_example():
    return python_example(
"""
### Drawing whole images

Before an image can be drawn on a canvas
the image must be loaded.  The `name_imagea_url` methodß
loads an image from a file or a remote resource.
After the image has been loaded and named the `named_image`
draws the loaded image.  If no subimage is specified
the whole image is drawn into the rectangular region.
A loaded image may be drawn any number of times.
""",
'''   
    # load the image from a remote resource
    mandrill_url = "http://sipi.usc.edu/database/preview/misc/4.2.03.png"
    widget.name_image_url(
        image_name="mandrill",
        url=mandrill_url,
    )
    # draw the named image (any number of times)
    (x, y) = (50,20)
    widget.named_image(  # Draw the *whole* image (don't specify the s* parameters)
        image_name="mandrill",
        x=x, y=y,  # rectangle position relative to the canvas
        w=150, h=140,  # width and height relative to the frame
        dx=-30, dy=-50,  # optional offset of lower left corner from (x,y) relative to the canvas
        degrees=10,  # optional rotation in degrees
    )
    # Draw a reference point at (x, y)
    widget.circle(x, y, 5, "magenta")
''')

def js_full_image_example():
    return js_example(
"""
### Drawing whole images

Before an image can be drawn on a canvas
the image must be loaded.  The `name_imagea_url` methodß
loads an image from a file or a remote resource.
After the image has been loaded and named the `named_image`
draws the loaded image.  If no subimage is specified
the whole image is drawn into the rectangular region.
A loaded image may be drawn any number of times.
""",
'''   
    // load the image from a remote resource
    var mandrill_url = "http://sipi.usc.edu/database/preview/misc/4.2.03.png";
    element.name_image_url("mandrill", mandrill_url);
    // draw the named image (any number of times)
    var x = 50;
    var y = 20;
    element.named_image({  // Draw the *whole* image (don't specify the s* parameters)
        image_name:"mandrill",
        x:x, y:y,  // rectangle position relative to the canvas
        w:150, h:140,  // width and height relative to the frame
        dx:-30, dy:-50,  // optional offset of lower left corner from (x,y) relative to the canvas
        degrees:10,  // optional rotation in degrees
    });
    // Draw a reference point at (x, y)
    element.circle({x:x, y:y, r:5, color:"magenta"});
''')


def py_part_image_example():
    return python_example(
"""
### Drawing parts of images

The `named_image`
draws part of a loaded image if the subimage parameters
sx, sy, sWidth, and sHeight are specified.
""",
''' 
    # load the image from a remote resource
    mandrill_url = "http://sipi.usc.edu/database/preview/misc/4.2.03.png"
    widget.name_image_url(
        image_name="mandrill",
        url=mandrill_url,
    )
    # draw the named image (any number of times)
    (x, y) = (50,20)
    widget.named_image(  # Draw just the eyes (by specifying the subimage)
        image_name="mandrill",
        x=x, y=y,  # rectangle position relative to the canvas
        w=150, h=40,  # width and height relative to the frame
        dx=-30, dy=-10,  # optional offset of lower left corner from (x,y) relative to the canvas
        degrees=10,  # optional rotation in degrees
        sx=30, sy=15, # subimage upper left corner in image coordinates
        sWidth=140, sHeight=20,  # subimage extent in image coordinates
    )
    # Draw a reference point at (x, y)
    widget.circle(x, y, 5, "magenta")
''')

def js_part_image_example():
    return js_example(
"""
### Drawing parts of images

The `named_image`
draws part of a loaded image if the subimage parameters
sx, sy, sWidth, and sHeight are specified.
""",
'''  
    // load the image from a remote resource
    var mandrill_url = "http://sipi.usc.edu/database/preview/misc/4.2.03.png";
    element.name_image_url("mandrill", mandrill_url);
    // draw the named image (any number of times)
    var x = 50;
    var y = 20;
    // draw the named image (any number of times)
    element.named_image({  // Draw the *whole* image (don't specify the s* parameters)
        image_name:"mandrill",
        x:x, y:y,  // rectangle position relative to the canvas
        w:150, h:140,  // width and height relative to the frame
        dx:-30, dy:-50,  // optional offset of lower left corner from (x,y) relative to the canvas
        degrees:10,  // optional rotation in degrees
        sx:30, sy:15, // subimage upper left corner in image coordinates
        sWidth:140, sHeight:20,  // subimage extent in image coordinates
    });
    // Draw a reference point at (x, y)
    element.circle({x:x, y:y, r:5, color:"magenta"});
''')

def py_bw_image_example():
    return python_example(
"""
### Drawing black and white images from arrays

The `name_image_array`
can load a black and white image from a
2 dimensional `numpy` array.  The numeric values in the
array should be in the range from 0 to 255.
""",
''' 
    # Make a "black and white" array.
    import numpy as np
    checkerboard = np.zeros((8,8))
    for i in range(8):
        for j in range(8):
            if (i + j) % 2 == 0:
                checkerboard[i,j] = 64 + 3*i*j
    # Load the image from the array.
    widget.name_image_array( 
        image_name="checkerboard",
        np_array=checkerboard,
    )
    # draw the named image (any number of times)
    (x, y) = (50,20)
    widget.named_image(  # Draw just the eyes (by specifying the subimage)
        image_name="checkerboard",
        x=x, y=y,  # rectangle position relative to the canvas
        w=150, h=140,  # width and height relative to the frame
        dx=-30, dy=-10,  # offset of lower left corner from (x,y) relative to the canvas
        degrees=10,  # optional rotation in degrees
    )
    # Draw a reference point at (x, y)
    widget.circle(x, y, 5, "magenta")
''')


def py_color_image_example():
    return python_example(
"""
### Drawing color images from arrays

The `name_image_array`
can load a color image from a
3 dimensional `numpy` array of shape "width by height by 3"
or "width by height by 4".  The values at `array[:,:,1:3]` represent
the red, green, and blue color values for the pixel and should be in the range 0 to 255.
If provided the values at `array[:,:,3]` represent the opacity of the
pixel and should be in the range 0 (transparent) to 1.0 (fully opaque).
""",
''' 
    # Make a "color" numpy array
    import numpy as np
    checkerboard = np.zeros((8,8,3))
    R = G = B = 255
    for i in range(8):
        for j in range(8):
            if (i + j) % 2 == 0:
                checkerboard[i,j] = (R, G, B)
                R = (G + 123) % 256
            else:
                checkerboard[i,j] = (G, R, R)
                G = (R + 201) % 256
    # Load the image from the array     
    widget.name_image_array(
        image_name="checkerboard",
        np_array=checkerboard,
    )
    # draw the named image (any number of times)
    (x, y) = (50,20)
    widget.named_image(  # Draw just the eyes (by specifying the subimage)
        image_name="checkerboard",
        x=x, y=y,  # rectangle position relative to the canvas
        w=150, h=140,  # width and height relative to the frame
        dx=-30, dy=-10,  # offset of lower left corner from (x,y) relative to the canvas
        degrees=-50,  # optional rotation in degrees
    )
    # Draw a reference point at (x, y)
    widget.circle(x, y, 10, "yellow")
''')

def html_hello_world():
    from IPython.display import display, Markdown
    txt = open("minimal.html").read()
    L = ["```HTML", txt, "```"]
    md = "\n".join(L)
    display(Markdown(md))