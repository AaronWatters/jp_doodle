"""
Python wrapper and related helpers for nd_frame functionality using proxy widgets.
"""

from jp_doodle import doodle_files, dual_canvas
import jp_proxy_widget
import csv
from IPython.display import display, HTML

nd_frame_js = doodle_files.vendor_path("js/nd_frame.js")

def load_requirements(widget=None, silent=True, additional=()):
    all_files = [nd_frame_js] + list(additional)
    return dual_canvas.load_requirements(widget, silent, additional=all_files)

# Not finished...
