"""
Quick and dirty Python object explorer Jupyter widget
"""

import jp_proxy_widget
import numbers
import html
import json
from jp_doodle import data_tables

class Examiner:
    
    def __init__(self, item):
        self.item = item
        self.widget = jp_proxy_widget.JSProxyWidget()
        self.widget.js_init("""
            element.show_json = function(json, node, all_json) {
                all_json = all_json || json;
                if (!node) {
                    node = element;
                    element.empty();
                }
                var txt = json.txt;
                var prefix = json.prefix || "&nbsp;";
                var indicator = prefix;
                if (json.expanded) {
                    node.css({
                        "display": "grid",
                        "grid-template-columns": "25px auto",
                        "grid-template-rows": "25px auto"
                    });
                    if (json.expandable) {
                        indicator = prefix + "V";
                    }
                } else {
                    node.css({
                        "display": "grid",
                        "grid-template-columns": "25px auto",
                        "grid-template-rows": "25px"
                    });
                    if (json.expandable) {
                        indicator = prefix + ">";
                    }
                }
                var indicator_div = $("<div>" + indicator + "</div>").appendTo(node);
                indicator_div.css("background-color", "cornsilk")
                var toggle_expanded = function () {
                    if (json.expandable) {
                        json.expanded = !json.expanded;
                        // encode as string to avoid recursion limit
                        var json_str = JSON.stringify(all_json);
                        get_json(json_str);
                    }
                }
                var txt_div = $("<div>" + txt + "</div>").appendTo(node);
                indicator_div.click(toggle_expanded);
                txt_div.click(toggle_expanded);
                if (json.expanded) {
                    var spacer = $("<div>..</div>").appendTo(node);
                    var member_node = $("<div></div>").appendTo(node);
                    var members = json.members;
                    for (var i=0; i<members.length; i++) {
                        var member = members[i];
                        element.show_json(member, member_node, all_json);
                    }
                }
            };
        """, get_json=self.get_json)
        self.get_json()
        
    def get_json(self, template_str=None):
        if template_str is None:
            template = {}
        else:
            template = json.loads(template_str)
        self.last_template = template
        self.last_json = self.json_for(self.item, template)
        self.widget.element.show_json(self.last_json)
        
    def json_for(self, thing, template):
        if template is None:
            template = {}
        expanded = template.get("expanded")
        ty = type(thing)
        if thing is None or isinstance(thing, numbers.Number) or ty in (bool,):
            result = self.json_repr(thing)
        elif ty in (str, bytes):
            result = self.json_str(thing)
        elif ty in (list, tuple):
            result = self.json_list(thing, expanded, template)
        elif ty is dict:
            result = self.json_dict(thing, expanded, template)
        elif hasattr(thing, "__dict__"):
            result = self.json_dict(thing, expanded, template, thing.__dict__)
        else:
            result = self.json_repr(thing)
        return result
    
    def json_dict(self, thing, expanded, template, dictionary=None):
        result = self.json_str(thing)
        result["expanded"] = expanded
        if dictionary is None:
            dictionary = thing
        result["expandable"] = (len(dictionary) > 0)
        if expanded:
            items = []
            keys = sorted(dictionary.keys())
            item_templates = template.get("members", [{}] * len(dictionary))
            for (count, key) in enumerate(keys):
                value = dictionary[key]
                pair_template = item_templates[count]
                pair_str = repr(key) + ": " + repr(value)
                pair_json = {"txt": ""}
                pair_json["expanded"] = True
                pair_json["expandable"] = False
                pair_json["prefix"] = "::"
                kv_templates = pair_template.get("members", [{}, {}])
                key_json = self.json_for(key, kv_templates[0])
                value_json = self.json_for(value, kv_templates[1])
                pair_json["members"] = [key_json, value_json]
                items.append(pair_json)
            result["members"] = items
        return result
        
    def json_list(self, thing, expanded, template):
        result = self.json_str(thing)
        result["expandable"] = (len(thing) > 0)
        result["expanded"] = expanded
        if expanded:
            items = []
            item_templates = template.get("members", [None] * len(thing))
            for i in range(len(thing)):
                thing_i = thing[i]
                template_i = item_templates[i]
                json_i = self.json_for(thing_i, template_i)
                json_i["prefix"] = str(i) + ":"
                items.append(json_i)
            result["members"] = items
        return result
        
    def json_repr(self, thing):
        return {"expandable": False, "txt": repr(thing)}
    
    def json_str(self, thing, limit=50, as_string=False):
        if as_string:
            r = str(thing)
        else:
            r = repr(thing)
        if len(r) > limit:
            r = r[:limit] + "..."
        r = html.escape(r)
        return {"expandable": False, "txt": r}

def examine(thing):
    data_tables.widen_notebook()
    E = Examiner(thing)
    return E.widget
