const DEFAULT_ELLIPSIS_LIMIT = 40;
import glob from 'glob';
import util from 'util';
const globAsync = util.promisify(glob);
import unsafePrettyMs from 'pretty-ms';

export function ellipsis(s: string, limit = DEFAULT_ELLIPSIS_LIMIT) {
    if (s.length <= limit) {
        return s;
    }

    return `${s.substr(0, limit - 3)}...`;
}

export async function multiGlobAsync(globs: string[]) {
    let paths: string[] = [];

    for (const g of globs) {
        paths = paths.concat(await globAsync(g));
    }

    return paths;
}

export function getIdFromName(name: string) {
    return name.replace(/[^a-z0-9()._-]/gi, '_');
}

export function prettyMs(ms: unknown, opts?: unsafePrettyMs.Options) {
    return typeof ms === 'number' && ms >= 0 ? unsafePrettyMs(ms, opts) : '? ms';
}
