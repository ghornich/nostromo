export = SelectorElementList;
declare function SelectorElementList(options: any): void;
declare class SelectorElementList {
    constructor(options: any);
    _opts: any;
    _selectorElements: any[];
    getSelectorPath(): string;
    toString: any;
    addElement(element: any): void;
    getAmbiguity(): any;
    isUnique(): boolean;
    simplify(enableUsePreferredClass: any): void;
    simplifyClasses(enableUsePreferredClass: any): void;
    uniqueify(): void;
}
