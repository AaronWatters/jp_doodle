
from jp_doodle import dual_canvas

def histogram(values, width=200, height=200, color="blue", slots=10):
    "Quick and dirty histogram"
    H = Histogram(color, slots, width, height)
    return H.load(values, color, slots)


class Histogram:

    def __init__(self, color="blue", slots=10, width=200, height=None):
        if height is None:
            height = width
        self.slots = slots
        self.color = color
        self.width = width
        self.height = height
        self.widget = dual_canvas.DualCanvasWidget(width=width, height=height)

    def load(self, values, color=None, slots=None):
        slots = self.slots = slots or self.slots or 10
        color = self.color = color or self.color
        width = self.width
        height = self.height
        m = min(values)
        M = max(values)
        diff = M - m
        if diff == 0:
            diff = 1  # xxx arbitrary.
        delta = diff * 1.0 / slots
        buckets = [0] * slots
        maxindex = slots - 1
        for v in values:
            index = int((v - m)/delta)
            index = min(maxindex, index)
            buckets[index] += 1
        Mb = max(buckets)
        widget = self.widget
        widget.reset_canvas()
        frame = self.frame = widget.frame_region(
            0, 0, width, height,
            m, 0, M, Mb
        )
        for (index, count) in enumerate(buckets):
            x = index * delta + m
            frame.frame_rect(x, 0, delta, count, color=color)
        frame.lower_left_axes(
            max_tick_count=7, min_x=m, max_x=M, 
            min_y=0, max_y=Mb, 
            x_anchor=m, y_anchor=0,
            )
        widget.fit()
        return widget
