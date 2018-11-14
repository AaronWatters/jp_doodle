
// Require jQuery only if needed.
if (!global.jQuery) {
  global.jQuery = require('jquery');
}
require('jquery-ui');

// these plugins install into the global jQuery object
require("./canvas_2d_widget_helper");
require("./dual_canvas_helper");

function jp_doodle_is_loaded() {
  return true;
}

export default jp_doodle_is_loaded;
