
# Commands to convert formats when notebooks have been properly prepared and executed.
# The notebook should be "run all" with
#   eg.DO_EMBEDDINGS = True
# And then editted back to
#   eg.DO_EMBEDDINGS = False
# And then saved.

jupyter nbconvert --to html Dual\ canvas\ python\ quick\ reference.ipynb
jupyter nbconvert --to markdown Dual\ canvas\ python\ quick\ reference.ipynb

jupyter nbconvert --to html Dual\ canvas\ Javascript\ quick\ reference.ipynb
jupyter nbconvert --to markdown Dual\ canvas\ Javascript\ quick\ reference.ipynb

