// Shared test globals.

// Require jQuery only if needed.
if (!global.jQuery) {
    global.jQuery = require('jquery');
}

require('jquery-ui');
//require('jest-canvas-mock');
  
// https://github.com/jsdom/jsdom/issues/1782

//
// Mock Canvas / Context2D calls
//
function mockCanvas (window) {
    var imgdata = function(w, h) {
        var length = w * h * 4;
        var result = new Array(length);
        for (var i=0; i<length; i++) {
            result[i] = 0;
        }
        return result;
    }
    window.HTMLCanvasElement.prototype.getContext = function () {
        return {
            fillRect: function() {},
            clearRect: function(){},
            resetTransform: function(){},
            getImageData: function(x, y, w, h) {
                return  {
                    data: imgdata(w, h),  // new Array(w*h*4)
                };
            },
            putImageData: function() {},
            createImageData: function(width, height){ 
                return {data: imgdata(width, height)};
            },
            setTransform: function(){},
            drawImage: function(){},
            save: function(){},
            fillText: function(){},
            restore: function(){},
            beginPath: function(){},
            moveTo: function(){},
            lineTo: function(){},
            closePath: function(){},
            stroke: function(){},
            translate: function(){},
            scale: function(){},
            rotate: function(){},
            arc: function(){},
            fill: function(){},
            measureText: function(){
                return { width: 0 };
            },
            transform: function(){},
            rect: function(){},
            clip: function(){},
        };
    }

    window.HTMLCanvasElement.prototype.toDataURL = function () {
        return "";
    }
}

global.mockCanvas = mockCanvas;
