"""
Logic to support exporting figures drawn on canvases to SVG.
"""

import math

TOP_LEVEL_SVG_TEMPLATE = """
<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
  <g transform="scale({x_scale} {y_scale}) translate({x_translate} {y_translate})">{draw_operations}</g>
</svg>
"""

VERBOSE = False

class SVG_Interpreter:

    """
    Convert dumped canvas draw operation to equivalent SVG.
    """

    def __init__(
        self, 
        shape_name, 
        width, 
        height, 
        lineWidth, 
        fillColor, 
        strokeStyle, 
        translate_scale, 
        font, 
        y_up,
        style,
        **other_arguments_ignored):
        (
        self.shape_name, 
        self.width, 
        self.height, 
        self.lineWidth, 
        self.fillColor, 
        self.strokeStyle, 
        self.translate_scale, 
        self.font, 
        self.y_up,
        self.style) = (
            shape_name, 
            width, 
            height, 
            lineWidth, 
            fillColor, 
            strokeStyle, 
            translate_scale, 
            font, 
            y_up,
            style,
            )
        self.draw_list = []

    def to_svg_text(self):
        D = {}
        D["width"] = self.width
        D["height"] = self.height
        D["x_translate"] = self.translate_scale["x"]
        D["y_translate"] = self.translate_scale["y"]
        D["x_scale"] = self.translate_scale["w"]
        D["y_scale"] = self.translate_scale["h"]
        draw_tags = [""] + self.draw_list
        draw_tags.append("")
        separator = "\n\t"
        D["draw_operations"] = separator.join(draw_tags)
        return TOP_LEVEL_SVG_TEMPLATE.format(**D)

    def canvas_to_svg_axis(self, x, y):
        if self.y_up:
            # y = (self.translate_scale["model_height"]-2*self.translate_scale["y"])-y
            y = self.translate_scale["model_intercept"] - y
        return (x, y)

    def circle(self, fcenter, r, color, **other_arguments_ignored):
        (x, y) = self.canvas_to_svg_axis(fcenter["x"], fcenter["y"])
        self.add_draw_tag(
            tag_name="circle",
            cx=x, cy=y,
            r=r,
            fill=color,
        )

    def text(
        self, text, coords, 
        align=None, valign=None, font=None, color=None, rotate_radians=None, degrees=None, background = None, 
        **other_arguments_ignored):
        x = coords["x"]
        y = coords["y"]
        rect_x, rect_y = x, y
        (x, y) = self.canvas_to_svg_axis(x, y)
        text_anchor = "start"
        baseline = None
        # Don't worry about "background" for now....
        # support attributes that don't have valid python variable names...
        atts = {}
        if degrees:
            atts["transform"] = "rotate(%s, %s, %s)" % (-degrees, x, y)
        atts['x'] = x
        atts['y'] = y
        if valign == "center":
            atts["alignment-baseline"] = "middle"
        if align == "center":
            atts["text-anchor"] = "middle"
        if align == "right":
            atts["text-anchor"] = "end"
            """
        if background:
            bg_info = other_arguments_ignored['background_rect']
            bg_w = bg_info['w']
            bg_h = bg_info['h']
            bg_x = bg_info['dx']
            bg_y = bg_info['dy']
            bg_color = background
            # if align == "center":
            #     bg_x += bg_w/2.5
            #     bg_y -= bg_h/2
            #self.rect(rect_x + bg_x, rect_y + bg_y, bg_w, bg_h, bg_color, degrees)
            self.rect(x=rect_x, y=rect_y, coords=coords, rotate_radians=rotate_radians, w=bg_w, h=bg_h, color=bg_color, degrees=degrees, dx=bg_x, dy=bg_y)
            """

        if font:
            if 'pt' in font:
                font = font.split('pt ')
                num = font[0]
                if ' ' in font[0]:
                    num = font[0].split(' ')[-1]
                atts["font-size"] = int(num)
            # should parse out the font-family font-size font-style
                atts["font-family"] = font[1]
            if 'px' in font:
                font = font.split('px ')
                num = font[0]
                if ' ' in font[0]:
                    num = font[0].split(' ')[-1]
                atts["font-size"] = int(num)
                atts["font-family"] = font[1]

        self.add_draw_tag(
            tag_name="text",
            body=text,
            fill=color,
            **atts
        )
    
    def line(self, fp1, fp2, color, lineWidth, **other_arguments_ignored):
        (x1, y1) = self.canvas_to_svg_axis(fp1["x"], fp1["y"])
        (x2, y2) = self.canvas_to_svg_axis(fp2["x"], fp2["y"])
        style = ""
        for attr in "x1 x2 y1 y2 fill style stroke".split():
            if other_arguments_ignored.get(attr):
                del other_arguments_ignored[attr]
        if lineWidth:
            style += "stroke-width:" + str(lineWidth)
        self.add_draw_tag(
            tag_name="line",
            x1=x1, 
            y1=y1,
            x2=x2, 
            y2=y2,
            fill=color,
            stroke = color,
            style = style,
            **other_arguments_ignored
        )
    
    def rect(self, coords, w, h, color, rotate_radians=None, degrees=None, lineWidth=1, fill=True, dx=0, dy=0, **other_arguments_ignored):
        x = coords["x"]
        y = coords["y"]
        if w < 0:
            x = x + w
            w = abs(w)
        if h < 0:
            y = y + h
            h = abs(h)
        (x, y) = self.canvas_to_svg_axis(x, y)
        atts = {}
        if fill:
            atts['fill'] = color
        else:
            atts['fill'] = 'transparent'

        # rotation is not working correctly
        # svg rect element does not support negative coordinates
        transform = ""
        if rotate_radians:
            ndegrees = rotate_radians * (180.0 / math.pi)
            transform = "rotate(%s, %s, %s)" %(ndegrees, x, y)
        #if degrees:
        #    transform = "rotate(%s, %s, %s)" %(-degrees, x, y)
        #elif dx or dy:
        #    transform = transform + " translate(%s %s)" % (dx, dy)
        if transform:
            atts['transform'] = transform
        atts['x'] = x + dx
        atts['y'] = y - h - dy
        style = ""
        if lineWidth:
            style += "stroke-width:" + str(lineWidth)
        self.add_draw_tag(
            tag_name="rect",
            width=w, 
            height=h,
            stroke=color,
            style = style,
            **atts
        )

    def polygon(self, points, fpoints, color, fill=True, close = True, lineWidth=1, **other_arguments_ignored):
        points = fpoints
        points = [list(self.canvas_to_svg_axis(ptx["x"], ptx["y"])) for ptx in points]
        points = ' '.join([",".join([str(ptx[0]),str(ptx[1])]) for ptx in points])
        atts = {}
        if fill:
            atts['fill'] = color
        else:
            atts['fill'] = 'transparent'
        tag_name = "polygon"
        if not close:
            tag_name = "polyline"
        style = 'stroke-width:'+str(lineWidth)
        self.add_draw_tag(
            tag_name=tag_name,
            points = points,
            stroke=color,
            style = style,
            **atts
        )

    def image(self, x, y, w, h, image_name, **other_arguments_ignored):
        # href is hard coded: image_name must be the file path
        (x, y) = self.canvas_to_svg_axis(x, y)
        self.add_draw_tag(
            tag_name="image",
            href = image_name,
            x = x,
            y = y-h,
            height = h,
            width = w
        )

    def add_draw_tag(self, tag_name, body=None, **attributes):
        accum = []
        add = accum.append
        add("<" + tag_name)
        for (a, v) in attributes.items():
            add('%s="%s"' % (a, v))
        if body:
            add(">%s</%s>" % (body,tag_name))
        else:
            add("/>")
        tag = " ".join(accum)
        self.draw_list.append(tag)

    def comment(self, thing):
        cmt = "<!-- %s -->" % str(thing)
        self.draw_list.append(cmt)

def interpret_dump(canvas_dump):
    svg_interp = None
    for description in canvas_dump:
        #if VERBOSE:
        #    print("description:", description)
        #    die
        shape_name = description["shape_name"]
        if shape_name == "canvas":
            assert svg_interp is None, "too many canvases"
            svg_interp = SVG_Interpreter(**description)
        else:
            assert svg_interp is not None, "Canvas description must come before draw commands."
            method = getattr(svg_interp, shape_name, None)
            if shape_name == "named_image":
                method = svg_interp.image
            if method is None:
                print ("SVG draw method not yet defined: " + repr(shape_name))
            else:
                method(**description)
        if VERBOSE:
            svg_interp.comment(description)
    return svg_interp

def interpret(canvas):
    canvas_dump = canvas.get_raw_draw_information()
    return interpret_dump(canvas_dump)

def canvas_as_svg_text(canvas):
    interp = interpret(canvas)
    return interp.to_svg_text()

def display_as_svg(canvas):
    from IPython.display import HTML, display
    svg = canvas_as_svg_text(canvas)
    display(HTML(svg))
