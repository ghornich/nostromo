
if (isNode()) {
    module.exports = Ws4ever;
}
else {
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
                return this._ws ? this._ws.readyState : WebSocket.CLOSED;
            },
        },
        url: {
            get: function () {
                return this._url;
            },
        },
    });

    this._ensureConnection = this._ensureConnection.bind(this);
    this._onWsOpen = this._onWsOpen.bind(this);
    this._onWsClose = this._onWsClose.bind(this);
    this._onWsError = this._onWsError.bind(this);
    this._onWsMessage = this._onWsMessage.bind(this);

    this.iid = setInterval(this._ensureConnection, this._opts.retryInterval);
}

Ws4ever.prototype.isConnected = function () {
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
        this._ws = new WebSocket(this._url, this._protocols);
        this._ws.onopen = this._onWsOpen;
        this._ws.onclose = this._onWsClose;
        this._ws.onerror = this._onWsError;
        this._ws.onmessage = this._onWsMessage;
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

Ws4ever.prototype._onWsOpen = function () {
    this.onopen.apply(null, arguments);
    this._isConnecting = false;
};

Ws4ever.prototype._onWsClose = function () {
    this.onclose.apply(null, arguments);
    this._isConnecting = false;
    this._ws = null;
};

Ws4ever.prototype._onWsError = function () {
    this.onerror.apply(null, arguments);
    // this._isConnecting=false
    // this._ws=null
};

Ws4ever.prototype._onWsMessage = function () {
    this.onmessage.apply(null, arguments);
};




function noop() {}

function isNode() {
    return typeof module === 'object' && typeof module.exports === 'object';
}


