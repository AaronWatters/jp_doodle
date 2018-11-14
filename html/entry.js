
if (!global.jQuery) {
  global.jQuery = require('jquery');
}

require("../dist/index");

jQuery(function(){
  var $ = jQuery;
  var element = $('#target_div');
  //$('<img src="http://sipi.usc.edu/database/preview/misc/4.2.03.png">').appendTo(element);
  // Attach an information div to the element to display event feedback.
  var info_area = $("<div>Dual canvas feedback will show here.</div>").appendTo(element);

  // Attach a dual canvas associated with the element as a child of the element
  // configured with width 400 and height 200.
  var config = {
        width: 400,
        height: 200,
    };
  element.dual_canvas_helper(config);

  // Draw some named elements on the canvas.
  // A filled yellow circle (disk) named "Colonel Mustard
  element.circle({name: "Colonel Mustard", x:100, y:150, r:90, color:"yellow"});

  // A filled red rectangle named "Miss Scarlett"
  element.rect({name: "Miss Scarlett", x:100, y:130, w:100, h:20, color: "red"});

  // An unfilled white circle named "Mrs. White"
  element.circle({
  name: "Mrs. White", x:100, y:150, r:58, fill:false, 
  color:"white", lineWidth: 14});

  // An unfilled blue rectangle named Mrs. Peacock
  element.rect({
  name: "Mrs. Peacock", x:40, y:110, w:100, h:20,
  color: "blue", lineWidth: 10, degrees:70, fill:false});

  // A line segment named "Professor Plum".
  element.line({
  name: "Professor Plum", x1:190, y1:100, x2:10, y2:200,
  color:"purple", lineWidth: 20})

  // A brown filled polygon (triangle) named Micky
  element.polygon({
  name: "Micky",
  points: [[210, 10], [210, 110], [290, 60]],
  color: "brown",
  })

  // A green polyline named Mr. Green
  element.polygon({
  name: "Mr. Green", fill:false, close:false, color: "green",
  lineWidth: 14, points: [[210, 10], [210, 110], [290, 60]]
  })

  // A magenta text string display named Pluto
  element.text({
  name: "Pluto", text: "The Republic", font: "20px Arial",
  x: 20, y:20, degrees: 5, color:"magenta"
  })

  // Mandrill eyes from a remote image
  var mandrill_url = "http://sipi.usc.edu/database/preview/misc/4.2.03.png";
  //var mandrill_url = "mandrill.png"
  element.name_image_url("mandrill", mandrill_url);
  // just the eyes, not the whole image
  element.named_image({
  name: "mandrill eyes",
  image_name: "mandrill", x:220, y:170, w:80, h:30,
  sx:30, sy:15, sWidth:140, sHeight:20
  })

  // Center and scale the figure to fit in the available area.
  element.fit()

  // Add axes and refit so the axes appear in the frame.
  element.lower_left_axes();
  element.fit()

  // Attach a mouse move event which indicates what object the mouse is over.
  var on_mouse_move = function(event) {
  if (event.canvas_name) {
    info_area.html("<div>You are over the object named " + event.canvas_name + "</div>");
  } else {
    info_area.html("<div>You are not over anybody.</div>");
  }
  };
  element.on_canvas_event("mousemove", on_mouse_move);

  $("<div>Please mouse over the canvas area to see event feedback.</div>").appendTo(element)
});
