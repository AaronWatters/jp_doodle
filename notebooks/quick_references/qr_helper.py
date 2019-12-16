from jp_doodle.dual_canvas import swatch
from jp_doodle.auto_capture import embed_hidden, PythonExample, JavascriptExample, Swatch3dExample
import inspect

# widen the notebook
from jp_doodle import data_tables
data_tables.widen_notebook()

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

def python_example(markdown, code, width=320, height=120, embeddable=True):
    file_prefix = inspect.stack()[1][3]
    filename = file_prefix + ".png"
    EG = PythonExample(markdown, code, filename, width, height, embeddable=embeddable)
    EG.embed_prologue()
    EG.embed_code()
    EG.embed_widget(DO_EMBEDDINGS)

def swatch3d_example(markdown, code, pixels=300, model_height=1.0, embeddable=True):
    file_prefix = inspect.stack()[1][3]
    filename = file_prefix + ".png"
    EG = Swatch3dExample(markdown, code, filename, pixels=pixels, model_height=model_height, embeddable=embeddable)
    EG.embed_prologue()
    EG.embed_code()
    EG.embed_widget(DO_EMBEDDINGS)

def js_example(markdown, code, width=320, height=120, axes=True, embeddable=True):
    file_prefix = inspect.stack()[1][3]
    filename = file_prefix + ".png"
    EG = JavascriptExample(markdown, code, filename, width, height, axes=axes, embeddable=embeddable)
    EG.embed_prologue()
    EG.embed_code()
    EG.embed_widget(DO_EMBEDDINGS)

def swatch_3d_lines():
    return swatch3d_example(
"""
### Draw lines in 3d

The `line` method draws a line on a swatch.
""",
"""
    import math
    for i in range(10):
        x = (i - 5) * 0.05
        s = math.sin(x * 3)
        c = math.cos(x * 2)

        swatch.line(
            location1=(1,c,x),   # start point
            location2=(-c,s,x*0.5),   # end point
            color="cyan",        # optional color
            lineWidth=3,         # optional line width
            lineDash=[1,2,1],    # Optional line dash pattern
        )
"""
    )
    
def swatch_3d_circles():
    return swatch3d_example(
"""
### Drawing circles with canvas relative radius

The `circle` method draws a circle sized relative to the canvas
coordinate system.  Circles on two frames with the same radius
will have the same size.
""",
"""
    import math
    for i in range(20):
        x = (i - 10) * 0.15
        s = math.sin(x * 3)
        c = math.cos(x * 2)

        swatch.circle(
            location=(-c,s,x*0.5),   # center
            r=5, # radius in canvas (pixel) sizing
            color="#448",        # optional color
            lineWidth=2,         # optional line width
            lineDash=[1,1],    # Optional line dash pattern
            fill=False,
        )
"""
    )
    
def swatch_3d_framecircles():
    return swatch3d_example(
"""
### Drawing circles with frame relative radius

The `frame_circle` method draws a circle sized relative to the frame
coordinate system.  Circles on two frames with the same radius
may have different size.
""",
"""
    import math
    for i in range(20):
        x = (i - 10) * 0.15
        s = math.sin(x * 3)
        c = math.cos(x * 2)

        swatch.frame_circle(
            location=(-c,s,x*0.5),   # center
            r=abs(c * 0.2), # radius in canvas (pixel) sizing
            color="rgba(0,200,200,0.2)",        # optional color
        )
"""
    )
    
def swatch_3d_polyline():
    return swatch3d_example(
"""
### Draw polygons in 3d

The `polyline` method draws an connected sequence of line segments on a swatch.
""",
"""
    points = [
        (1, 1, 1),
        (1, -1, 1),
        (-1, 1, 1),
        (1, 1, -1),
        (0, 0, 0)
    ]

    swatch.polyline(
        locations=points,   # end point
        color="magenta",        # optional color
        lineWidth=3,         # optional line width
        lineDash=[1,2,1],    # Optional line dash pattern
    )
"""
    )

def swatch_3d_polygon():
    return swatch3d_example(
"""
### Draw polygons in 3d

The `polygon` method draws an connected and closed sequence of line segments on a swatch.
If the "polygon" is filled the 2 dimensional figure defined by the projection of the
projected 3 dimensional points will be filled with a solid color.

**Note:** A filled "polygon" where the points do not lie on the same plane
will not behave like a true 3 dimensional polygon.
""",
"""
    points = [
        (1, 1, 1),
        (1, -1, 1),
        (-1, 1, 1),
        (1, 1, -1),
        (0, 0, 0)
    ]

    swatch.polygon(
        locations=points,   # end point
        color="magenta",        # optional color
        lineWidth=3,         # optional line width
        lineDash=[1,2,1],    # Optional line dash pattern
        fill=False,  # Just the outline line segments
    )
    swatch.polygon(
        locations=points,   # end point
        color="rgba(100,200,255,0.3)",        # translucent color
        # fill=True (the default)
    )
"""
    )

def swatch_3d_arrows():
    return swatch3d_example(
"""
### Draw arrows in 3d

The `arrow` method draws an arrow on a swatch.
""",
"""
    import math
    for i in range(10):
        x = (i - 5) * 0.05
        s = math.sin(x * 3)
        c = math.cos(x * 2)

        swatch.arrow(
            location1=(1,c,x),   # start point
            location2=(-c,s,x*0.5),   # end point
            color="magenta",        # optional color
            lineWidth=3,         # optional line width
            lineDash=[1,2,1],    # Optional line dash pattern
            head_length=0.1,
            head_angle=45,  # Optional head segment angle in degrees (default 45)
            head_offset=0.1,  # Optional offset of head from endpoint
            symmetric=True, # If true draw two arrow head segments (default False)
        )
"""
    )

def swatch_3d_double_arrows():
    return swatch3d_example(
"""
### Draw double arrows in 3d

The `double_arrow` method draws an arrow on a swatch with heads on both ends.
""",
"""
    import math
    for i in range(-5,5,2):
        x = i * 0.05
        s = math.sin(x * 3)
        c = math.cos(x * 2)

        swatch.double_arrow(
            #location1=(1,c,x * 2 - s),   # start point
            location1=(1,c,c+s*2),   # start point
            location2=(-c,s,x*2.5),   # end point
            color="#e50",        # optional color
            lineWidth=3,         # optional line width
            lineDash=[1,2,1],    # Optional line dash pattern
            head_length=0.1,
            head_angle=45,  # Optional head segment angle in degrees (default 45)
            head_offset=0.1,  # Optional offset of head from endpoint
            symmetric=False, # If true draw two arrow head segments (default False)
            back_angle=90,
            back_offset=0,
        )
"""
    )

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

def js_lasso_example():
    return js_example(
"""
### Selecting named objects by surrounding them with a lasso

The 
```
element.do_lasso(callback, config, delete_after)
``` 
method allows the user to select named objects
by surrounding them with a graphical loop.  After the loop is complete the callback
receives a dictionary mapping the names of the selected objects to their descriptions.
The optional argument `config` is provides configuration parameters and the
optional boolean argument `delete_after` deletes the lasso polygon after selection
if `true`.
""",
"""
// draw some named objects on the canvas
for (var i=10; i<300; i+=40) {
    for (var j=10; j<100; j+=15) {
        var ijtext = i+","+j
        element.text({x:i, y:j, text:ijtext, name:ijtext, color:"red", background:"yellow"} );
    }
}

// Add a text area to display the result of the lasso operation:
var info = $("<div/>").appendTo(element);
info.html("Mouse down and encircle elements to select them with the lasso.");

var lasso_callback = function(mapping) {
    var txt = "Lasso circled: ";
    for (var name in mapping) {
        txt += " (" + name + "),";
    }
    info.html(txt);
}

element.do_lasso(lasso_callback, {}, true);
"""
    )

def js_mouse_tracking_example():
    return js_example(
"""
### Mouse tracking

The following code tracks mouse moves over the whole canvas
and moves an external HTML DIV and a canvas circle in coordination
with the pointer position.
""",
"""
// Mouse tracking DIV
let tooltip = $("<div>Move the mouse over the canvas.</div>").appendTo(element);
tooltip.css({background: "yellow", width:120});
// Mouse tracking circle
let circle = element.circle({name:true, x:10, y:10, r:13, color: "red"});
var event_handler = function(event) {
    var element_offset = element.visible_canvas.offset();
    var canvas_location = element.event_model_location(event);
    var pixel_offset = element.event_pixel_location(event);
    // move the tooltip near the mouse
    tooltip.offset({
        left: pixel_offset.x + element_offset.left + 5,
        top: pixel_offset.y + element_offset.top + 5,
    });
    // move the circle under the mouse.
    circle.change({x:canvas_location.x, y:canvas_location.y});
    // Report canvas position in the tooltip
    tooltip.html("x=" + Math.floor(canvas_location.x)
        + "<br> y=" + Math.floor(canvas_location.y));
};
element.on_canvas_event("mousemove", event_handler);
"""
    )

def js_event_callback():
    return js_example(
"""
### Displaying mouse move coordinates

The following widget contains a `rectangle` drawn on a `frame`.
The `model_location` coordinates for a `mousemove` over the rectangle
are reported in an appended `info_div` text area.  The `model_location`
gives coordinates for the reference frame associated with the object.
""",
"""
// Map pixel coords (10,10) and (400,100)
//  to frame coords (-1, 0) and (1, 2)
var frame = element.frame_region(
        10, 10, 400, 100,
        -1, 0, 1, 2);

// Create a named rectangle to receive events.
var rectangle = frame.frame_rect({x:-0.8, y:0.1, w:1.3, h:1.9, color:"cyan", name:true});

frame.lower_left_axes({min_x:-1, min_y:0, max_x:1, 
     max_y:2, x_anchor:0, y_anchor:1, max_tick_count:5, color:"blue"});

var info_div = $("<div/>").appendTo(element);
info_div.html("Please mouse over the cyan rectangle");

var mouse_over_handler = function(event) {
    var x = event.model_location.x;
    var y = event.model_location.y;
    info_div.html("x=" + x + "; y=" + y);
};

// Attach the event handler to the rectangle.
rectangle.on("mousemove", mouse_over_handler);
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

def swatch_3d_star_example():
    return swatch3d_example(
"""
### Drawing stars

The `star` method draws a star on the canvas.
""",
'''
    import math
    points = []
    for i in range(20):
        x = (i - 10) * 0.15
        s = math.sin(x * 3)
        c = math.cos(x * 2)
        p = (-c,s,x*0.5)
        w = 0.05 * (abs(c) + abs(s)) + 0.01
        color = "rgb" + repr((i*10, (i*70) % 244, 255-i*10))
        points.append(p)

        # Draw a star (always positioned and sized relative to the frame)
        swatch.star(
            location=p, 
            radius=w,
            points=5,   # optional number of points
            point_factor=2.1,  # optional scale factor for outer radius
            color=color,
            fill=True,
        )

    # Draw a reference polyline at rectangle reference points
    swatch.polyline(locations=points, color="red")
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

def swatch_3d_rect_example():
    return swatch3d_example(
"""
### Drawing rectangles with canvas relative size

The `rect` method draws a rectangle sized relative to the canvas (pixel)
coordinate system.  `rect`s on two frames with the same width and height
will have the same size.
""",
''' 
    import math
    points = []
    for i in range(20):
        x = (i - 10) * 0.15
        s = math.sin(x * 3)
        c = math.cos(x * 2)
        p = (-c,s,x*0.5)
        points.append(p)

        # Draw a rectangle positioned and sized relative to the canvas.
        swatch.rect(
            location=p,  # rectangle position relative to the frame
            w=20, h=10,  # width and height relative to the canvas
            dx=-10, dy=-5,  # offset of lower left corner from (x,y) relative to the canvas
            color="#379",
            degrees=10,  # optional rotation in degrees
            fill=False,
            lineWidth=2,
            lineDash=[2,2],
        )

    # Draw a reference polyline at rectangle reference points
    swatch.polyline(locations=points, color="pink")
''')

def swatch_3d_frame_rect_example():
    return swatch3d_example(
"""
### Drawing rectangles with frame relative size

The `frame_rect` method draws a rectangle sized relative to the frame
coordinate system.  `frame_rect`s on two frames with the same width and height
may have different size.
""",
''' 
    import math
    points = []
    for i in range(20):
        x = (i - 10) * 0.15
        s = math.sin(x * 3)
        c = math.cos(x * 2)
        p = (-c,s,x*0.5)
        w = 0.1 * (abs(c) + abs(s)) + 0.01
        color = "rgb" + repr((255-i*10, i*10, i*10))
        points.append(p)

        # Draw a rectangle positioned and sized relative to the frame.
        swatch.frame_rect(
            location=p,  # rectangle position relative to the frame
            w=w, h=0.3,  # width and height relative to the canvas
            dx=-0.5*w, dy=-0.15,  # offset of lower left corner from (x,y) relative to the canvas
            color=color,
            degrees=i*10,  # optional rotation in degrees
            fill=False,
            lineWidth=2,
            lineDash=[2,2],
        )

    # Draw a reference polyline at rectangle reference points
    swatch.polyline(locations=points, color="pink")
''')

def swatch_3d_text_example():
    return swatch3d_example(
"""
### Drawing text

The `text` method draws a text on the canvas.
""",
''' 
    import math
    points = []
    for i in range(0,20,3):
        x = (i - 10) * 0.15
        s = math.sin(x * 3)
        c = math.cos(x * 2)
        p = (-c,s,x*0.5)
        w = 0.1 * (abs(c) + abs(s)) + 0.01
        color = "rgb" + repr((255-i*10, i*10, i*10))
        points.append(p)
        txt = "%1.1f,%1.1f.%1.1f" % p

        # Draw a rectangle positioned and sized relative to the frame.
        swatch.text(
            location=p,
            text=txt,
            color="white",   # Optional color (default: "black")
            font="italic 10px Courier",   # optional
            background=color,  # optional
            degrees= 20,  # optional rotation in degrees
            align="left", # or "center" or "right", optional
            valign="center",  # or "bottom", optional
        )

    # Draw a reference polyline at rectangle reference points
    swatch.polyline(locations=points, color="pink")
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

def js_event_example():
    return js_example(
"""
### Attaching event callbacks

The `object.on(etype, callback)`
attaches a `callback` to be called when the object
recieves an event of type `etype`.
""",
'''   
    // this circle cannot be mutated and does not respond to events because it is not named.
    element.circle({x:0, y:0, r:100, color:"#e99"});

    // this text is named and can be mutated and can respond to events
    var txt1 = element.text({x:0, y:0, text:"Click me please", degrees:45, name:true,
               font:"40pt Arial", color:"#e3e", background:"#9e9", align:"center", valign:"center"});

    // add a click event bound to the txt which transitions the text rotation
    var on_click = function() {
        var seconds_duration = 5;
        txt1.transition({text:"That tickles", degrees:720, color:"#f90", background:"#009"}, seconds_duration);
    };

    txt1.on("click", on_click)
''')

def js_no_name_no_event_example():
    return js_example(
"""
### Unnamed objects are invisible to events

If an object is not named it will not respond to events
but a named object drawn undernieth the unnamed object may
receive the event.
A named object may also disable events by setting `events=False`
-- the resulting object can be changed or deleted but it will not respond to events.
```Javascript
widget.circle({x:0, y:0, r:100, color:"#e99", name:True, events:False});
```
Below the circle obscures the text but clicks in the
center of the circle are recieved by the text.
""",
'''   
    // this text is named and can be mutated and can respond to events
    var txt1 = element.text({x:0, y:0, text:"CLICK THE CENTER OF THE CIRCLE", degrees:25, name:true,
               font:"40pt Arial", color:"#e3e", background:"#9e9", align:"center", valign:"center"});

    // This circle cannot be mutated and does not respond to events because it is not named.
    // The txt1 undernieth the circle may respond to clicks on the circle.
    element.circle({x:0, y:0, r:70, color:"#e99"});

    // add a click event bound to the txt which transitions the text rotation
    var on_click = function() {
        var seconds_duration = 5;
        txt1.transition({text:"That tickles", degrees:720, color:"#f90", background:"#009"}, seconds_duration);
    };

    txt1.on("click", on_click)
''')

def js_event_top_only_example():
    return js_example(
"""
### Only the top named object responds to events

Only the top named object under an event receives the event even if
it is drawn using a transparent color.
Any object underneith the top object will not receive the event.
""",
'''   
    // this text is named and can be mutated and can respond to events
    var txt1 = element.text({x:0, y:0, text:"TRY TO CLICK THE CENTER OF THE CIRCLE", degrees:15, name:true,
               font:"40pt Arial", color:"#e3e", background:"#9e9", align:"center", valign:"center"});

    // This circle CAN be mutated and MAY respond to events because it is named.
    // The txt1 undernieth the circle will not respond to clicks on the circle.
    element.circle({x:0, y:0, r:70, color:"#e99", name:true});

    // add a click event bound to the txt which transitions the text rotation
    var on_click = function() {
        var seconds_duration = 5;
        txt1.transition({text:"That tickles", degrees:720, color:"#f90", background:"#009"}, seconds_duration);
    };

    txt1.on("click", on_click)
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
''', embeddable=False)

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
''', embeddable=False)


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
''', embeddable=False)

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
''', embeddable=False)

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