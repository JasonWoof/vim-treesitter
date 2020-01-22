# build with: docker build -t vim-treesitter:v1 .

FROM node:latest

RUN npm install tree-sitter tree-sitter-javascript tree-sitter-php tree-sitter-bash tree-sitter-json
