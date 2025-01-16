import unsafePrettyMs from 'pretty-ms';
export declare function ellipsis(s: string, limit?: number): string;
export declare function multiGlobAsync(globs: string[]): Promise<string[]>;
export declare function getIdFromName(name: string): string;
export declare function prettyMs(ms: unknown, opts?: unsafePrettyMs.Options): string;
