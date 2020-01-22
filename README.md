# Vim async coloring experiment

This is an experiment to see if it might be practical to do vim syntax coloring asynchronously.

In this experiment, vim communicates over a network socket, sending buffer contents. The server runs the buffer contents through treesitter, and replies with coloring instructions.


## Setup

1. Build the docker image for the server: `docker build -t vim-treesitter:v1 .`

2. Copy `treesittervim.vim` into `~/.vim/autoload/` (create that directory if needed)


## Try it

1. Run the server: ./run-in-docker.sh

2. Open a javascript file, or paste some javascript code into an empty buffer

3. Disable syntax highlighting if there is any, eg by running `:set ft=txt`

4. In vim, do: `:call treesittervim#main()`


## Status

Maturity: experiment.

Currently it does the simplest thing that could possibly work. It simply sends the entire buffer contents to the server, then executes the coloring instructions for the whole buffer. When the buffer is large, there is a considerable delay (non-responsive interface) while the vimscript applies the coloring instructions. This should be fixable at least for common use cases (eg by not applying the colors immediately to lines which are not visible).
