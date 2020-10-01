"""
A Helper for making boxes around words with arrows between them.

'''
And they was using up all kinds of cop equipment that they had hanging around the police officer's station; 
they was taking plaster tire tracks, foot prints, dog smelling prints, and they took twenty-seven 
eight-by-ten color glossy photographs with circles, and arrows and a paragraph on the back of each one 
explaining what each one was, to be used as evidence against us.
'''

https://genius.com/Arlo-guthrie-alices-restaurant-massacree-lyrics
"""

import numpy as np

class BoxMaker:
    "Template for making a box."

    def __init__(self, **defaults):
        self.defaults = defaults

    def box(self, **overrides):
        "Make a standard box with overridden parameters"
        arguments = self.defaults.copy()
        arguments.update(overrides)
        return Box(**arguments)

    def variant(self, **changes):
        "Make a modified box template."
        arguments = self.defaults.copy()
        arguments.update(changes)
        return BoxMaker(**arguments)


def point(x, y):
    return np.array([x,y], dtype=np.float)

class Box:

    def __init__(
        self, 
        on_frame, 
        center_xy, 
        width_height,
        text = None,
        text_lines = (),
        color="black",  # font color
        line_color="black",
        background="#aaf",
        font=None,  # if None, use default font
        line_offset=None,   # if None divide by available space
        lineWidth=1,
        draw_now=True,
        ):
        self.on_frame = on_frame
        self.center_xy = point(*center_xy)
        self.width_height = point(*width_height)
        if text is not None:
            assert not text_lines, "Cannot format both text and text_lines: " + repr((text, text_lines))
            text_lines = [text]
        self.text_lines = list(text_lines)
        self.color = color
        self.line_color = line_color
        self.lineWidth = lineWidth
        self.background = background
        self.line_offset = line_offset
        self.font = font
        self.geometry()
        if draw_now:
            self.draw()

    def geometry(self):
        center = self.center_xy
        (w2, h2) = 0.5 * self.width_height
        offsets = {
            "C": point(0, 0),
            "L": point(-w2, 0),
            "R": point(+w2, 0),
            "T": point(0, +h2),
            "B": point(0, -h2),
        }
        anchors = {}
        for x_anchor in "LCR":
            for y_anchor in "TCB":
                name = x_anchor + y_anchor
                anchors[name] = center + offsets[x_anchor] + offsets[y_anchor]
                # convenience
                anchors[y_anchor + x_anchor] = anchors[name]
        # for example upper right corner at anchors["RT"]
        self.offests = offsets
        self.anchors = anchors

    def draw(self):
        self.draw_background()
        self.draw_foreground()

    def draw_background(self):
        frame = self.on_frame
        anchors = self.anchors
        (x, y) = anchors["LB"]
        (w, h) = self.width_height
        frame.frame_rect(x, y, w, h, color=self.background)

    def draw_foreground(self):
        frame = self.on_frame
        text_lines = self.text_lines
        if not text_lines:
            return # no foreground to draw
        nlines = len(text_lines)
        (w, h) = self.width_height
        line_offset = self.line_offset
        (xc, yc) = self.anchors["CC"]
        if not line_offset:
            line_offset = h / nlines
        y = yc + 0.5 * (nlines - 1) * line_offset
        for i in range(nlines):
            yi = y - i * line_offset
            ti = text_lines[i]
            frame.text(
                xc, yi, text=ti, color=self.color, background=self.background,
                valign="center", align="center", font=self.font)

    def point_to(self, other, anchor, other_anchor, color=None, head_length=None, delta=1.0, lineWidth=None):
        color = color or self.line_color
        lineWidth = lineWidth or self.lineWidth
        frame = self.on_frame
        [p0, p1, p2] = self.anchor_reference_points(anchor, delta)
        [q0, q1, q2] = other.anchor_reference_points(other_anchor, delta)
        m = 0.5 * (p2 + q2)
        p12 = 0.5 * (p2 + p1)
        q12 = 0.5 * (q1 + q1)
        p2m = 0.5 * (p2 + m)
        q2m = 0.5 * (q2 + m)
        def aslist(*x):
            return map(list, x)
        path = aslist(
            p0,
            p1,
            aslist(p12, p2m, m),
            aslist(q2m, q2, q12),
            q1,
        )
        frame.polygon(path, color=color, fill=False, close=False, lineWidth=lineWidth)
        (x1, y1) = q1
        (x2, y2) = q0
        if head_length:
            frame.arrow(x1, y1, x2, y2, color=color, head_length=head_length, symmetric=True, lineWidth=lineWidth)
        else:
            frame.line(x1, y1, x2, y2, color=color, lineWidth=lineWidth)

    def anchor_reference_points(self, anchor_name, delta=1.0):
        anchors = self.anchors
        center = self.center_xy
        anchor_pt = anchors[anchor_name]
        vector = (anchor_pt - center) * delta
        p1 = anchor_pt + vector
        p2 = p1 + vector
        return [anchor_pt, p1, p2]

def example():
    from jp_doodle import dual_canvas
    demo = dual_canvas.DualCanvasWidget(width=320, height=220)
    M = BoxMaker(
        on_frame=demo,
        color="blue",
        background="#faa",
        width_height=(50,50),
        line_color="green",
        lineWidth=2,
    )
    B1 = M.box(center_xy=(100, 100), text_lines="hello world".split())
    B2 = M.box(center_xy=(200, 150), text_lines="good bye".split())
    B1.point_to(B2, "TR", "LC", head_length=10, delta=0.2)
    B2.point_to(B2, "BR", "RC", head_length=10)
    B2.point_to(B1, "BL", "BR", head_length=10, delta=0.2)
    B2.point_to(B1, "TC", "TC", head_length=10)
    demo.fit()
    demo.B1 = B1
    demo.B2 = B2
    return demo
