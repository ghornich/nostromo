'use strict'
const test=require('tape')
const Loggr=require('../loggr')
test('Loggr newline handling',t=>{
    let output=''
    const outStream={write:v=>{output+=v}}
    const loggr=new Loggr({
        logLevel: Loggr.LEVELS.ALL,
        showTime: true,
        namespace: 'Test',
        outStream,
        eol: '\r\n',
        indent: '    ',
    })

    loggr.trace(
        'Test error\nLine 89\r\nFile: dummyfile.js',
        '...',
        '\nat callDummyFile() (dummyfile.js:105)\nat run() (dummyfile.js:23)\n'
    )

    const expected=
        '    [00:00:00.000] T [Test] Test error\r\n'+
        '        Line 89\r\n'+
        '        File: dummyfile.js ... \r\n'+
        '        at callDummyFile() (dummyfile.js:105)\r\n'+
        '        at run() (dummyfile.js:23)\r\n'

    output = output.replace(/\[\d{2}:\d{2}:\d{2}\.\d{3}\]/, '[00:00:00.000]')

    t.equals(output, expected)

    t.end()
})


