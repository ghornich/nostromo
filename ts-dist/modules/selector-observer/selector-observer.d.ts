export = SelectorObserver;
/**
 * @param {Object} conf
 * @param {String} conf.observeList
 */
declare function SelectorObserver(conf: {
    observeList: string;
}): void;
declare class SelectorObserver {
    /**
     * @param {Object} conf
     * @param {String} conf.observeList
     */
    constructor(conf: {
        observeList: string;
    });
    _conf: {
        observeList: string;
    };
    _selectorPrevVisible: any;
    _mutationObserver: any;
    _onMutation(): void;
    disconnect(): void;
}
