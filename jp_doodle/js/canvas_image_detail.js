/*

JQuery plugin: display image in full view with draggable detail rectangle.

Structure follows: https://learn.jquery.com/plugins/basic-plugin-creation/

*/
"use strict";

(function($) {
    $.fn.canvas_image_detail = function (options, element) {

        element = element || this;

        class ImageDetail {
            constructor(options, element) {
                var settings = $.extend({
                    panel_width_factor: 0.4,
                    screen_min: 400,
                    epsilon: 1e-5,
                }, options);
                this.settings = settings;
                this.element = element;
                this.zoom = 1;
                this.gamma = 1.0;
                this.last_position = null;
                this.mouse_is_pressed = false;
                this.sync_list = [];
                this.loaded = false;
                this.setting_position = false;
            };
            sync_with(other_image_detail) {
                this.sync_list.push(other_image_detail)
            }
            load_image_url(url) {
                var that = this;
                var $img = $('<img src="' + url + '"/>') //.appendTo(element);
                var img = $img[0];
                img.onload = function () { that.image_on_load(img); }
            };
            image_on_load(img) {
                var whole_width = img.width;
                var whole_height = img.height;
                // draw the image into a hidden canvas and then get the pixels
                var hcanvas = $(`<canvas width="${whole_width}px" height="${whole_height}px" tabindex="0"/>`);
                var hcontext = hcanvas[0].getContext("2d");
                hcontext.drawImage(img, 0, 0);
                var imgData = hcontext.getImageData(0, 0, whole_width, whole_height);
                var imgArray = imgData.data;
                this.show_image(imgArray, whole_width, whole_height);
            };
            gamma_correction_table(gamma) {
                var result = [];
                for (var i=0; i<256; i++) {
                    result.push( Math.floor( 255 * Math.pow(( i / 255 ), gamma) ));
                }
                return result;
            };
            gamma_correct(pixels, gamma) {
                var correction = this.gamma_correction_table(gamma);
                var result = pixels.slice();
                for (var i=0; i<pixels.length; i++) {
                    result[i] = correction[pixels[i]]
                }
                return result;
            };
            show_image(imgArray, whole_width, whole_height) {
                this.imgArray = imgArray;
                this.whole_width = whole_width;
                this.whole_height = whole_height;
                var that = this;

                // determine canvas width and height as fraction of whole.
                var s = this.settings;
                var mn = s.screen_min;
                const vw = Math.max(
                    document.documentElement.clientWidth || mn, 
                    window.innerWidth || mn)
                var max_width = Math.max(vw * s.panel_width_factor, 100);
                var divisor = 1.0;
                var canvas_width = whole_width;
                while (canvas_width > max_width) {
                    divisor += 1.0;
                    canvas_width = whole_width / divisor;
                }
                var canvas_height = canvas_width * whole_height * (1.0 / whole_width);
                this.canvas_height = canvas_height;
                this.canvas_width = canvas_width;

                // construct the display scaffolding
                var element = this.element;
                element.empty();
                
                // canvas containers
                var canvases = $("<div></div>").appendTo(element);
                canvases.addClass("canvases");
                canvases.css("display", "flex");
                var whole = $("<div>whole image here.</div>").appendTo(canvases);
                whole.addClass("whole-image");
                var detail = $("<div>image detail here.</div>").appendTo(canvases);
                detail.addClass("detail-image");

                // controls and info area
                var gamma_area = $("<div></div>").appendTo(element);
                gamma_area.addClass("gamma-area");
                gamma_area.css("display", "flex");
                var label = $("<div>Gamma:</div>").appendTo(gamma_area);
                label.addClass("gamma-label");
                var slider = $("<div>slider here.</div>").appendTo(gamma_area);
                slider.addClass("gamma-slider");
                this.gamma_value = $("<div>gamma_value here.</div>").appendTo(gamma_area);
                this.gamma_value.addClass("gamma-value");
                $("<div> &nbsp; Zoom: </div>").appendTo(gamma_area);
                var zoom_select = $('<select>  <option value="1">1x</option> </select>').appendTo(gamma_area);
                for (var i=2; i<5; i++) {
                    $( `<option value="${i}">${i}x</option>`).appendTo(zoom_select);
                }
                this.slider = slider;
                this.zoom_select = zoom_select

                // construct the canvas displays and annotations.
                var config = {
                    width: canvas_width,
                    height: canvas_height,
                    image_smoothing: true,
                };
                whole.empty();
                detail.empty();
                whole.dual_canvas_helper(config);
                detail.dual_canvas_helper(config);
                this.whole_canvas = whole;
                this.detail_canvas = detail;
                this.update_images();
                this.detail_image = detail.named_image({image_name: "example", x:0, y:0, w:whole_width, h:whole_height, name:true});
                var whole_image = whole.named_image({image_name: "example", x:0, y:0, w:canvas_width, h:canvas_height, name:true});

                // whole image annotations
                // whole image frame in image coordinates (origin top left, y going down),
                var wframe = whole.frame_region(
                    0, canvas_height, canvas_width, 0,
                    0, 0, whole_width, whole_height
                );
                
                this.detail_rectangle = wframe.frame_rect({
                    x:canvas_width, y:whole_height-canvas_height, 
                    w:canvas_width, h:canvas_height, color: "#f55", fill:false, name: true, events: false, lineWidth:3,
                });
                var event_rectangle = wframe.frame_rect({
                    x: 0, y:0, w:whole_width, h: whole_height, color: "rgba(0,0,0,0)", name:true,
                });
                var init_position = {x: (whole_width - canvas_width)/2, y: (whole_height + canvas_height)/2};
                this.set_position(init_position);

                // set up controls
                slider.empty();
                slider.width(500);
                slider.slider({
                    value: this.gamma,
                    slide: (function (event) { that.gamma_slide(event); }),
                    min: 0.1,
                    max: 4.0,
                    step: 0.1,
                });

                // connect event callbacks
                var track_detail = function (event) { that.track_detail(event); }
                event_rectangle.on("mousemove", track_detail);
                event_rectangle.on("mouseup", track_detail);
                event_rectangle.on("mousedown", track_detail);
                zoom_select.on("change", function(event) { that.zoom_change(event); })
                this.gamma_value.html("" + this.gamma);
                
                this.loaded = true;
            };
            track_detail(event) {
                var etype = event.type;
                if (etype == "mousedown") {
                    this.mouse_is_pressed = true;
                }
                if (etype == "mouseup") {
                    this.mouse_is_pressed = false;
                }
                if (!this.mouse_is_pressed) {
                    return;
                }
                var position = event.model_location;
                this.set_position(position)
            };
            gamma_slide(event) {
                this.gamma = this.slider.slider("option", "value");
                this.gamma_value.html("" + this.gamma);
                this.update_images();
            };
            zoom_change(event) {
                this.zoom = parseInt(this.zoom_select.val());
                this.set_position(null);  // use last position with new zoom
            };
            set_position(position, zoom) {
                // prevent infinite recursion
                if (this.setting_position) {
                    return;
                }
                try {
                    this.setting_position = true;
                    position = position || this.last_position;
                    this.last_position = position;
                    zoom = zoom || this.zoom;
                    this.zoom = zoom;
                    this.zoom_select.val(zoom).change();
                    var canvas_height = this.canvas_height;
                    var canvas_width = this.canvas_width;
                    var whole_height = this.whole_height;
                    var whole_width = this.whole_width;
                    var zw = canvas_width / zoom;
                    var zh = canvas_height / zoom;
                    var x = position.x - zw/2;
                    var y = position.y + zh/2;
                    x = Math.min(x, whole_width - zw);
                    y = Math.max(y, zh);
                    x = Math.max(x, 0)
                    y = Math.min(y,  whole_height)
                    x = Math.round(x);
                    y = Math.round(y);
                    //info.html("position: " + [x, y])
                    var offset_x = x;
                    var offset_y = whole_height - y;
                    this.detail_rectangle.change({x: x, y: y-zh, w:zw, h:zh});
                    this.detail_image.change({x: -offset_x * zoom, y: -offset_y * zoom, w:whole_width * zoom, h:whole_height*zoom});
                    // sync with others
                    for (var i=0; i<this.sync_list.length; i++) {
                        var other = this.sync_list[i];
                        if ((other != this) && (other.loaded)) {
                            other.set_position(position, zoom);
                        }
                    }
                } finally { 
                    this.setting_position = false
                }
            };
            update_images() {
                var gamma = this.gamma;
                this.corrected_array = this.gamma_correct(this.imgArray, gamma);
                this.whole_canvas.name_image_data("example", this.corrected_array, this.whole_width, this.whole_height);
                this.detail_canvas.name_image_data("example", this.corrected_array, this.whole_width, this.whole_height);
                this.whole_canvas.request_redraw();
                this.detail_canvas.request_redraw();
            };
        };

        return new ImageDetail(options, element);
    };
})(jQuery);
