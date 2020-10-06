const http = require('http');
const fs = require('fs');
const { parse } = require('url');
const resolvePath = require('path').resolve;

export default async function createServer({ dirToServe, port }) {
    const server = http.createServer(async function (request, response) {
        const path = parse(request.url).path.slice(1);

        const file = resolvePath(dirToServe, path);

        try {
            response.end(await fs.promises.readFile(file));
        }
        catch (err) {
            console.error(err);
            response.end('');
        }
    });

    await new Promise(resolve => server.listen(port, resolve));

    return server;
}
