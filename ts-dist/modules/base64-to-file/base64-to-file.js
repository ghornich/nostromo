// @ts-nocheck
'use strict';
exports = module.exports = function (fileData) {
    const binary = atob(fileData.base64);
    const uint8Array = new Uint8Array(binary.length);
    for (let i = 0, len = binary.length; i < len; i++) {
        uint8Array[i] = binary.charCodeAt(i);
    }
    return new File([uint8Array], fileData.name, { type: fileData.type });
};
