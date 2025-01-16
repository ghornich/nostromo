"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const url_1 = require("url");
const path_1 = require("path");
async function createServer({ dirToServe, port }) {
    const server = http_1.default.createServer(async function (request, response) {
        const path = (0, url_1.parse)(request.url).path.slice(1);
        const file = (0, path_1.resolve)(dirToServe, path);
        try {
            response.end(await fs_1.default.promises.readFile(file));
        }
        catch (err) {
            console.error(err);
            response.end('');
        }
    });
    await new Promise(resolve => server.listen(port, resolve));
    return server;
}
exports.default = createServer;
