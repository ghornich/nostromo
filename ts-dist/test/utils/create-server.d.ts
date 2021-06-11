/// <reference types="node" />
import http from 'http';
export default function createServer({ dirToServe, port }: {
    dirToServe: string;
    port: number;
}): Promise<http.Server>;
