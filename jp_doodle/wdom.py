
"""
Proxy widget helper for constructing DOM elements using Python code.

Inspired by https://github.com/nteract/vdom
"""

import jp_proxy_widget

class WDOM(jp_proxy_widget.JSProxyWidget):

    "Proxy widget holder for DOM elements."

    def __init__(self, components, *pargs, **kwargs):
        super(WDOM, self).__init__(*pargs, **kwargs)
        self.name_counter = 0
        self.js_init("""
        element.html("<div>Uninitialized VDOM widget</div>");

        element.make_simple_tag = function(parent_name, name, tag_name, attributes, content) {
            var tag_body;
            var parent = element;
            if (parent_name) {
                parent = element[parent_name];
            }
            if (content) {
                tag_body = "<" + tag_name + ">" + content + "</" + tag_name + ">";
            } else {
                tag_body = "<" + tag_name + "/>";
            }
            var tag = $(tag_body);
            tag.attr(attributes);
            element[name] = tag;
            tag.appendTo(parent);
            return tag;
        };

        element.make_composite_tag = function(parent_name, name, tag_name, attributes) {
            return element.make_simple_tag(parent_name, name, tag_name, attributes, null);
        };
        """)
        self.add_elements(components)

    def make_composite_tag(self, parent_name, name, tag_name, attributes):
        return self.element.make_composite_tag(parent_name, name, tag_name, attributes)

    def make_simple_tag(self, parent_name, name, tag_name, content, attributes):
        return self.element.make_simple_tag(parent_name, name, tag_name, attributes, content)

    def new_name(self, prefix):
        self.name_counter += 1
        return prefix + str(self.name_counter)

    def add_elements(self, *tag_proxies):
        self.element.empty()
        for tag_proxy in tag_proxies:
            tag_proxy.embed(self)


class TagProxy: 

    "Python proxy to a DOM element superclass. Also the default wrapper for bare strings."

    tag_name = "span"  # default to use spans to wrap strings.
    allow_children = True

    def __init__(self, *_content, **attributes):
        self.content = _content
        self.attributes = attributes

    def embed(self, widget, target_name=None):
        self.js_name = widget.new_name(self.tag_name)
        self.widget = widget
        content = self.content
        if len(content) == 1 and type(content[0]) is str:
            assert self.allow_children, "children not allowed for " + repr(self.tag_name)
            widget.make_simple_tag(target_name, self.js_name, self.tag_name, content[0], self.attributes)
        else:
            widget.make_composite_tag(target_name, self.js_name, self.tag_name, self.attributes)
            for component in content:
                assert self.allow_children, "children not allowed for " + repr(self.tag_name)
                if type(component) is str:
                    # Coerce bare strings to default
                    component = TagProxy(component)
                component.embed(widget, self.js_name)
        self.element = self.widget.element[self.js_name]
        return self.js_name


class create_component:

    def __init__(self, tag_name, allow_children=True):
        self.tag_name = tag_name
        self.allow_children = allow_children

    def __call__(self, *_content, **attributes):
        result = TagProxy(*_content, **attributes)
        result.tag_name = self.tag_name
        result.allow_children = self.allow_children
        return result

# from vdom/helpers.py:

# From https://developer.mozilla.org/en-US/docs/Web/HTML/Element

# Content sectioning
address = create_component('address')
article = create_component('article')
aside = create_component('aside')
footer = create_component('footer')
h1 = create_component('h1')
h2 = create_component('h2')
h3 = create_component('h3')
h4 = create_component('h4')
h5 = create_component('h5')
h6 = create_component('h6')
header = create_component('header')
hgroup = create_component('hgroup')
nav = create_component('nav')
section = create_component('section')

# Text content
blockquote = create_component('blockquote')
dd = create_component('dd')
div = create_component('div')
dl = create_component('dl')
dt = create_component('dt')
figcaption = create_component('figcaption')
figure = create_component('figure')
hr = create_component('hr', allow_children=False)
li = create_component('li')
ol = create_component('ol')
p = create_component('p')
pre = create_component('pre')
ul = create_component('ul')

# Inline text semantics
a = create_component('a')
abbr = create_component('abbr')
b = create_component('b')
br = create_component('br', allow_children=False)
cite = create_component('cite')
code = create_component('code')
data = create_component('data')
em = create_component('em')
i = create_component('i')
kbd = create_component('kbd')
mark = create_component('mark')
q = create_component('q')
s = create_component('s')
samp = create_component('samp')
small = create_component('small')
span = create_component('span')
strong = create_component('strong')
sub = create_component('sub')
sup = create_component('sup')
time = create_component('time')
u = create_component('u')
var = create_component('var')

# Image and video
img = create_component('img', allow_children=False)
audio = create_component('audio')
video = create_component('video')
source = create_component('source', allow_children=False)

# Table content
caption = create_component('caption')
col = create_component('col')
colgroup = create_component('colgroup')
table = create_component('table')
tbody = create_component('tbody')
td = create_component('td')
tfoot = create_component('tfoot')
th = create_component('th')
thead = create_component('thead')
tr = create_component('tr')

# Forms (only read only aspects)
meter = create_component('meter')
output = create_component('output')
progress = create_component('progress')
input_ = create_component('input', allow_children=False)
button = create_component('button')
label = create_component('label')

# Interactive elements
details = create_component('details')
dialog = create_component('dialog')
menu = create_component('menu')
menuitem = create_component('menuitem')
summary = create_component('summary')

style = create_component('style')

# from vdom/svg.py:

# From https://developer.mozilla.org/en-US/docs/Web/SVG/Element

# Animation elements
animate = create_component('animate')
animateColor = create_component('animateColor')
animateMotion = create_component('animateMotion')
animateTransform = create_component('animateTransform')
discard = create_component('discard')
mpath = create_component('mpath')
set_ = create_component('set')

# Basic shapes
circle = create_component('circle')
ellipse = create_component('ellipse')
line = create_component('line')
polygon = create_component('polygon')
polyline = create_component('polyline')
rect = create_component('rect')

# Container elements
a = create_component('a')
defs = create_component('defs')
g = create_component('g')
marker = create_component('marker')
mask = create_component('mask')
missing_glyph = create_component('missing-glyph')
pattern = create_component('pattern')
svg = create_component('svg')
switch = create_component('switch')
symbol = create_component('symbol')
unknown = create_component('unknown')

# Descriptive elements
desc = create_component('desc')
metadata = create_component('metadata')
title = create_component('title')

# Filter primitive elements
feBlend = create_component('feBlend')
feColorMatrix = create_component('feColorMatrix')
feComponentTransfer = create_component('feComponentTransfer')
feComposite = create_component('feComposite')
feConvolveMatrix = create_component('feConvolveMatrix')
feDiffuseLighting = create_component('feDiffuseLighting')
feDisplacementMap = create_component('feDisplacementMap')
feDropShadow = create_component('feDropShadow')
feFlood = create_component('feFlood')
feFuncA = create_component('feFuncA')
feFuncB = create_component('feFuncB')
feFuncG = create_component('feFuncG')
feFuncR = create_component('feFuncR')
feGaussianBlur = create_component('feGaussianBlur')
feImage = create_component('feImage')
feMerge = create_component('feMerge')
feMergeNode = create_component('feMergeNode')
feMorphology = create_component('feMorphology')
feOffset = create_component('feOffset')
feSpecularLighting = create_component('feSpecularLighting')
feTile = create_component('feTile')
feTurbulence = create_component('feTurbulence')

# Font elements
font = create_component('font')
font_face = create_component('font-face')
font_face_format = create_component('font-face-format')
font_face_name = create_component('font-face-name')
font_face_src = create_component('font-face-src')
font_face_uri = create_component('font-face-uri')
hkern = create_component('hkern')
vkern = create_component('vkern')

# Gradient elements
linearGradient = create_component('linearGradient')
meshgradient = create_component('meshgradient')
radialGradient = create_component('radialGradient')
stop = create_component('stop')

# Graphics elements
image = create_component('image')
mesh = create_component('mesh')
path = create_component('path')
text = create_component('text')
use = create_component('use')

# Graphics referencing elements
audio = create_component('audio')
iframe = create_component('iframe')
video = create_component('video')

# HTML elements
canvas = create_component('canvas')

# Light source elements
feDistantLight = create_component('feDistantLight')
fePointLight = create_component('fePointLight')
feSpotLight = create_component('feSpotLight')

# Never-rendered elements
clipPath = create_component('clipPath')
hatch = create_component('hatch')
script = create_component('script')
style = create_component('style')

# Paint server elements
solidcolor = create_component('solidcolor')

# Renderable elements
foreignObject = create_component('foreignObject')
textPath = create_component('textPath')
tspan = create_component('tspan')

# Text content elements
altGlyph = create_component('altGlyph')
altGlyphDef = create_component('altGlyphDef')
altGlyphItem = create_component('altGlyphItem')
glyph = create_component('glyph')
glyphRef = create_component('glyphRef')
tref = create_component('tref')

# Uncategorized elements
color_profile = create_component('color-profile')
cursor = create_component('cursor')
filter_ = create_component('filter')
hatchpath = create_component('hatchpath')
meshpatch = create_component('meshpatch')
meshrow = create_component('meshrow')
view = create_component('view')
