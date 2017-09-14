exports = module.exports = Command;

// TODO move this to BrowserPuppetCommands

// TODO replace magic strings everywhere

// eslint-disable-next-line no-unused-vars
var TYPES = Command.TYPES = {
    CLICK: 'click',
    SET_VALUE: 'setValue',
    PRESS_KEY: 'pressKey',
    SCROLL: 'scroll',
    WAIT_FOR_VISIBLE: 'waitForVisible',
    WAIT_WHILE_VISIBLE: 'waitWhileVisible',
    FOCUS: 'focus',
    ASSERT: 'assert',
    COMPOSITE: 'composite',
    UPLOAD_FILE_AND_ASSIGN: 'uploadFileAndAssign',
};

function Command() {}
