from jp_doodle import doodle_files
qf_js = doodle_files.vendor_path("js/quantity_forest.js")
from jp_doodle import dual_canvas
import jp_proxy_widget
import os
from subprocess import check_output
import pprint

def directory_usage(directory, epsilon=0.02):
    if not os.path.isdir(directory):
        return None
    ls = os.listdir(directory)
    result = {}
    total = 0.0
    for fn in ls:
        path = os.path.join(directory, fn)
        try:
            usage = check_output(["du", "-s", path])
        except Exception:
            pass
        else:
            [snum, sname] = usage.strip().split("\t")
            num = float(snum)
            total += num
            result[fn] = (path, num)
    final = {}
    other = 0
    for fn in result:
        (path, num) = result[fn]
        portion = num/total
        if portion < epsilon:
            other += num
        else:
            final[fn] = {"name": fn, "file_size": num, "percent": portion*100, "id": path}
    if other>epsilon:
        final["*other"] = {"name": "*other", "file_size": other, "percent": other*100/total, "id": "*" + directory}
    return final

RIGHT = {"x": 1, "y":0}
UP = {"x": 0, "y":1}

class FileSystemExplorer:

    color_counter = 333
    opacity = 0.5

    def __init__(self, canvas_widget, path, width=600, enable_deletions=False,
            horizontal=False, x_vector=None, y_vector=None,
            dy=50, dh=20, epsilon=0.02, degrees=15, font="normal 10px Arial",
            background="rgba(244,230,255,0.8)", opacity=0.7,
            clearHeight=300,
            ):
        self.opacity = opacity
        if y_vector is None:
            y_vector = UP
            if horizontal:
                y_vector = RIGHT
        if x_vector is None:
            x_vector = RIGHT
            if horizontal:
                x_vector = UP
        self.epsilon = epsilon
        self.enable_deletions = enable_deletions
        path = os.path.expanduser(path)
        path = os.path.abspath(path)
        self.color_cache = {}
        self.usage_cache = {}
        self.id_to_data = {}
        self.expanded = {}
        self.widget = canvas_widget
        self.path = path
        members = self.directory_members(path)
        self.widget = canvas_widget
        canvas_widget.load_js_files([qf_js])
        canvas_widget.js_init("""
            debugger;
            var forest_config = {
                top_label: top_label,
                roots: members,
                width: width,
                dy: dy,
                dh: dh,
                id_click: id_click,
                degrees: degrees,
                background: background,
                x_vector: x_vector,
                y_vector: y_vector,
                font: font,
                clearHeight: clearHeight,
            }
            element.quantity_forest(forest_config);
            element.detail = $("<div>Initialized</div>").appendTo(element);

            element.show_detail = function(identity, info) {
                var d = element.detail
                d.html("<div/>");
                for (key in info) {
                    $("<div>" + key + " : " + info[key] + "<div>").appendTo(d);
                }
                if (!identity.startsWith("*")) {
                    var deleter = $("<a>delete " + identity + "</a>").appendTo(d);
                    deleter.on("click", function() { delete_id(identity); });
                }
            };
        """, 
        width=width, 
        members=members, 
        dy=dy, dh=dh, 
        id_click=self.id_click, 
        top_label=path,
        delete_id=self.delete_id, 
        degrees=degrees,
        x_vector=x_vector,
        y_vector=y_vector,
        font=font,
        background=background,
        clearHeight=clearHeight,
        )
        if enable_deletions:
            self.widget.element.detail.html("<div>DELETIONS ARE ENABLED!</div>");

    def directory_usage(self, directory):
        cache = self.usage_cache
        if directory in cache:
            return cache[directory]
        usage = directory_usage(directory, self.epsilon)
        cache[directory] = usage
        if not usage:
            return usage
        for u in usage.values():
            u["parent"] = directory
            self.id_to_data[u["id"]] = u
        return usage

    def get_color(self, identity):
        cache = self.color_cache
        if identity in cache:
            return cache[identity]
        result = cache[identity] = self.pick_color()
        return result

    def pick_color(self):
        self.color_counter += 1
        counter = self.color_counter
        rgb = [0, 0, 0]
        for i in range(8):
            for j in range(3):
                rgb[j] = (rgb[j] << 1) | (counter & 1)
                counter = (counter >> 1)
        # darken
        for i in range(3):
            rgb[i] = (rgb[i] * 200) // 255
        return "rgba(%s,%s,%s,%s)" % (tuple(rgb) + (self.opacity,))

    def delete_id(self, identity):
        try:
            self.widget.element.css("cursor", "wait")
            self.widget.element.detail.html("<div>attempting delete...</div>")
            self.delete_id1(identity)
        finally:
            self.widget.element.css("cursor", "default")

    def delete_id1(self, identity):
        if self.enable_deletions:
            # for simplicity for now just clear the usage cache
            self.usage_cache = {}
            cmd = ["rm", "-rf", identity]
            self.widget.element["print"](repr(cmd))
            #w.element.css("cursor", "wait")
            try:
                #try:
                    checked = check_output(cmd)
                #finally:
                    #w.element.css("cursor", "default")
            except Exception as e:
                self.widget.element.detail.html("<div>delete " + repr((identity, e)) + " failed</div>");
            else:
                roots = self.directory_members(self.path)
                #pprint.pprint(roots)
                self.widget.element.reset_roots(roots)
                self.widget.element.detail.html("<div>" + repr(identity) + " deleted</div>");
        else:
            self.widget.element.detail.html("<div>delete " + repr(identity) + " disabled</div>");

    def id_click(self, identity):
        try:
            self.widget.element.css("cursor", "wait")
            self.widget.element.detail.html("<div>click...</div>")
            self.expanded[identity] = not self.expanded.get(identity, False)
            roots = self.directory_members(self.path)
            #pprint.pprint(roots)
            self.widget.element.reset_roots(roots)
            #self.widget.element.detail.html("<div>expand " + repr(identity) + "</div>");
            self.widget.element.show_detail(identity, self.id_to_data[identity])
        finally:
             self.widget.element.css("cursor", "default")

    def directory_members(self, directory):
        self.expanded[directory] = True
        usage = self.directory_usage(directory)
        if not usage:
            return []
        result = []
        sorter = [(u["percent"], u["name"]) for u in usage.values()]
        for (pct, filename) in reversed(sorted(sorter)):
            u = usage[filename]
            identity = u["id"]
            expanded = self.expanded.get(identity, False)
            children = None
            if expanded:
                children = self.directory_members(identity)
            r = {
                "id": identity, 
                "label": u["name"],
                "size": u["file_size"],
                "children": children,
                "expanded": expanded,
                "color": self.get_color(identity),
            }
            result.append(r)
        return result
