export = UniqueSelector;
/**
 * @typedef {Object} UniqueSelectorOptions
 * @property {Function} [querySelectorAll]
 * @property {Array<String>} [ignoredClasses] - ignored class names (without leading '.')
 * @property {Boolean} [useIds = true]
 * @property {RegExp} [preferredClass] - e.g. /test--[^ ]+/
 * @property {Boolean} [useClosestParentWithPreferredClass = false]
 * @property {Number} [preferredClassParentLimit = 0]
 */
/**
 * @param {UniqueSelectorOptions} options
 */
declare function UniqueSelector(options: UniqueSelectorOptions): void;
declare class UniqueSelector {
    /**
     * @typedef {Object} UniqueSelectorOptions
     * @property {Function} [querySelectorAll]
     * @property {Array<String>} [ignoredClasses] - ignored class names (without leading '.')
     * @property {Boolean} [useIds = true]
     * @property {RegExp} [preferredClass] - e.g. /test--[^ ]+/
     * @property {Boolean} [useClosestParentWithPreferredClass = false]
     * @property {Number} [preferredClassParentLimit = 0]
     */
    /**
     * @param {UniqueSelectorOptions} options
     */
    constructor(options: UniqueSelectorOptions);
    _opts: {
        querySelectorAll: any;
        ignoredClasses: any[];
        useIds: boolean;
        preferredClass: any;
        useClosestParentWithPreferredClass: boolean;
        preferredClassParentLimit: number;
    } & UniqueSelectorOptions;
    get(node: any): string;
    _getParentSelectorPath(node: any): import("./selector-element-list");
    getFullSelectorPath(node: any): string;
}
declare namespace UniqueSelector {
    export { UniqueSelectorOptions };
}
type UniqueSelectorOptions = {
    querySelectorAll?: Function;
    /**
     * - ignored class names (without leading '.')
     */
    ignoredClasses?: Array<string>;
    useIds?: boolean;
    /**
     * - e.g. /test--[^ ]+/
     */
    preferredClass?: RegExp;
    useClosestParentWithPreferredClass?: boolean;
    preferredClassParentLimit?: number;
};
