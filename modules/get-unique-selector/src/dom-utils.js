'use strict';

var DOMUtils = exports;

DOMUtils.hasId = function (node) {
    return Boolean(node && typeof node.id === 'string' && node.id.trim().length > 0);
};

DOMUtils.getId = function (node) {
    return node.id.trim();
};

DOMUtils.hasClass = function (node) {
    return Boolean(node && typeof node.className === 'string' && node.className.trim().length > 0);
};

DOMUtils.getClass = function (node) {
    return node.className.trim();
};
