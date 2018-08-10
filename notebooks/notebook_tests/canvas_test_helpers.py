
class ColorTester:
    
    def __init__(self, on_canvas, name, height=None):
        self.name = name
        self.height = height
        self.position_to_color_expected = {}
        self.on_canvas = on_canvas
        self.position_to_color_found = {}
    def add_check(self, x, y, color_list_expected):
        yadj = y
        if self.height is not None:
            # convert lower left y going up to upper left y going down...
            yadj = self.height - y
        position = (x, y)
        self.position_to_color_expected[position] = color_list_expected
        def check_callback(color_list_found):
            self.position_to_color_found[position] = color_list_found
        self.on_canvas.callback_with_pixel_color(x, yadj, check_callback)
    def validate(self):
        for position in self.position_to_color_expected:
            color_list_expected = self.position_to_color_expected[position]
            color_list_found = self.position_to_color_found.get(position)
            assert color_list_expected == color_list_found, repr(
                (self.name, position, color_list_expected, color_list_found))
        print ("Color tests okay for "+repr(self.name))
        