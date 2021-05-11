'use strict';
// TODO support ES6 arrow fns
var JSONF = exports;
JSONF.stringify = function (o) {
    return JSON.stringify(o, function (key, val) {
        if (typeof val === 'function' || val instanceof RegExp) {
            return val.toString();
        }
        return val;
    });
};
JSONF.parse = function (s) {
    return JSON.parse(s, function (key, val) {
        try {
            if (isStringAFunction(val)) {
                return parseFunction(val);
            }
            if (isStringARegExp(val)) {
                return parseRegExp(val);
            }
        }
        catch (e) {
            // TODO throw a big fat error?
            console.error('JSONF error', val, e);
            return val;
        }
        return val;
    });
};
function isStringAFunction(s) {
    return /^function\s*\(/.test(s) ||
        /^function\s+[a-zA-Z0-9_$]+\s*\(/.test(s);
}
function isStringARegExp(s) {
    return /^\/.+\/[gimuy]*$/.test(s);
}
function parseFunction(s) {
    // eslint-disable-next-line no-new-func
    return new Function(
    // http://www.kristofdegrave.be/2012/07/json-serialize-and-deserialize.html
    s.match(/\(([^)]*)\)/)[1], s.match(/\{([\s\S]*)\}/)[1]);
}
function parseRegExp(s) {
    var matches = /\/(.+)\/([gimuy]*)/.exec(s);
    return new RegExp(matches[1], matches[2]);
}
