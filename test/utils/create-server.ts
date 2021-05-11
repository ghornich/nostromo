import http from 'http';
import fs from 'fs';
import { parse } from 'url';
import { resolve as resolvePath } from 'path';

export default async function createServer({ dirToServe, port }: { dirToServe: string, port: number}) {
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

    await new Promise<void>(resolve => server.listen(port, resolve));

    return server;
}
