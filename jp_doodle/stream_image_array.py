import jp_proxy_widget
import numpy as np
from jp_doodle import dual_canvas
from threading import Timer

class StreamImageArray(jp_proxy_widget.JSProxyWidget):
    
    "Wrapper for dual_canvas jQuery extension object."

    default_config = dict(width=400, height=400)
    
    def __init__(self, array, width=300, height=300, *pargs, **kwargs):
        "Create a canvas drawing area widget."
        super(StreamImageArray, self).__init__(*pargs, **kwargs)
        (self.nrows, self.ncols, array) = self.check_array(array)
        # create the target canvas and add a function to load an image to the canvas
        self.js_init("""
            element.empty();
            element.container_canvas = $('<canvas width="'+ncols+'px" height="'+nrows+'px"/>');
            element.container_canvas.width(width);
            element.container_canvas.height(height);
            element.container_canvas.appendTo(element);
            var ctx = element.container_canvas[0].getContext("2d");
            element.container_context = ctx;
            //ctx.imageSmoothingEnabled = false;
            //ctx.scale(width * 1.0 / ncols, height * 1.0 / nrows);

            // background rectangle for debug
            //ctx.rect(0, 0, ncols, nrows);
            //ctx.fillStyle = "pink";
            //ctx.fill()
            //ctx.strokeStyle = "blue";
            //ctx.stroke();

            //element.container_context.scale(ncols * 1.0 / width, nrows * 1.0 / height);

            element.load_image_bytes = function (image_bytes) {
                var size = nrows * ncols * 4;
                if (image_bytes.length != size) {
                    throw new Error("byte array must be rgba values of correct size. "+size+" != "+
                        image_bytes.length);
                }
                var imgdata = element.container_context.createImageData(ncols, nrows);
                var data = imgdata.data;
                for (var i=0; i<size; i++) {
                    data[i] = image_bytes[i];
                }
                element.container_context.putImageData(imgdata, 0, 0, 0, 0, width, height);
            };
        """, width=width, height=height, nrows=self.nrows, ncols=self.ncols)
        # load the initial image
        self.update_image(array)

    def update_image(self, array):
        (nrows, ncols, coerced) = self.check_array(array)
        array_as_bytes = bytearray(coerced.tobytes())
        self.element.load_image_bytes(array_as_bytes)

    def check_array(self, np_array):
        "convert array to rbga values"
        shape = np_array.shape
        lshape = len(shape)
        if lshape == 2:
            # gray scale image
            (nrows, ncols) = shape
            coerced = np.zeros((nrows, ncols, 4), dtype=np.ubyte)
            for i in range(3):
                coerced[:, :, i] = np_array
            coerced[:, :, 3] = 255   # fully opaque
        elif lshape == 3:
            # color image or color with transparency channel
            (nrows, ncols, ncolors) = shape
            coerced = np.zeros((nrows, ncols, 4), dtype=np.ubyte)
            if ncolors == 3:
                for i in range(3):
                    coerced[:, :, i] = np_array[:, :, i]
                coerced[:, :, 3] = 255   # fully opaque
            elif ncolors == 4:
                coerced[:,:,:] = np_array
            else:
                raise ValueError("color channel must be rgb or rgba " + repr(shape))
        else:
            raise ValueError("array shape must be rows x columns or rows x columns x colors " + repr(shape))
        return (nrows, ncols, coerced)

class VolumeImageViewer:

    def __init__(self, volume_image, on_canvas, x0=0, y0=0, spacer=50, di=1, dj=1, dk=1, draw_delay=0.3):
        self.draw_delay = draw_delay
        (self.i_max, self.j_max, self.k_max) = volume_image.shape
        self.image = volume_image
        self.canvas = on_canvas
        self.x0 = x0
        self.y0 = y0
        self.spacer = spacer
        # initialize reference frames
        self.idi = idi = self.i_max * di
        self.jdj = jdj = self.j_max * dj
        self.kdk = kdk = self.k_max * dk
        #print (volume_image.shape, idi, jdj, kdk)
        lower_y = y0 - max(idi, jdj) - spacer
        right_x = x0 + max(idi, kdk) + spacer
        self.ul_frame = on_canvas.frame_region(
            x0, y0, 
            x0 + jdj, y0 - idi,
            0, 0, 
            self.j_max, self.i_max
        )
        self.ul_rect = self.ul_frame.frame_rect(name=True, x=0, y=0, w=self.j_max, h=self.i_max, color="blue")
        self.ll_frame = on_canvas.frame_region(
            x0, lower_y, x0 + kdk, lower_y - idi,
            0, 0, self.k_max, self.i_max
        )
        self.ll_rect = self.ll_frame.frame_rect(name=True, x=0, y=0, w=self.k_max, h=self.i_max, color="green")
        self.ur_frame = on_canvas.frame_region(
            right_x, y0, 
            right_x + kdk, y0 - jdj,
            0, 0, 
            self.k_max, self.j_max
        )
        self.ur_rect = self.ur_frame.frame_rect(name=True, x=0, y=0, w=self.k_max, h=self.j_max, color="red")
        #print (-10, lower_y - self.i_max, right_x + self.k_max, 10)
        #on_canvas.lower_left_axes(-10, lower_y - self.i_max, right_x + self.k_max, 10)
        # initial values for slicings
        self.i = self.i_max // 2
        self.j = self.j_max // 2
        self.k = self.k_max // 2
        self.draw()

    def draw(self):
        self.draw_scheduled = False
        canvas = self.canvas
        self.ul_frame.reset_frame()
        self.ll_frame.reset_frame()
        self.ur_frame.reset_frame()
        self.ul_rect = self.ul_frame.frame_rect(name="ji", x=0, y=0, w=self.j_max, h=self.i_max, color="blue")
        self.ll_rect = self.ll_frame.frame_rect(name="ki", x=0, y=0, w=self.k_max, h=self.i_max, color="green")
        self.ur_rect = self.ur_frame.frame_rect(name="kj", x=0, y=0, w=self.k_max, h=self.j_max, color="red")
        for rect in (self.ul_rect, self.ll_rect, self.ur_rect):
            rect.on("mousemove", self.mousemove)
            rect.on("mousedown", self.mousedown)
            rect.on("mouseup", self.mouseup)
        blue = np.array([0,0,255]).reshape([1,1,3])
        yellow = np.array([255,255,0]).reshape([1,1,3])
        for axis in range(3):
            (frame, A, (y, x, h, w)) = self.get_frame_and_slice(axis)
            m = A.min()
            M = A.max()
            if (M - m) < 1:
                M = m + 1.0
            factor = 1.0 / (M - m)
            B = (A - m) * factor
            (nrows, ncols) = B.shape
            B = B.reshape(B.shape + (1,))
            C = B * blue + (1.0 - B) * yellow
            name = "image_" + repr(axis)
            canvas.name_image_array(name, C)
            #frame.reset_frame()
            frame.named_image(name, 0, nrows, w, h)
            lw = 5
            cl = "rgba(255,0,0,0.3)"
            frame.line(x, y+5, x, nrows, color=cl, lineWidth=lw)
            frame.line(x+5, y, ncols, y, color=cl, lineWidth=lw)
            frame.line(x, 0, x, y-5, color=cl, lineWidth=lw)
            frame.line(0, y, x-5, y, color=cl, lineWidth=lw)
            frame.frame_rect(x, y, 20, 20, color=cl, dx=-10, dy=-10, fill=False, lineWidth=lw)
            #frame.lower_left_axes(min_x=0, max_x=200, min_y=0, max_y=200)
        self.ul_frame.text(10, -10, repr((self.i, self.j, self.k, self.image[self.i, self.j, self.k])))
        self.feedback = self.ur_frame.text(10, -10, "drawn", name=True)

    event = None
    mouse_is_down = False

    def mousedown(self, event):
        self.mouse_is_down = True

    def mouseup(self, event):
        self.mouse_is_down = False

    def mousemove(self, event):
        if not self.mouse_is_down:
            return   # ignore
        self.event = event
        canvas_name = event['canvas_name']
        ty = event["type"]
        model_location = event['model_location']
        x = int(model_location["x"])
        y = int(model_location["y"])
        self.feedback.change(text=repr((ty, canvas_name, x, y)))
        x_name = canvas_name[0]
        y_name = canvas_name[1]
        setattr(self, x_name, x)
        setattr(self, y_name, y)
        self.delayed_draw()

    draw_scheduled = False
    #draw_delay = 0.3  # seconds

    def delayed_draw(self):
        "delay to prevent event flooding on slow connections"
        if self.draw_scheduled:
            return
        self.draw_scheduled = True
        def do_draw():
            with self.canvas.delay_redraw():
                self.draw()
        t = Timer(self.draw_delay, do_draw)
        t.start()

    def get_frame_and_slice(self, axis):
        def clamp(index, maximum):
            return max(0, min(index, maximum - 1))
        if axis == 0:
            self.i = clamp(self.i, self.i_max)
            return (self.ur_frame, self.image[self.i, :, :], (self.j, self.k, self.jdj, self.kdk))
        elif axis == 1:
            self.j = clamp(self.j, self.j_max)
            return (self.ll_frame, self.image[:, self.j, :], (self.i, self.k, self.idi, self.kdk))
        elif axis == 2:
            self.k = clamp(self.k, self.k_max)
            return (self.ul_frame, self.image[:, :, self.k], (self.i, self.j, self.idi, self.jdj))
        else:
            raise ValueError("bad axis " + repr(axis))
