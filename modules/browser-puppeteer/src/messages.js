exports.UPSTREAM = {
    // { type, selector, [warning] }
    SELECTOR_BECAME_VISIBLE: 'selector-became-visible',

    // { type, event: { type, timestamp, [selector,] [target,] ... } }
    CAPTURED_EVENT: 'captured-event',

    // general acknowledgement { type, result }
    ACK: 'ack',

    // general failure { type, error }
    NAK: 'nak',

    // insert assertion
    INSERT_ASSERTION: 'insert-assertion',
};

exports.DOWNSTREAM = {
    // { type, execId, command: { type, ... } }
    EXEC_COMMAND: 'exec-command',

    // { type, ??? }
    EXEC_FUNCTION: 'exec-function',

    // { type, selectors }
    SET_SELECTOR_BECAME_VISIBLE_DATA: 'set-selector-became-visible-data',

    // TODO use SET_*
    // { type }
    SHOW_SCREENSHOT_MARKER: 'show-screenshot-marker',
    HIDE_SCREENSHOT_MARKER: 'hide-screenshot-marker',

    // { type, value }
    SET_TRANSMIT_EVENTS: 'set-transmit-events',

    // { type }
    TERMINATE_PUPPET: 'terminate-puppet',

    // { type, url }
    REOPEN_URL: 'reopen-url',

    // { type, selectors }
    SET_MOUSEOVER_SELECTORS: 'set-mouseover-selectors',

    // { type, classes }
    SET_IGNORED_CLASSES: 'set-ignored-classes',
};
