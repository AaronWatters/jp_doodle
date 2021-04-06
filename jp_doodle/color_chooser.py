"""
Color chooser widget.
"""

from jp_doodle import dual_canvas


class ColorChooser(dual_canvas.DualCanvasWidget):

    def __init__(self, side=300, callback=None, background="white", font=None, config=None, *pargs, **kwargs):
        super(ColorChooser, self).__init__(side, side, font, config, *pargs, **kwargs)
        self.color_callback = callback
        self.html_color = None
        self.color_array = None
        # create the colorizer
        '''
        self.js_init("""
            element.color_chooser({
                side: side,
                font: font,
                callback: change_color,
                background: background,
            })
        """,
        change_color=self.change_color,
        side=side,
        font=font,
        background=background,
        )'''
        self.element.color_chooser(dict(
            side=side,
            font=font,
            background=background,
            callback=self.change_color,
        ))

    def change_color(self, color_array, html_color):
        self.html_color = html_color
        self.color_array = color_array
        cb = self.color_callback
        if cb is not None:
            cb(color_array, html_color)

def chooser(side=300, callback=None, background="white", font=None):
    return ColorChooser(side=side, callback=callback, background=background, font=font)
