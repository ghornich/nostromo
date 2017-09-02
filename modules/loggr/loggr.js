var os = require('os');

module.exports = Loggr;

// Apache Log4j 2 levels
var LEVELS = Loggr.LEVELS = {
    OFF: 0,
    FATAL: 1,
    ERROR: 2,
    WARN: 3,
    INFO: 4,
    DEBUG: 5,
    TRACE: 6,
    ALL: Number.POSITIVE_INFINITY,
};

var STRING_LEVELS_MAP = {
    off: LEVELS.OFF,
    fatal: LEVELS.FATAL,
    error: LEVELS.ERROR,
    warn: LEVELS.WARN,
    info: LEVELS.INFO,
    debug: LEVELS.DEBUG,
    trace: LEVELS.TRACE,
    all: LEVELS.ALL,
};

var browserConsoleStream = {
    write: console.log.bind(console),
};

function Loggr(conf) {
    this._conf = Object.assign({
        logLevel: LEVELS.INFO,
        showTime: true,
        namespace: null,
        outStream: process.stdout || browserConsoleStream,
        eol: os.EOL,
    }, conf);

    if (typeof this._conf.logLevel === 'string') {
        var logLevelLower = this._conf.logLevel.toLowerCase();

        if (logLevelLower in STRING_LEVELS_MAP) {
            this._conf.logLevel = STRING_LEVELS_MAP[logLevelLower];
        }
        else {
            throw new Error('Loggr: unknown logLevel string "'+this._conf.logLevel+'"');
        }
    }
}

Loggr.prototype.fork = function (newNamespace) {
    var newConf = Object.assign({}, this._conf, {
        namespace: newNamespace,
    });

    return new Loggr(newConf);
};

Loggr.prototype._log = function (level, messages) {
    if (level <= this._conf.logLevel) {
        var time = '';
        var namespace = '';

        if (this._conf.showTime) {
            var d = new Date();
            var h = ('0' + d.getHours()).slice(-2);
            var m = ('0' + d.getMinutes()).slice(-2);
            var s = ('0' + d.getSeconds()).slice(-2);
            var ms = ('00' + d.getMilliseconds()).slice(-3);

            time = '[' + h + ':' + m + ':' + s + '.' + ms + '] ';
        }

        if (this._conf.namespace) {
            namespace = '[' + this._conf.namespace + '] ';
        }

        var message = messages
        .map(function (msg) {
            return String(msg);
        })
        .join(' ');

        var levelStr = Loggr.getLevelChar(level) + ' ';

        this._conf.outStream.write(time + levelStr + namespace + message + this._conf.eol);
    }
};

Loggr.prototype.fatal = function () {
    this._log(LEVELS.FATAL, Array.prototype.slice.call(arguments));
};

Loggr.prototype.error = function () {
    this._log(LEVELS.ERROR, Array.prototype.slice.call(arguments));
};

Loggr.prototype.warn = function () {
    this._log(LEVELS.WARN, Array.prototype.slice.call(arguments));
};

Loggr.prototype.info = function () {
    this._log(LEVELS.INFO, Array.prototype.slice.call(arguments));
};

Loggr.prototype.debug = function () {
    this._log(LEVELS.DEBUG, Array.prototype.slice.call(arguments));
};

Loggr.prototype.trace = function () {
    this._log(LEVELS.TRACE, Array.prototype.slice.call(arguments));
};

Loggr.getLevelChar = function (level) {
    switch (level) {
        case LEVELS.FATAL: return 'F';
        case LEVELS.ERROR: return 'E';
        case LEVELS.WARN: return 'W';
        case LEVELS.INFO: return 'I';
        case LEVELS.DEBUG: return 'D';
        case LEVELS.TRACE: return 'T';
        default: return '?';
    }
};
