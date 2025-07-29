const DEFAULT_ELLIPSIS_LIMIT = 40;
import unsafePrettyMs from 'pretty-ms';

export function ellipsis(s: string, limit = DEFAULT_ELLIPSIS_LIMIT) {
    if (s.length <= limit) {
        return s;
    }

    return `${s.substr(0, limit - 3)}...`;
}

export function getIdFromName(name: string) {
    return name.replace(/[^a-z0-9()._-]/gi, '_');
}

export function prettyMs(ms: unknown, opts?: unsafePrettyMs.Options) {
    return typeof ms === 'number' && ms >= 0 ? unsafePrettyMs(ms, opts) : '? ms';
}
