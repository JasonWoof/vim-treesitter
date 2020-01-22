#!/bin/bash

exec docker run -p 127.0.0.1:33039:33039 -t -i --rm -v "$(readlink -f "$(dirname "$0")")/server.js":/opt/server.js:ro -w /opt/pwd vim-treesitter:v1 node "/opt/server.js"
