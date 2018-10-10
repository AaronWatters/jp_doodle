import jp_proxy_widget
import numpy as np

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
