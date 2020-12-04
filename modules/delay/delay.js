'use strict';

exports = module.exports = async function delay(ms) {
    if (ms === 0) {
        return;
    }

    return new Promise(r => setTimeout(r, ms));
};
