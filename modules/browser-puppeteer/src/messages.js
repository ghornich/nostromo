'use strict';

/**
 * @enum {String}
 */
exports.UPSTREAM = {
    // { type, selector, [warning] }
    SELECTOR_BECAME_VISIBLE: 'selector-became-visible',
    CAPTURED_EVENT: 'captured-event',
    ACK: 'ack',
    NAK: 'nak',
    INSERT_ASSERTION: 'insert-assertion',
    CONSOLE_PIPE: 'console-pipe',
};

/**
 * @enum {String}
 */
exports.DOWNSTREAM = {
    EXEC_COMMAND: 'exec-command',

    // { type, ??? }
    EXEC_FUNCTION: 'exec-function',
    SET_SELECTOR_BECAME_VISIBLE_DATA: 'set-selector-became-visible-data',
    SET_TRANSMIT_EVENTS: 'set-transmit-events',
    TERMINATE_PUPPET: 'terminate-puppet',
    CLEAR_PERSISTENT_DATA: 'clear-persistent-data',
    SET_MOUSEOVER_SELECTORS: 'set-mouseover-selectors',
    SET_IGNORED_CLASSES: 'set-ignored-classes',
    SET_UNIQUE_SELECTOR_OPTIONS: 'set-unique-selector-options',
};

/**
 * @typedef {Object} ControlMessage
 */

/**
 * Upstream: from client (browser) to server
 * @typedef {ControlMessage} UpstreamControlMessage
 */

/**
 * Downstream: from server to client (browser)
 * @typedef {ControlMessage} DownstreamControlMessage
 */

/**
 * @typedef {UpstreamControlMessage} SelectorBecameVisibleMessage
 * @property {String} type - 'selector-became-visible'
 * @property {String} selector
 */

/**
 * @typedef {UpstreamControlMessage} CapturedEventMessage
 * @property {String} type - 'captured-event'
 * @property {Object} event
 * @property {String} event.type
 * @property {Number} event.$timestamp
 * @property {String} [event.selector]
 * @property {String} event.$fullSelectorPath
 * @property {Object} [event.target]
 */

/**
 * @typedef {UpstreamControlMessage} AckMessage
 * @property {String} type - 'ack'
 * @property {*} result
 */

/**
 * @typedef {UpstreamControlMessage} NakMessage
 * @property {String} type - 'nak'
 * @property {Object} error
 * @property {String} error.message
 */

/**
 * @typedef {UpstreamControlMessage} InsertAssertionMessage
 * @property {String} type - 'insert-assertion'
 */

/**
 * @typedef {UpstreamControlMessage} ConsolePipeMessage
 * @property {String} type - 'console-pipe'
 * @property {String} messageType - 'info', 'log', 'warn', 'error'
 * @property {String} message
 */

/**
 * @typedef {DownstreamControlMessage} ExecCommandMessage
 * @property {String} type - 'exec-command'
 * @property {Command} command
 */

/**
 * @typedef {DownstreamControlMessage} ExecFunctionMessage
 * @property {String} type - 'exec-function'
 * @property {Function} fn - to stringify this, use fn.toString(). Currently accepts ES5 function literals only (function () {...})
 * @property {Array<Any>} args - values passed to `fn`
 */

/**
 * @typedef {DownstreamControlMessage} SetSelectorBecameVisibleDataMessage
 * @property {String} type - 'set-selector-became-visible-data'
 * @property {Array<String>} selectors
 */

/**
 * @typedef {DownstreamControlMessage} SetTransmitEventsMessage
 * @property {String} type - 'set-transmit-events'
 * @property {Boolean} value
 */

/**
 * @typedef {DownstreamControlMessage} TerminatePuppetMessage
 * @property {String} type - 'terminate-puppet'
 */

/**
 * @typedef {DownstreamControlMessage} ClearPersistentDataMessage
 * @property {String} type - 'clear-persistent-data'
 */

/**
 * @typedef {DownstreamControlMessage} SetMouseoverSelectorsMessage
 * @property {String} type - 'set-mouseover-selectors'
 * @property {Array<String>} selectors
 */

/**
 * @typedef {DownstreamControlMessage} SetIgnoredClassesMessage
 * @property {String} type - 'set-ignored-classes'
 * @property {Array<String>} classes
 */

// TODO test

/**
 * @typedef {DownstreamControlMessage} SetUniqueSelectorOptionsMessage
 * @property {String} type - 'set-unique-selector-options'
 * @property {UniqueSelectorOptions} options
 */
