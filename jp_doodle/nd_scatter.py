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

class FormatRows:

    def __init__(self, rows, prefix="Scatter plot", sanity_limit=10):
        self.rows = rows
        self.sanity_limit = sanity_limit
        self.features = {}
        self.configuration_names = []
        self.configurations = {}
        self._standardized = False
        self._colorizers = {}

    def as_widget(self):
        return ND_Scatter_Widget(self.to_json_object())

    def to_json_object(self):
        result = {}
        result["features"] = [self.features[n].to_json_object() for n in sorted(self.features.keys())]
        #result["configurations"] = [self.configurations[n].to_json_object() for n in self.configuration_names]
        result["configurations"] = [self.configurations[n] for n in self.configuration_names]
        result["points"] = [list(x) for x in self.rows]
        return result

    def add_feature(self, name, index, color=None):
        self.features[name] = FeatureDescriptor(name, index, color)
        self._standardized = False

    def add_configuration(self, description):
        name = description["name"]
        assert name not in self.configurations, "duplicate config name " + repr(name)
        self.configuration_names.append(name)
        self.configurations[name] = description

    def add_PCA(self, colorizer_index, name="Principal Components", abbreviation="PCA", colors=None):
        from sklearn.decomposition import PCA
        transformer = PCA(n_components=3)
        config = self.transformer_configuration(name, transformer, colorizer_index, abbreviation, colors)
        self.add_configuration(config)

    def transformer_configuration(self, name, transformer, colorizer_index, abbreviation=None, colors=None):
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

    def colorizer_mapping(self, index, colors=None):
        if colors is None and self._colorizers.get(index) is not None:
            return self._colorizers[index]
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
    fmt.add_PCA(8, name="Intensity PCA")
    return fmt

if __name__ == "__main__":
    from pprint import pprint
    fmt = test_read_short_sample()
    pprint (fmt.to_json_object())
    