export = SelectorElement;
/**
 * Represents a single DOM node's selector, e.g.:
 *
 * .class1 .class2.red span [name="user"]
 * |-----| |---------| |--| |-----------|
 *
 *
 */
declare class SelectorElement {
    /**
     * [getSelectorStringData description]
     * @param  {Object} node [description]
     * @return {Object} { selector: String, type: Number }
     */
    static _getNodeSelectorData(node: any, rawOptions: any): any;
    constructor(node: any, options: any);
    _node: any;
    _rawSelector: any;
    _type: any;
    _active: boolean;
    _useNthChild: boolean;
    _nthChild: any;
    get node(): any;
    set rawSelector(arg: any);
    get rawSelector(): any;
    get selector(): string;
    get type(): any;
    set active(arg: boolean);
    get active(): boolean;
    set useNthChild(arg: boolean);
    get useNthChild(): boolean;
}
declare namespace SelectorElement {
    namespace TYPE {
        const ID: number;
        const CLASS: number;
        const ATTR: number;
        const TAG: number;
    }
    namespace ERROR {
        const INVALID_NODE: number;
    }
}
