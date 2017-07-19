var os = require('os');

module.exports = Loggr;

var LEVELS = Loggr.LEVELS = {
    OFF: 0,
    INFO: 1,
    DEBUG: 2,
    TRACE: 3,
    ALL: Number.POSITIVE_INFINITY,
};

// TODO accept string levels, normalize internally to numbers

// TODO more/optional outputs
// TODO string substitution, multiple params, etc

function Loggr(config) {
    var c = config || {};

    c.level = c.level || c.logLevel || LEVELS.INFO;
    c.showTime = 'showTime' in c ? Boolean(c.showTime) : true;
    c.namespace = c.namespace || null;
    c.outStream = c.outStream || process.stdout;
    c.eol = c.eol || os.EOL;

    this.config = c;
}

Loggr.prototype.fork = function (newNamespace) {
    var conf = this.config;

    return new Loggr({
        level: conf.level,
        showTime: conf.showTime,
        namespace: newNamespace,
        outStream: conf.outStream,
        eol: conf.eol,
    });
};

Loggr.prototype._log = function (lvl, messages) {
    if (lvl <= this.config.level) {
        var time = '';
        var namespace = '';

        if (this.config.showTime) {
            var d = new Date();
            var h = ('0' + d.getHours()).slice(-2);
            var m = ('0' + d.getMinutes()).slice(-2);
            var s = ('0' + d.getSeconds()).slice(-2);
            var ms = ('00' + d.getMilliseconds()).slice(-3);

            time = '[' + h + ':' + m + ':' + s + '.' + ms + '] ';
        }

        if (this.config.namespace) {
            namespace = '[' + this.config.namespace + '] ';
        }

        var message = messages
            .map(function (msg) {
                return String(msg);
            })
            .join(' ');

        var levelStr = Loggr.getLevelChar(lvl) + ' ';

        this.config.outStream.write(time + levelStr + namespace + message + this.config.eol);
    }
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
        case Loggr.LEVELS.INFO: return 'I';
        case Loggr.LEVELS.DEBUG: return 'D';
        case Loggr.LEVELS.TRACE: return 'T';
        default: return '?';
    }
};
