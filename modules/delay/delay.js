'use strict';

exports = module.exports = function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
};
