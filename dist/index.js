'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

// Require jQuery only if needed.
if (!global.jQuery) {
  global.jQuery = require('jquery');
}
require('jquery-ui');

// these plugins install into the global jQuery object
require("./canvas_2d_widget_helper");
require("./dual_canvas_helper");
require("./nd_frame");

function jp_doodle_is_loaded() {
  return true;
}

exports.default = jp_doodle_is_loaded;