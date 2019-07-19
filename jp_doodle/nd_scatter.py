"""
Python wrapper and related helpers for nd_scatter functionality using proxy widgets.
"""

from jp_doodle import doodle_files, dual_canvas, nd_frame, data_tables
import jp_proxy_widget
import csv
from IPython.display import display, HTML
from sklearn.preprocessing import StandardScaler
import numpy as np

nd_scatter_js = doodle_files.vendor_path("js/nd_scatter.js")

class ND_Scatter_Widget(jp_proxy_widget.JSProxyWidget):

    "Wrapper for an nd-scatter structure."
    
    def __init__(self, jsondata=None, config=None, *pargs, **kwargs):
        "Create a canvas drawing area widget."
        super(ND_Scatter_Widget, self).__init__(*pargs, **kwargs)
        data_tables.widen_notebook()
        nd_frame.load_requirements(self, additional=[nd_scatter_js])
        if config is None:
            config = {}
        self.js_init("""
            element.empty();
            element.scatter_plot = element.nd_scatter(config);
            element.scatter_plot.make_scaffolding();
        """, config = config)
        if jsondata is not None:
            self.element.scatter_plot.define_json(jsondata)

next_index = 111

def garish_color(index0=None):
    global next_index
    if index0 is None:
        index0 = next_index
    rgb = [0,0,0]
    index = index0
    for i in range(8):
        for j in range(3):
            rgb[j] = (rgb[j] << 1) | (index & 1)
            index = index >> 1
    rgbc = ",".join(str(x) for x in rgb)
    next_index = (j+1) * ((index0 + 1789) % 79187)
    return "rgb(" + rgbc + ")"

STAND_ALONE_HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <!-- Automatically generated multidimensional scatter plot as stand alone HTML -->

    <title>%(title)s</title>

    <style>
    %(style)s
    </style>

    <script>

    // Embedded Libraries
    // ==================
    %(javascript)s

    // Plot data and parameters
    // ========================
    var json_data = %(json)s;

    </script>

</head>

<body onload="draw_scatter_plot()">

    <div id="target_container">
        <div id="target_div"/>
    </div>

    <script>
    // Driver script.
    // ==============
    function draw_scatter_plot() {
        var element = $('#target_div');element.empty();element.empty();
        var scatter_plot = element.nd_scatter({
            scatter_size: %(size)s,
        });
        element.scatter_plot = scatter_plot;  // for debugging
        scatter_plot.make_scaffolding();
        scatter_plot.define_json(json_data);
    }
    </script>

</body>
</html>
"""

REQUIRED_CSS_STYLES = [
    "js/jquery-ui-1.12.1/jquery-ui.css",
]

REQUIRED_JAVASCRIPT_LIBRARIES = [
    "js/jquery-ui-1.12.1/external/jquery/jquery.js",
    "js/jquery-ui-1.12.1/jquery-ui.js",
    "js/canvas_2d_widget_helper.js",
    "js/dual_canvas_helper.js",
    "js/nd_frame.js",
    "js/nd_scatter.js",
]

class FormatRows:

    def __init__(self, rows, prefix="Scatter plot", sanity_limit=10, colorizer_index=None):
        self.colorizer_index = colorizer_index
        self.rows = rows
        self.sanity_limit = sanity_limit
        self.features = {}
        self.configuration_names = []
        self.configurations = {}
        self._standardized = False
        self._colorizers = {}
        self.annotations = []

    def line(self, location1, location2, color, **other_atts):
        self.add_annotation(
            type="line",
            location1=location1,
            location2=location2,
            color=color,
            **other_atts)

    def add_annotation(self, **descriptor):
        self.annotations.append(descriptor)

    def as_widget(self, **config):
        return ND_Scatter_Widget(self.to_json_object(), config=config)

    def to_json_object(self):
        result = {}
        result["features"] = [self.features[n].to_json_object() for n in sorted(self.features.keys())]
        #result["configurations"] = [self.configurations[n].to_json_object() for n in self.configuration_names]
        for configuration in self.configurations.values():
            configuration["annotations"] = self.annotations
        result["configurations"] = [self.configurations[n] for n in self.configuration_names]
        result["points"] = [list(x) for x in self.rows]
        return result

    def to_json(self, indent=4):
        import json
        ob = self.to_json_object()
        return json.dumps(ob, indent=indent)

    def to_stand_alone_html(self, title="Multidimensional frame", size=800, indent=4, to_filepath=None):
        D = {}
        D["title"] = title
        D["json"] = self.to_json()
        D["javascript"] = self.concat_files(REQUIRED_JAVASCRIPT_LIBRARIES)
        D["style"] = self.concat_files(REQUIRED_CSS_STYLES)
        D["size"] = size
        html = STAND_ALONE_HTML_TEMPLATE % D
        if to_filepath is not None:
            open(to_filepath, "w").write(html)
        return html

    def concat_files(self, vendor_paths):
        content_list = []
        for path in vendor_paths:
            full_path = doodle_files.vendor_path(path)
            content = open(full_path).read()
            content_list.append(content)
        return "\n\n".join(content_list)

    def add_feature(self, name, index, color=None):
        self.features[name] = FeatureDescriptor(name, index, color)
        self._standardized = False

    def add_configuration(self, description):
        name = description["name"]
        assert name not in self.configurations, "duplicate config name " + repr(name)
        self.configuration_names.append(name)
        self.configurations[name] = description

    def feature_order(self):
        sorter = [(f.index, f.name) for f in self.features.values()]
        sorter = sorted(sorter)
        return [x[1] for x in sorter]

    def add_orthogonal(self, colorizer_index=None, name="Orthogonal", colors=None, vectors=None):
        #if feature_names is None:
        #    feature_names = self.feature_order()
        if vectors is None:
            vectors = [(1,0,0),(0,1,0),(0,0,1)]
        transformer = FixedTransform(vectors)
        config = self.transformer_configuration(name, transformer, colorizer_index, None, colors)
        self.add_configuration(config)

    def add_tetrahedral(self, colorizer_index=None, name="Tetrahedral", colors=None, vectors=None):
        vectors = [(1,1,1), (1,-1,-1), (-1,1,-1), (-1,-1,1) ]
        return self.add_orthogonal(colorizer_index, name, colors, vectors)

    def add_PCA(self, colorizer_index=None, name="Principal Components", abbreviation="PCA", colors=None):
        from sklearn.decomposition import PCA
        transformer = PCA(n_components=3)
        config = self.transformer_configuration(name, transformer, colorizer_index, abbreviation, colors)
        self.add_configuration(config)

    def add_Factors(self, colorizer_index=None, name="Factor Analysis", abbreviation="FA", colors=None):
        from sklearn.decomposition import FactorAnalysis
        transformer = FactorAnalysis(n_components=3, random_state=0)
        config = self.transformer_configuration(name, transformer, colorizer_index, abbreviation, colors)
        self.add_configuration(config)

    def add_ICA(self, colorizer_index=None, name="Independent Components", abbreviation="ICA", colors=None):
        from sklearn.decomposition import FastICA
        transformer = FastICA(n_components=3, random_state=0)
        config = self.transformer_configuration(name, transformer, colorizer_index, abbreviation, colors)
        self.add_configuration(config)

    def add_wheel(self, feature_name, colorizer_index=None, name="Wheel", abbreviation="Wh", colors=None):
        self.standardize()
        designated_index = self.feature_array_order.index(feature_name)
        transformer = WheelTransform(designated_index)
        config = self.transformer_configuration(name, transformer, colorizer_index, abbreviation, colors)
        self.add_configuration(config)

    def transformer_configuration(self, name, transformer, colorizer_index=None, abbreviation=None, colors=None):
        self.standardize()
        result = {}
        result["name"] = name
        result["colorizer"] = self.colorizer_mapping(colorizer_index, colors)
        if abbreviation is not None:
            alias = {}
            for (i, v) in enumerate("xyz"):
                alias[v] = abbreviation + str(i)
            result["aliases"] = alias
        # perform the fit and ignore the transformed result; use the derived components
        _ = transformer.fit_transform(self.std_feature_array)
        components = transformer.components_
        scale = self.scale
        projectors = {}
        for (i, name) in enumerate(self.feature_array_order):
            unscaled = components[:,i]
            #print("unscaled", name, unscaled)
            scaled = (1.0 / scale[i]) * unscaled
            projectors[name] = xyz_dict(scaled)
        result["projectors"] = projectors
        return result

    def standardize(self):
        if self._standardized:
            return
        std = self.std_scalar = StandardScaler()
        features = self.features
        self.feature_array_order = list(sorted(features.keys()))
        feature_indices = [features[n].index for n in self.feature_array_order]
        features_rows = [
            [r[i] for i in feature_indices]
            for r in self.rows
        ]
        self.feature_array = np.array(features_rows, dtype=np.float)
        self.std_feature_array = std.fit_transform(np.array(self.feature_array, dtype=np.float))
        self.mean = std.mean_
        self.scale = std.scale_

    def add_column(self, values):
        rows = self.rows
        assert len(rows) == len(values), "Values length must match rows."
        newrows = [list(r) + [v] for (r,v) in zip(rows, values)]
        self.rows = newrows
        return len(rows[0])  # the index of the new column

    def add_colorizer(self, values, colors=None):
        index = self.colorizer_index = self.add_column(values)
        if colors:
            # cache the colorizer mapping
            _ = self.colorizer_mapping(index, colors)

    def named_percentiles(self, from_feature_name, group_names, colors=None):
        from bisect import bisect_left
        n = len(group_names)
        assert n > 1, "must have more than one group"
        if colors is not None:
            assert len(colors) == n, "colors should match groups."
        f = self.features[from_feature_name]
        index = f.index
        rows = self.rows
        values = [r[index] for r in rows]
        svalues = list(sorted(values))
        nv = len(values)
        ngroup = nv * (1.0 / n)
        group_indices = [
            int(bisect_left(svalues, v)/ngroup) for v in values]
        percentile_names = [group_names[index] for index in group_indices]
        self.add_colorizer(percentile_names, colors)

    def colorizer_mapping(self, index=None, colors=None):
        if index is None:
            index = self.colorizer_index
        assert index is not None, "Colorizer index must be specified."
        if colors is None and self._colorizers.get(index) is not None:
            return self._colorizers[index]
        #print ("rows", self.rows)
        #print ("index", self.colorizer_index)
        values = list(sorted(set(row[index] for row in self.rows)))
        if self.sanity_limit and self.sanity_limit > 0:
            assert len(values) < self.sanity_limit, "too many values in colorizer " + repr((index, len(values)))
        mapping = {}
        for (i, v) in enumerate(values):
            if colors:
                color = colors[i]
            else:
                color = garish_color()
            mapping[v] = color
        colorizer = {}
        colorizer["mapping"] = mapping
        colorizer["index"] = index
        self._colorizers[index] = colorizer
        return colorizer

class WheelTransform:
    """
    Assign designated feature to x-axis.
    Distribute the other features in a circle on YZ plane.
    Similar API to sklearn.decomposition.PCA (but fit is trivial)
    """

    def __init__(self, designated_index=0, n_components=3):
        self.designated_index = designated_index
        self.n_components = n_components

    def fit_transform(self, data_array):
        "Compute and store the _components array."
        designated_index = self.designated_index
        (rows, cols) = data_array.shape
        n_components = self.n_components
        components = np.zeros((n_components, cols))
        dtheta = np.pi / (cols + 1)
        for i in range(cols):
            if (i == designated_index):
                proj = (1, 0, 0)
            else:
                theta = dtheta * i
                proj = (0, np.sin(theta), np.cos(theta))
            components[:,i] = np.array(proj)
        self.components_ = components
        return None

class FixedTransform:
    """
    Assign constant vectors to axes.
    Similar API to sklearn.decomposition.PCA (but fit is trivial)
    """
    
    def __init__(self, projection_vectors, n_components=3):
        self.n_components = n_components
        self.projection_vectors = np.array(projection_vectors, dtype=np.float)

    def fit_transform(self, data_array):
        "Compute and store the _components array."
        (rows, cols) = data_array.shape
        n_components = self.n_components
        components = np.zeros((n_components, cols))
        projection_vectors = self.projection_vectors
        for i in range(cols):
            j = i % len(projection_vectors)
            components[:,i] = projection_vectors[j]
        self.components_ = components
        return None

class FeatureDescriptor(object):
    def __init__(self, name, index, color=None):
        if color is None:
            color = garish_color()
        self.name = name
        self.index = index
        self.color = color
    def to_json_object(self):
        return {"name": self.name, "index": self.index, "color": self.color}


def xyz_dict(seq):
    "Mapping representation for xyz vector sequence."
    d = {}
    for (n, v) in zip("xyz", seq):
        d[n] = v
    return d

short_sample = """
    from https://www.itl.nist.gov/div898/handbook/datasets/INN.DAT
    This is file   INN.DAT         4/2/2001
Optimization of Sonoluminescent Light Intensity
Eva Wilcox and Ken Inn
Date--July 1999
2**(7-3) FRACTIONAL FACTORIAL DESIGN
(BUT NOT IDENTICAL TO PAGE 410 OF BOX-HUNTER-HUNTER
   5 = 234   6 = 134   7 = 123
Number of observations                   = 16
Total number of variables per line image = 8
Order of variables on a line image--
   Response variable = Sonoluminescent Light Intensity
   Factor 1 = Molarity (amount of Solute) (-1=.10 mol, +1=.33 mol)
   Factor 2 = Solute Type (-1=Sugar, +1=Glycerol) 
   Factor 3 = ph (-1=3, +1=11)
   Factor 4 = Gas Type in Water (-1=Helium, +1=Air)
   Factor 5 = Water Depth (-1=Half, +1=Full)
   Factor 6 = Horn Depth (-1=5 mm, +1=10 mm)
   Factor 7 = Flask Clamping (-1=Unclamped, +1=Clamped)
To read this file into Dataplot--
   SKIP 25
   READ INN.DAT Y X1 X2 X3 X4 X5 X6 X7
  Y           X1      X2      X3      X4      X5      X6      X7
Light             Solute             Gas   Water    Horn    Flask
Intensity Molarity  type     ph     Type   Depth   Depth  Clamping
------------------------------------------------------------------
 80.6       -1.0    -1.0    -1.0    -1.0    -1.0    -1.0    -1.0
 66.1        1.0    -1.0    -1.0    -1.0    -1.0     1.0     1.0
 59.1       -1.0     1.0    -1.0    -1.0     1.0    -1.0     1.0
 68.9        1.0     1.0    -1.0    -1.0     1.0     1.0    -1.0
 75.1       -1.0    -1.0     1.0    -1.0     1.0     1.0     1.0
373.8        1.0    -1.0     1.0    -1.0     1.0    -1.0    -1.0
 66.8       -1.0     1.0     1.0    -1.0    -1.0     1.0    -1.0
 79.6        1.0     1.0     1.0    -1.0    -1.0    -1.0     1.0
114.3       -1.0    -1.0    -1.0     1.0     1.0     1.0    -1.0
 84.1        1.0    -1.0    -1.0     1.0     1.0    -1.0     1.0
 68.4       -1.0     1.0    -1.0     1.0    -1.0     1.0     1.0
 88.1        1.0     1.0    -1.0     1.0    -1.0    -1.0    -1.0
 78.1       -1.0    -1.0     1.0     1.0    -1.0    -1.0     1.0
327.2        1.0    -1.0     1.0     1.0    -1.0     1.0    -1.0
 77.6       -1.0     1.0     1.0     1.0     1.0    -1.0    -1.0
 61.9        1.0     1.0     1.0     1.0     1.0     1.0     1.0
 """

def test_read_short_sample():
    sslines = short_sample.strip().split("\n")
    rows = []
    skip = True
    lastline = ""
    for line in sslines:
        if "---------" in lastline:
            skip = False
        if not skip:
            values = [int(float(s)) for s in line.split()]
            rows.append(values)
        lastline = line
    # add intensity classification
    for row in rows:
        intensity = row[0]
        classification = "Low"
        if intensity > 70:
            classification = "Medium"
        if intensity > 90:
            classification = "High"
        row.append(classification)
    fmt = FormatRows(rows, "Sonoluminescents")
    names = "Intensity Molarity Solute Ph Gas Depth Horn Flask"
    for (i, n) in enumerate(names.split()):
        fmt.add_feature(n, i)
    colors = "red green blue".split()
    fmt.add_PCA(8, name="Intensity PCA", colors=colors)
    fmt.add_ICA(8)
    fmt.add_Factors(8)
    return fmt

if __name__ == "__main__":
    from pprint import pprint
    import sys
    fmt = test_read_short_sample()
    if len(sys.argv) < 2:
        pprint (fmt.to_json_object())
    else:
        fmt.to_stand_alone_html(to_filepath=sys.argv[1])
        print("Wrote stand alone html to file " + repr(sys.argv[1]))
    