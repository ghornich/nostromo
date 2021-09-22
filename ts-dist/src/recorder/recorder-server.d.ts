/// <reference types="node" />
/** @typedef {Object} Command */
/** @typedef {Object} RecorderApp */
/**
 * @memberOf RecorderServer
 * @type {Number}
 * @static
 * @constant
 */
export const DEFAULT_RECORDER_APP_PORT: number;
/**
 * @callback FilterCallback
 * @param {Object} data
 * @param {Object} data.event - DOM event data (type, target, selector, $timestamp, $fullSelectorPath) - TODO typedef
 * @param {Command} data.command - Command generated from the event
 * @param {RecorderApp} data.recorderInstance - The current RecorderApp instance
 * @return {Boolean} Return false to prevent recording this event
 */
/**
 * @callback OnChangeCallback
 * @param {Object} data
 * @param {Object} data.event - TODO typedef
 * @param {RecorderApp} data.recorderInstance
 */
/**
 * @callback SelectorBecameVisibleCallback
 * @param {RecorderApp} recorderInstance - The current RecorderApp instance
 */
/**
 * @typedef {Object} OutputFormatter
 * @property {String} name - Display name
 * @property {String} [filename = RecorderApp.DEFAULT_OUTPUT_FILENAME]
 * @property {Function} fn - Formatter function, argument: Array&lt;Command&gt;, return: String
 */
/**
 * @typedef {Object} RecorderOptions
 * @property {Number} [recorderAppPort] See RecorderServer::DEFAULT_RECORDER_APP_PORT
 * @property {Number} [logLevel] - See Loggr.LEVELS
 *
 * @property {FilterCallback} [captureFilter]
 * @property {FilterCallback} [pressKeyFilter] - Special capture filter, only called for pressKey. <b>Default: capture Enter, Esc only</b>.
 *
 * @property {OnChangeCallback} [onChangeEvent]
 *
 * @property {Array<Object>} [onSelectorBecameVisible]
 * @property {String} [onSelectorBecameVisible[].selector] - CSS selector
 * @property {SelectorBecameVisibleCallback} [onSelectorBecameVisible[].listener]
 *
 * @property {Array<OutputFormatter>} outputFormatters - Custom output and download formatter(s)
 * @property {String} [selectedOutputFormatter] - Selected output formatter name
 *
 * @property {Array<String>} [mouseoverSelectors] - Detect mouseover events only for these selectors
 *
 * @property {Array<String>} [ignoredClasses] - DEPRECATED (use uniqueSelectorOptions) Ignored classnames
 * @property {Object} [uniqueSelectorOptions] import('../../modules/get-unique-selector').UniqueSelectorOptions
 *
 * @property {Array<Object>} [_mockMessages] - for testing only, do not use
 * @property {Boolean} [_preEnableRecording] - for testing only, do not use
 */
export default class RecorderServer {
    /**
    * @param {RecorderOptions} conf
    */
    constructor(conf: RecorderOptions);
    _conf: any;
    _recorderAppServer: import("http").Server;
    _wsServer: any;
    /** @type {puppeteer.Browser} */
    _browser: import("puppeteer").Browser;
    _log: Pick<import("../logging/logger").Logger, "error" | "warn" | "info" | "verbose" | "debug">;
    start(): Promise<void>;
    stop(): Promise<void>;
    _proxyMessage(data: any, rawData: any): void;
    _onRecRequest(req: any, resp: any): Promise<void>;
}
export type Command = any;
export type RecorderApp = any;
export type FilterCallback = (data: any, event: any, command: Command, recorderInstance: RecorderApp) => boolean;
export type OnChangeCallback = (data: any, event: any, recorderInstance: RecorderApp) => any;
export type SelectorBecameVisibleCallback = (recorderInstance: RecorderApp) => any;
export type OutputFormatter = {
    /**
     * - Display name
     */
    name: string;
    filename?: string;
    /**
     * - Formatter function, argument: Array&lt;Command&gt;, return: String
     */
    fn: Function;
};
export type RecorderOptions = {
    /**
     * See RecorderServer::DEFAULT_RECORDER_APP_PORT
     */
    recorderAppPort?: number;
    /**
     * - See Loggr.LEVELS
     */
    logLevel?: number;
    captureFilter?: FilterCallback;
    /**
     * - Special capture filter, only called for pressKey. <b>Default: capture Enter, Esc only</b>.
     */
    pressKeyFilter?: FilterCallback;
    onChangeEvent?: OnChangeCallback;
    onSelectorBecameVisible?: Array<any>;
    /**
     * - CSS selector
     */
    selector?: string;
    listener?: SelectorBecameVisibleCallback;
    /**
     * - Custom output and download formatter(s)
     */
    outputFormatters: Array<OutputFormatter>;
    /**
     * - Selected output formatter name
     */
    selectedOutputFormatter?: string;
    /**
     * - Detect mouseover events only for these selectors
     */
    mouseoverSelectors?: Array<string>;
    /**
     * - DEPRECATED (use uniqueSelectorOptions) Ignored classnames
     */
    ignoredClasses?: Array<string>;
    /**
     * import('../../modules/get-unique-selector').UniqueSelectorOptions
     */
    uniqueSelectorOptions?: any;
    /**
     * - for testing only, do not use
     */
    _mockMessages?: Array<any>;
    /**
     * - for testing only, do not use
     */
    _preEnableRecording?: boolean;
};
