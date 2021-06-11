export = Ws4ever;
declare function Ws4ever(url: any, protocols: any, options: any): void;
declare class Ws4ever {
    constructor(url: any, protocols: any, options: any);
    _opts: any;
    _url: any;
    _protocols: any;
    _ws: any;
    _isConnecting: boolean;
    onopen: typeof noop;
    onclose: typeof noop;
    onerror: typeof noop;
    onmessage: typeof noop;
    iid: NodeJS.Timeout;
    isConnected(): boolean;
    send(msg: any): void;
    _ensureConnection(): void;
    close(): void;
    _onWsOpen(...args: any[]): void;
    _onWsClose(...args: any[]): void;
    _onWsError(...args: any[]): void;
    _onWsMessage(...args: any[]): void;
}
declare function noop(): void;
