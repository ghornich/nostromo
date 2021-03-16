'use strict';

const COMMANDS = require('../../../modules/browser-puppeteer').COMMANDS;

exports = module.exports = CommandList;

/**
 *
 * @param {Object} opts
 * @param {Array<String>} opts.compositeEvents
 * @param {Number} opts.compositeEventsThreshold
 */
function CommandList(opts) {
    this._opts = opts;
    this._commands = [];
    this._compact();
}

CommandList.prototype._compact = function () {
    if (this._commands.length === 0) {
        return;
    }

    const newCommands = [];

    for (let i = 0, len = this._commands.length; i < len; i++) {
        const lastNewIdx = newCommands.length - 1;
        const lastNewCmd = lastNewIdx >= 0 ? newCommands[lastNewIdx] : null;
        const cmd = this._commands[i];

        if (newCommands.length === 0) {
            newCommands.push(cmd);
            continue;
        }

        const eventsInCompositeThreshold = Math.abs(cmd.$timestamp - lastNewCmd.$timestamp) < this._opts.compositeEventsThreshold;
        const cmdInComposite = this._opts.compositeEvents.indexOf(cmd.type) >= 0;
        const lastNewCmdInComposite = this._opts.compositeEvents.indexOf(lastNewCmd.type) >= 0;

        if (cmd.type !== lastNewCmd.type && cmdInComposite && lastNewCmdInComposite && eventsInCompositeThreshold) {
            if (this._opts.compositeEventsComparator(cmd, lastNewCmd)) {
                // insert composite command
                newCommands[lastNewIdx] = {
                    type: COMMANDS.COMPOSITE,
                    commands: [lastNewCmd, cmd],
                };
            }
            else {
                newCommands.push(cmd);
            }
        }
        else if (cmd.type === COMMANDS.SET_VALUE && lastNewCmd.type === COMMANDS.SET_VALUE && cmd.selector === lastNewCmd.selector) {
            newCommands[lastNewIdx] = cmd;
        }

        else if (cmd.type === COMMANDS.FOCUS && lastNewCmd.type === COMMANDS.FOCUS && cmd.selector === lastNewCmd.selector) {
            newCommands[lastNewIdx] = cmd;
        }
        // TODO ???????
        // else if (cmd.type===COMMANDS.SCROLL && lastNewCmd.type===COMMANDS.SCROLL && cmd.selector===lastNewCmd.selector) {
        //     newCommands[lastNewIdx]=cmd
        // }
        else if (cmd.type === COMMANDS.ASSERT && lastNewCmd.type === COMMANDS.ASSERT) {
            continue;
        }
        else if (cmd.type === COMMANDS.UPLOAD_FILE_AND_ASSIGN && lastNewCmd.type === COMMANDS.UPLOAD_FILE_AND_ASSIGN) {
            continue;
        }
        else {
            newCommands.push(cmd);
        }
    }

    this._commands = newCommands;
};

CommandList.prototype.get = function (i) {
    return this._commands[i];
};

CommandList.prototype.getList = function () {
    // TODO deep defensive copy?
    return this._commands.slice();
};

CommandList.prototype.add = function (cmd) {
    this._commands.push(cmd);
    this._compact();
};

CommandList.prototype.forEach = function (iteratee) {
    this._commands.forEach(iteratee);
};

CommandList.prototype.map = function (iteratee) {
    return this._commands.map(iteratee);
};

CommandList.prototype.clear = function () {
    this._commands = [];
};
