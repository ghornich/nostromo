'use strict';

// TODO support ES6 arrow fns

var JSONF = exports;

JSONF.stringify = function (o) {
    return JSON.stringify(o, function (key, val) {
        if (typeof val === 'function') {
            return val.toString();
        }

        return val;
    });
};

JSONF.parse = function (s) {
    return JSON.parse(s, function (key, val) {
        if (isStringAFunction(val)) {
            try {
                return new Function(
                    // http://www.kristofdegrave.be/2012/07/json-serialize-and-deserialize.html
                    val.match(/\(([^)]*)\)/)[1],
                    val.match(/\{([\s\S]*)\}/)[1]
                );
            }
            catch (e) {
                // TODO throw a big fat error?
                console.log('JSONF err: ' + val);
                console.error(e);
                return val;
            }
        }

        return val;
    });
};

function isStringAFunction(s) {
    return /^function\s*\(/.test(s) ||
        /^function\s+[a-zA-Z0-9_$]+\s*\(/.test(s);
}
