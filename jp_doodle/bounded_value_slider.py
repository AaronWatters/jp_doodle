

import jp_proxy_widget
from jp_doodle import dual_canvas, doodle_files
bfs_js = doodle_files.vendor_path("js/bounded_value_slider.js")


class BoundedValueSlider(jp_proxy_widget.JSProxyWidget):

    def __init__(
        self,
        length=500,
        horizontal=True,
        minimum=0,
        maximum=100,
        on_stop=None,
        on_change=None,
        integral=False,
        aspect_ratio=0.2,
        # ... add more eventually
        *pargs,
        **kwargs,
    ):
        super(BoundedValueSlider, self).__init__(*pargs, **kwargs)
        dual_canvas.load_requirements(self, additional=[bfs_js])
        self.element.bounded_value_slider(
            dict(
                length= length,
                horizontal= horizontal,
                minimum= minimum,
                maximum= maximum,
                verbose= True,
                on_stop=on_stop,
                on_change=on_change,
                integral=integral,
                aspect_ratio=aspect_ratio,
            )
        )
