" © 2020 Jason Woofenden CC0

" 1 is plain
call prop_type_add('tsv_2', {'highlight': 'Operator'})
call prop_type_add('tsv_3', {'highlight': 'Keyword'})
call prop_type_add('tsv_4', {'highlight': 'Identifier'})
call prop_type_add('tsv_5', {'highlight': 'SpecialChar'})
call prop_type_add('tsv_6', {'highlight': 'String'})
call prop_type_add('tsv_7', {'highlight': 'Number'})
call prop_type_add('tsv_8', {'highlight': 'Error'})
call prop_type_add('tsv_9', {'highlight': 'Comment'})

" called when recieving a message from the socket
func treesittervim#sochandler(soc, msg)
    let line_number = 0
    for line in a:msg
        let line_number += 1
        let col = 1
        let i = 0
        while i < len(line)
            " loop stuff
            let color = line[i]
            let span = line[i+1]
            let i += 2
            " loop body
            if color != 1
                call prop_add(line_number, col, {'length': span, 'type': 'tsv_' . color})
            endif
            let col += span
        endwhile
    endfor
endfunc

" call this in a uncolored buffor with javascript in it
function treesittervim#main()
    " I don't think this callback works
    let soc = ch_open('localhost:33039', {'callback': "treesittervim#sochandler"})
    " this one does get called:
    call ch_sendexpr(soc, join(getline(1, '$'), "\n"), {'callback': "treesittervim#sochandler"})
endfunction
