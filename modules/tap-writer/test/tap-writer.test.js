'use strict';

const TapWriter = require('../index.js');

test('version', () => {
    const outStream = createDummyWriteStream();
    const writer = new TapWriter({ eol: '\n', outStream: outStream });

    writer.version(12);

    expect(outStream.data).toBe('TAP version 12\n');

    outStream.data = '';

    writer.version();

    expect(outStream.data).toBe('TAP version 13\n');
});

test('diagnostic', () => {
    const outStream = createDummyWriteStream();
    const writer = new TapWriter({ eol: '\n', outStream: outStream });

    writer.diagnostic('Space, it says, is big. Really big.');

    expect(outStream.data).toBe('# Space, it says, is big. Really big.\n');
});

test('pass 1', () => {
    const outStream = createDummyWriteStream();
    const writer = new TapWriter({ eol: '\n', outStream: outStream });

    writer.pass({ type: 'ok' });
    writer.pass({ type: 'notOk' });
    writer.pass({ type: 'equal' });
    writer.pass({ type: 'notEqual' });
    writer.pass({ type: 'deepEqual' });
    writer.pass({ type: 'notDeepEqual' });
    writer.pass({ type: 'throws' });
    writer.pass({ type: 'doesNotThrow' });

    const expected =
        'ok 1 should be truthy\n' +
        'ok 2 should be falsy\n' +
        'ok 3 should be equal\n' +
        'ok 4 should\'t be equal\n' +
        'ok 5 should be deep equal\n' +
        'ok 6 shouldn\'t be deep equal\n' +
        'ok 7 should throw\n' +
        'ok 8 shouldn\'t throw\n';

    expect(outStream.data).toBe(expected);
});

test('pass 2', () => {
    const outStream = createDummyWriteStream();
    const writer = new TapWriter({ eol: '\n', outStream: outStream });

    writer.pass({ type: 'ok', message: 'a' });
    writer.pass({ type: 'notOk', message: 'b' });
    writer.pass({ type: 'equal', message: 'c' });
    writer.pass({ type: 'notEqual', message: 'd' });
    writer.pass({ type: 'deepEqual', message: 'e' });
    writer.pass({ type: 'notDeepEqual', message: 'f' });
    writer.pass({ type: 'throws', message: 'g' });
    writer.pass({ type: 'doesNotThrow', message: 'h' });

    const expected =
        'ok 1 a\n' +
        'ok 2 b\n' +
        'ok 3 c\n' +
        'ok 4 d\n' +
        'ok 5 e\n' +
        'ok 6 f\n' +
        'ok 7 g\n' +
        'ok 8 h\n';

    expect(outStream.data).toBe(expected);
});

test('fail', () => {
    const outStream = createDummyWriteStream();
    const writer = new TapWriter({ eol: '\n', outStream: outStream });

    writer.fail({ type: 'ok', expected: 1, actual: 'b' });
    writer.fail({ type: 'notOk', expected: 1, actual: 'b' });
    writer.fail({ type: 'equal', expected: 1, actual: 'b' });
    writer.fail({ type: 'notEqual', expected: 1, actual: 'b' });
    writer.fail({ type: 'deepEqual', expected: 1, actual: 'b' });
    writer.fail({ type: 'notDeepEqual', expected: 1, actual: 'b' });
    writer.fail({ type: 'throws', expected: 1, actual: 'b' });
    writer.fail({ type: 'doesNotThrow', expected: 1, actual: 'b' });

    const expected =
        'not ok 1 should be truthy\n' +
            '  ---\n' +
            '    operator: ok\n' +
            '    expected: 1\n' +
            '    actual:   "b"\n' +
            '  ...\n' +
        'not ok 2 should be falsy\n' +
            '  ---\n' +
            '    operator: notOk\n' +
            '    expected: 1\n' +
            '    actual:   "b"\n' +
            '  ...\n' +
        'not ok 3 should be equal\n' +
            '  ---\n' +
            '    operator: equal\n' +
            '    expected: 1\n' +
            '    actual:   "b"\n' +
            '  ...\n' +
        'not ok 4 should\'t be equal\n' +
            '  ---\n' +
            '    operator: notEqual\n' +
            '    expected: 1\n' +
            '    actual:   "b"\n' +
            '  ...\n' +
        'not ok 5 should be deep equal\n' +
            '  ---\n' +
            '    operator: deepEqual\n' +
            '    expected: 1\n' +
            '    actual:   "b"\n' +
            '  ...\n' +
        'not ok 6 shouldn\'t be deep equal\n' +
            '  ---\n' +
            '    operator: notDeepEqual\n' +
            '    expected: 1\n' +
            '    actual:   "b"\n' +
            '  ...\n' +
        'not ok 7 should throw\n' +
            '  ---\n' +
            '    operator: throws\n' +
            '    expected: 1\n' +
            '    actual:   "b"\n' +
            '  ...\n' +
        'not ok 8 shouldn\'t throw\n' +
            '  ---\n' +
            '    operator: doesNotThrow\n' +
            '    expected: 1\n' +
            '    actual:   "b"\n' +
            '  ...\n';

    expect(outStream.data).toBe(expected);
});

test('plan', () => {
    const outStream = createDummyWriteStream();
    const writer = new TapWriter({ eol: '\n', outStream: outStream });

    writer.pass({ type: 'ok' });
    writer.pass({ type: 'ok' });
    writer.pass({ type: 'ok' });

    outStream.data = '';

    writer.plan();
    writer.plan(45);

    expect(outStream.data).toBe('1..3\n1..45\n');
});

test('bailout', () => {
    const outStream = createDummyWriteStream();
    const writer = new TapWriter({ eol: '\n', outStream: outStream });

    writer.bailout();
    writer.bailout('Oops!');

    expect(outStream.data).toBe('Bail out!\nBail out! Oops!\n');
});

test('comment', () => {
    const outStream = createDummyWriteStream();
    const writer = new TapWriter({ eol: '\n', outStream: outStream });

    writer.comment('Speedy thing goes in, speedy thing comes out.');

    expect(outStream.data).toBe('  Speedy thing goes in, speedy thing comes out.\n');
});

test('options', () => {
    const outStream = createDummyWriteStream();
    const writer = new TapWriter({ eol: '\r\n', indent: '    ', outStream: outStream });

    writer.fail({ type: 'equal', expected: 1, actual: 2 });

    const expected = 'not ok 1 should be equal\r\n' +
        '    ---\r\n' +
        '        operator: equal\r\n' +
        '        expected: 1\r\n' +
        '        actual:   2\r\n' +
        '    ...\r\n';

    expect(expected).toBe(outStream.data);
});

/* test('', t=>{
    var outStream = createDummyWriteStream()
    var writer=new TapWriter({eol:'\n', outStream:outStream})



    t.end()
})*/

test('_aliasedMap', () => {
    const map = TapWriter._aliasedMap({
        a: 5,
        'b, c': 10,
        'd,e,f': 15,
        'asdf,    qwerty,   uiop': 20,
    });

    expect(map).toStrictEqual({
        a: 5,
        b: 10,
        c: 10,
        d: 15,
        e: 15,
        f: 15,
        asdf: 20,
        qwerty: 20,
        uiop: 20,
    });

});

function createDummyWriteStream() {
    return { data: '', write: function (s) {
        this.data += s;
    } };
}
