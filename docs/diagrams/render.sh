#!/usr/bin/env sh
# Render architecture.dot to PNG and SVG. Requires Graphviz (`apt-get install graphviz`).
set -e
cd "$(dirname "$0")"
dot -Tpng -Gdpi=110 architecture.dot -o architecture.png
dot -Tsvg architecture.dot -o architecture.svg
echo "Rendered architecture.png and architecture.svg"
