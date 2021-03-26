
if (isNode()) {
    module.exports = Ws4ever;
}
else {
    // @ts-expect-error
    window.Ws4ever = Ws4ever;
}


function Ws4ever(url, protocols, options) {
    this._opts = Object.assign({}, {
        retryInterval: 1000,
    }, options || {});

    this._url = url;
    this._protocols = protocols;
    this._ws = null;
    this._isConnecting = false;

    this.onopen = noop;
    this.onclose = noop;
    this.onerror = noop;
    this.onmessage = noop;

    Object.defineProperties(this, {
        readyState: {
            get: function () {
                // @ts-expect-error
                return this._ws ? this._ws.readyState : WebSocket.CLOSED;
            },
        },
        url: {
            get: function () {
                return this._url;
            },
        },
    });

    this.iid = setInterval(this._ensureConnection.bind(this), this._opts.retryInterval);
}

Ws4ever.prototype.isConnected = function () {
    // @ts-expect-error
    return Boolean(this._ws && this._ws.readyState === WebSocket.OPEN);
};

Ws4ever.prototype.send = function (msg) {
    if (!this.isConnected()) {
        throw new Error('cannot send message, ws closed');
    }
    this._ws.send(msg);
};

Ws4ever.prototype._ensureConnection = function () {
    if (this.isConnected()) {
        return;
    }
    if (this._isConnecting) {
        return;
    }

    try {
        this._isConnecting = true;
        // @ts-expect-error
        this._ws = new WebSocket(this._url, this._protocols);
        this._ws.onopen = this._onWsOpen.bind(this);
        this._ws.onclose = this._onWsClose.bind(this);
        this._ws.onerror = this._onWsError.bind(this);
        this._ws.onmessage = this._onWsMessage.bind(this);
    }
    catch (e) {
        // TODO handle or log?
        console.log(e);
        this._isConnecting = false;
        this._ws = null;
    }
};

Ws4ever.prototype.close = function () {
    clearInterval(this.iid);
    this._ws.close();
};

Ws4ever.prototype._onWsOpen = function (...args) {
    this.onopen.apply(null, ...args);
    this._isConnecting = false;
};

Ws4ever.prototype._onWsClose = function (...args) {
    this.onclose.apply(null, ...args);
    this._isConnecting = false;
    this._ws = null;
};

Ws4ever.prototype._onWsError = function (...args) {
    this.onerror.apply(null, ...args);
    // this._isConnecting=false
    // this._ws=null
};

Ws4ever.prototype._onWsMessage = function (...args) {
    this.onmessage.apply(null, ...args);
};




function noop() {}

function isNode() {
    return typeof module === 'object' && typeof module.exports === 'object';
}


