
[![Binder](https://mybinder.org/badge.svg)](https://mybinder.org/v2/gh/AaronWatters/jp_doodle/master)
[![Build Status](https://travis-ci.org/AaronWatters/jp_doodle.svg?branch=master)](https://travis-ci.org/AaronWatters/jp_doodle)
[![Coverage Status](https://coveralls.io/repos/github/AaronWatters/jp_doodle/badge.svg?branch=master)](https://coveralls.io/github/AaronWatters/jp_doodle?branch=master)

# `jp_doodle`

<b><code><a href="https://github.com/AaronWatters/jp_doodle">jp_doodle</a></em></code>
makes implementing special purpose interactive visualizations easy.</b>
It is designed to facilitate the development of bespoke scientific data presentation
and interactive exploration tools.

Below is a screenshot the 
<a href="https://aaronwatters.github.io/jp_doodle/095_nd_frames.html">multidimensional frames
example</a> using <code>jp_doodle</code> dual canvases.

<img src="docs/images/nd_frame.png" width="70%"/>

Please click the <a href="https://youtu.be/nyuCqlTvf0c">youtube link</a> to view
a presentation about dual canvases and related technologies.

<a href="https://youtu.be/nyuCqlTvf0c">
<img src="https://i1.ytimg.com/vi/nyuCqlTvf0c/hqdefault.jpg" width="200"/>
</a>

The `jp_doodle` package provides `jQuery` plugins which make it easy to build
interactive visualizations in Javascript.  The package also provides Jupyter widget
interfaces to make it easy to build visualizations for Jupyter notebooks.

Most demonstration code is provided as Jupyter notebooks
under the
[`./notebooks`](./notebooks) directory.
You can 
<a href="https://nbviewer.jupyter.org/github/AaronWatters/jp_doodle/tree/master/notebooks">
view `./notebooks` using `nbviewer`</a>
or use
<a href="https://mybinder.org/v2/gh/AaronWatters/jp_doodle/master">
Binder</a>
to run the notebooks interactively.  The `Tutorial`
introduces dual canvases primarily from a Javascript
perspective.  The `Simple Python Examples` shows
some examples of using dual canvases in Jupyter widgets
using only the Python interface.  The `Feature demonstrations` sub-directory provides many other examples of how to use
the various features of dual canvases both in the Javascript and the Python contexts.


# Installation

To install the package for use with Jupyter please install
`jp_proxy_widget` first and enable it.  To install either use

```
pip install jp_proxy_widget
```

Or use

```
python -m pip install jp_proxy_widget
```

Then enable `jp_proxy_widget` as a notebook extension

```
jupyter nbextension enable --py --sys-prefix jp_proxy_widget
```


For jupyterlab also do

```
jupyter labextension install jp_proxy_widget
```

The following must have been run once at sometime in the past:

```
jupyter labextension install @jupyter-widgets/jupyterlab-manager
```

Then install `jp_doodle` from github

```
pip install git+https://github.com/aaronwatters/jp_doodle
```

Or if that doesn't work

```
python -m pip install git+https://github.com/aaronwatters/jp_doodle
```

or similar.

# `dual_canvas`

The `dual_canvas` jQuery component of the `jp_doodle` package supports implementing
visualizations using two dimensional HTML5 canvas elements.  It provides

- Graphical object creation, deletion, mutation, and smooth feature transitions.

- Managed coordinate spaces including the pixel coordinate space, the canvas coordinate space
and reference frame coordinate spaces.

- Local and global event coordination to identify objects under positional mouse events and
relative event coordinate transformations.

- Bounding box calculation and canvas fitting support.

- Axis creation helpers.

- A built in "lasso tool" for selecting multiple objects in a canvas.

- Animation support.



DEMOS_HERE

