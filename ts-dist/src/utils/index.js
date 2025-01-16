"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prettyMs = exports.getIdFromName = exports.multiGlobAsync = exports.ellipsis = void 0;
const DEFAULT_ELLIPSIS_LIMIT = 40;
const glob_1 = __importDefault(require("glob"));
const util_1 = __importDefault(require("util"));
const globAsync = util_1.default.promisify(glob_1.default);
const pretty_ms_1 = __importDefault(require("pretty-ms"));
function ellipsis(s, limit = DEFAULT_ELLIPSIS_LIMIT) {
    if (s.length <= limit) {
        return s;
    }
    return `${s.substr(0, limit - 3)}...`;
}
exports.ellipsis = ellipsis;
async function multiGlobAsync(globs) {
    let paths = [];
    for (const g of globs) {
        paths = paths.concat(await globAsync(g));
    }
    return paths;
}
exports.multiGlobAsync = multiGlobAsync;
function getIdFromName(name) {
    return name.replace(/[^a-z0-9()._-]/gi, '_');
}
exports.getIdFromName = getIdFromName;
function prettyMs(ms, opts) {
    return typeof ms === 'number' && ms >= 0 ? (0, pretty_ms_1.default)(ms, opts) : '? ms';
}
exports.prettyMs = prettyMs;
