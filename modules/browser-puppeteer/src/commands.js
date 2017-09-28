'use strict'

/**
 * Command type constants
 * @enum {String}
 */
exports = module.exports = {
    CLICK: 'click',
    SET_VALUE: 'setValue',
    GET_VALUE: 'getValue',
    PRESS_KEY: 'pressKey',
    SCROLL: 'scroll',
    MOUSEOVER: 'mouseover',
    WAIT_FOR_VISIBLE: 'waitForVisible',
    WAIT_WHILE_VISIBLE: 'waitWhileVisible',
    FOCUS: 'focus',
    IS_VISIBLE: 'isVisible',
    ASSERT: 'assert',
    COMPOSITE: 'composite',
    UPLOAD_FILE_AND_ASSIGN: 'uploadFileAndAssign',
};

/**
 * @memberOf BrowserPuppetCommands
 * @typedef {Object} Command
 */

/**
 * @typedef {Command} CompositeCommand
 * @property {String} type - 'composite'
 * @property {Array<Command>} commands
 */

/**
 * @typedef {Command} ScrollCommand
 * @property {String} type - 'scroll'
 * @property {String} selector
 * @property {Number} scrollTop
 */

/**
 * @typedef {Command} MouseoverCommand
 * @property {String} type - 'mouseover'
 * @property {String} selector
 */

/**
 * @typedef {Command} WaitForVisibleCommand
 * @property {String} type - 'waitForVisible'
 * @property {String} selector
 * @property {Number} [pollInterval = 500]
 * @property {Number} [timeout = 10000]
 */

/**
 * @typedef {Command} WaitWhileVisibleCommand
 * @property {String} type - 'waitWhileVisible'
 * @property {String} selector
 * @property {Number} [pollInterval = 500]
 * @property {Number} [initialDelay = 500]
 * @property {Number} [timeout = 10000]
 */

/**
 * @typedef {Command} ClickCommand
 * @property {String} type - 'click'
 * @property {String} selector
 */

/**
 * @typedef {Command} PressKeyCommand
 * @property {String} type - 'pressKey'
 * @property {String} selector
 * @property {Number} keyCode
 */

/**
 * @typedef {Command} SetValueCommand
 * @property {String} type - 'setValue'
 * @property {String} selector
 * @property {String} value
 */

/**
 * @typedef {Command} FocusCommand
 * @property {String} type - 'focus'
 * @property {String} selector
 */

/**
 * @typedef {Command} GetValueCommand
 * @property {String} type - 'getValue'
 * @property {String} selector
 */

/**
 * @typedef {Command} IsVisibleCommand
 * @property {String} type - 'isVisible'
 * @property {String} selector
 */

/**
 * @typedef {Command} UploadFileAndAssignCommand
 * @property {String} type - 'uploadFileAndAssign'
 * @property {String} selector - unique selector of the file input node
 * @property {Object} fileData
 * @property {String} fileData.base64 - base64 encoded file
 * @property {String} fileData.name
 * @property {String} [fileData.mime] - default: {@link DEFAULT_UPLOAD_FILE_MIME}
 * @property {String} destinationVariable - e.g. `'app.files.someFile'` assigns a `File` instance to `window.app.files.someFile` 
 */
