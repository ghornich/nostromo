'use strict';

var COMMANDS = require('../../../modules/browser-puppeteer/src/puppet/browser-puppet-commands.partial').COMMANDS;
var CLICK_FOCUS_MIN_SEPARATION = 200;

exports = module.exports = CommandList;

function CommandList(commands) {
    this._commands = commands || [];
    this._compact();
}

CommandList.prototype._compact = function () {
    if (this._commands.length === 0) {
        return;
    }

    var newCommands = [];

    for (var i = 0, len = this._commands.length; i < len; i++) {
        var lastNewIdx = newCommands.length - 1;
        var lastNewCmd = lastNewIdx >= 0 ? newCommands[lastNewIdx] : null;
        var cmd = this._commands[i];

        if (newCommands.length === 0) {
            newCommands.push(cmd);
            continue;
        }

        var timestampDiff = Math.abs(cmd.$timestamp - lastNewCmd.$timestamp);

        if ((cmd.type === COMMANDS.CLICK && lastNewCmd.type === COMMANDS.FOCUS || cmd.type === COMMANDS.FOCUS && lastNewCmd.type === COMMANDS.CLICK) &&
                timestampDiff < CLICK_FOCUS_MIN_SEPARATION && stringsSimilar(cmd.$fullSelectorPath, lastNewCmd.$fullSelectorPath)) {
            // insert composite command
            newCommands[lastNewIdx] = {
                type: COMMANDS.COMPOSITE,
                commands: [lastNewCmd, cmd],
            };
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

function stringsSimilar(a, b) {
    return a.indexOf(b) >= 0 || b.indexOf(a) >= 0;
}


