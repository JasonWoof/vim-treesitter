// © 2020 Jason Woofenden CC0

"use strict";

// be a good little process (needed for Docker)
process.on('SIGINT', () => {
    console.log('received SIGINT, exiting');
    process.exit();
});
process.on('SIGTERM', () => {
    console.log('received SIGTERM, exiting');
    process.exit();
});

const PORT = "33039";

const net = require('net');
const TreeSitter = require('tree-sitter');
const JavaScript = require('tree-sitter-javascript');

// some types that vim can color: https://github.com/crusoexia/vim-monokai/blob/master/colors/monokai.vim
// sent to vim over the wire
const EOL = 0;
const PLAIN = 1;
const SYMBOL = 2;
const KEYWORD = 3;
const IDENTIFIER = 4;
const SPECIAL_CHAR = 5;
const STRING = 6;
const NUMBER = 7;
const ERROR = 8;
const COMMENT = 9;

const keywords = new Set('class this else return var const let for while if try throw catch function next continue break of in new'.split(' '));

const symbols = new Set('% ( ) [ ] { } , - + ; . / = == === && & | || < != <= <= >= <=> => " \' ` ${ ~ ^ * ** + - % ! '.split(' '));



// notes
//     treesitter indexes are zero based and non-inclusive
// types we care about:
//     number
//     identifier (eg function/variable name)
//     var (the actual "var")
// can ignore
//     variable_declarator (variable name after "var")
//         because this span is also flagged "identifier"
//     (, ), ;, etc
// SyntaxNode has types like "(" and ";"

class Colorizer {
    constructor (row, column) {
        this.row = row;
        this.column = column;
        this.colors = [null]; // backwards
        this.line = []; // backwards
        this.lines = [];
    }
    // distance must be > 0 or EOL
    extend_line (distance) {
        if (this.line.length === 0) {
            this.lines.push(this.line);
        }
        if (this.line.length > 0 && this.line[0].color == this.colors[0]) {
            // extend existing/current same-color section
            if (distance === EOL) {
                this.line[0].distance = EOL;
            } else {
                this.line[0].distance += distance;
            }
        } else {
            this.line.unshift({distance, color: this.colors[0]});
        }
        if (distance === EOL) {
            this.line = [];
        }
    }
    advance_to (row, column) {
        // Handle line wraps within colored area
        while (row > this.row) {
            this.extend_line(EOL);
            this.row += 1;
            this.column = 0;
        }
        if (column > this.column) {
            this.extend_line(column - this.column);
            this.column = column;
        }
    }
    start (color, row, column) {
        this.advance_to(row, column);
        this.colors.unshift(color);
    }
    end (row, column) {
        this.advance_to(row, column);
        this.colors.shift();
    }
    debug_render () {
        console.log(this.colors);
        console.log(this.lines);
        console.log(this.line);
        // return this.commands.map(c => c.join(',')).join(' ');
        return this.lines.map(line => {
            const ret = [];
            for (let i = line.length - 1; i >= 0; --i) {
                const {color, distance} = line[i];
                ret.push(" *kicsn !"[color]);
                if (distance === EOL) {
                    ret.push('$');
                } else if (distance > 1) {
                    ret.push('.'.repeat(distance - 1));
                }
            }
            return ret.join('');
        }).join(' ');
    }
    render () {
        // return this.debug_render();
        return this.lines.map((line) => line.reduceRight((ret, chunk) => {
            ret.push(chunk.color, chunk.distance);
            return ret;
        }, []));
    }
}


const source_to_colors = (source) => {
    const parser = new TreeSitter();
    parser.setLanguage(JavaScript);
    const tree = parser.parse(source);
    const root = tree.rootNode;
    // example node:
    // ProgramNode {
    //     type: program,
    //     startPosition: {row: 0, column: 0},
    //     endPosition: {row: 1, column: 0},
    //     childCount: 1,
    // }

    // traverse the parse tree and encode the relevant bits for vim
    // FIXME just recurse like a normal person. this loop is not helpful
    const colorizer = new Colorizer(root.startPosition.row, root.startPosition.column);
    const types = [];
    (function process_node(node) {
        const type = node.type;
        types.push(type);
        let color = null;
        // start of node
        if (type === 'program' || type === 'template_substitution') {
            color = PLAIN;
        } else if (type === 'number') {
            color = NUMBER;
        } else if (keywords.has(type)) {
            color = KEYWORD;
        } else if (symbols.has(type)) {
            color = SYMBOL;
        } else if (type === 'string' || type === 'template_string') {
            color = STRING;
        } else if (type === 'identifier' || type === 'property_identifier') {
            color = IDENTIFIER;
        } else if (type === 'escape_sequence') {
            color = SPECIAL_CHAR;
        } else if (type === 'ERROR') {
            color = ERROR;
        } else if (type === 'comment') {
            color = COMMENT;
        }

        if (color !== null) {
            colorizer.start(color, node.startPosition.row, node.startPosition.column);
        }

        for (let i = 0; i < node.childCount; ++i) {
            process_node(node.child(i));
        }

        types.push(`/${type}`);

        if (color !== null) {
            colorizer.end(node.endPosition.row, node.endPosition.column);
        }
    })(root);
    //console.log(types.join(' '));
    return colorizer.render();
};


const server = net.createServer((connection) => {
    console.log('connected');
    let buf = null;
    let used = 0;
    connection.on('data', (data) => {
        console.log(`got data of length ${data.length}`);
        //console.log(`got data: ${data}`);
        // check for the common case
        if (buf === null) {
            buf = data;
        } else {
            console.log('merging into existing buffer');
            buf = Buffer.concat([buf, data]);
        }
        let eol = 0;
        while ((eol = buf.indexOf("\n", used, 'binary')) > -1) {
            console.log('found newline');
            const line = buf.toString('utf8', used, eol);
            let id = null, source = null;
            try {
                [id, source] = JSON.parse(line);
            } catch (e) {
                // json parsing failed, there must be more data coming
                console.log('json parsing failed');
            }
            if (id !== null) {
                const reply = source_to_colors(source);
                connection.write(JSON.stringify([id, reply]));
                console.log('replied');
            }
            used = eol + 1;
        }
        if (used === buf.length) {
            console.log('emptying buffer');
            buf = null;
            used = 0;
        }
        // TODO if used is big, then clip it off buffer
    });
    connection.on('end', () => {
        console.log('disconnected');
    });
}).on('error', (err) => {
    throw err;
})
server.listen(PORT, () => {
    console.log(`listening on port ${PORT}`);
})
