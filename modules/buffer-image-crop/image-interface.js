'use strict';

const ImageInterface = exports;

ImageInterface._errors = [];

/**
 * @return {Array<String>}
 */
ImageInterface.getErrors = function () {
    return deepCopy(ImageInterface._errors);
};

ImageInterface.test = function (object) {
    const errors = ImageInterface._errors = [];

    if (typeof object !== 'object') {
        errors.push([]);
    }
    else {
        // TODO
    }

    return errors.length === 0;
};




function deepCopy(o) {
    return JSON.parse(JSON.stringify(o));
}
