

import jp_proxy_widget
from jp_doodle import dual_canvas, doodle_files
bfs_js = doodle_files.vendor_path("js/bounded_value_slider.js")

def load_requirements(widget, additional=()):
    additional = [bfs_js] + list(additional)
    dual_canvas.load_requirements(widget, additional=[bfs_js])

class BoundedValueSlider(jp_proxy_widget.JSProxyWidget):

    def __init__(
        self,
        length=500,
        horizontal=True,
        minimum=0,
        maximum=100,
        initial=25,
        on_stop=None,
        on_change=None,
        integral=False,
        aspect_ratio=0.2,
        radius=10,
        selected_radius=15,
        base_color="silver",
        low_color="royalblue",
        high_color="orange",
        current_color="cyan",
        forbidden="black",
        verbose=False,
        # ... add more eventually
        *pargs,
        **kwargs,
    ):
        super(BoundedValueSlider, self).__init__(*pargs, **kwargs)
        load_requirements(self)
        self.element.bounded_value_slider(
            dict(
                length= length,
                horizontal= horizontal,
                initial=initial,
                minimum= minimum,
                maximum= maximum,
                verbose= verbose,
                on_stop=self.on_stop,
                on_change=on_change,
                integral=integral,
                aspect_ratio=aspect_ratio,
                base_color=base_color,
                low_color=low_color,
                high_color=high_color,
                current_color=current_color,
                forbidden=forbidden,
                radius=radius,
                selected_radius=selected_radius,
            )
        )
        self.on_stop_callback = on_stop
        self.current_values = None

    def on_stop(self, values):
        "record current values."
        self.current_values = values
        if self.on_stop_callback:
            self.on_stop_callback(values)

    def set_values(self, current=None, high=None, low=None):
        if current is not None:
            self.element.bounded_slider.update_model(CURRENT, current)
        if high is not None:
            self.element.bounded_slider.update_model(HIGH, high)
        if low is not None:
            self.element.bounded_slider.update_model(LOW, low)

    def get_values(self):
        return self.element.bounded_slider.values_mapping(None).sync_value()

HIGH = "HIGH";
LOW = "LOW";
CURRENT = "CURRENT";