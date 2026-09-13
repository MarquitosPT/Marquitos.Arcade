// Servidor estático mínimo sobre wwwroot, para correr os jogos sem o ASP.NET.
//
// Usado pelo smoke-test: os jogos são 100% cliente, por isso não precisam do
// servidor a sério para carregar. Os pedidos a /api/* respondem 503 de propósito
// — é exatamente o caminho de erro que os jogos têm de aguentar (servidor a
// acordar, telemóvel sem rede) e mantém o teste sem dependências.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.xml': 'application/xml',
    '.woff2': 'font/woff2'
};

export function startStaticServer(root, { port = 0 } = {}) {
    const server = createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        let pathname = decodeURIComponent(url.pathname);

        if (pathname.startsWith('/api/')) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end('{"error":"sem backend no smoke-test"}');
            return;
        }

        if (pathname.endsWith('/')) pathname += 'index.html';

        // Impede escapar da raiz com ../ no caminho pedido.
        const relative = normalize(pathname).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
        const filePath = join(root, relative);
        if (!filePath.startsWith(root + sep)) {
            res.writeHead(403).end('forbidden');
            return;
        }

        try {
            const body = await readFile(filePath);
            res.writeHead(200, {
                'Content-Type': TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
                'Cache-Control': 'no-store'
            });
            res.end(body);
        } catch {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404');
        }
    });

    return new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => {
            resolve({
                server,
                port: server.address().port,
                // server.close() sozinho espera que as ligações keep-alive se
                // desliguem, o que pode nunca acontecer e deixa o processo preso.
                // closeAllConnections() corta-as primeiro.
                close: () => new Promise((done) => {
                    server.closeAllConnections?.();
                    server.close(done);
                })
            });
        });
    });
}
