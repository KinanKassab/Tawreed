import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.ttf': 'font/ttf',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};
export function previewHandler(base) {
  return (request, response) => {
    // A development tab may survive a switch to an exported preview on the same
    // port. Never cache preview HTML or return HTML for missing JS/data requests.
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { response.writeHead(400).end('Invalid URL'); return; }
    if (pathname.startsWith('/_vercel/')) { response.writeHead(204).end(); return; }
    let file = resolve(base, '.' + pathname);
    const inside = relative(base, file);
    if (inside === '..' || inside.startsWith('..' + sep) || inside.includes(':')) { response.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = resolve(file, 'index.html');
    if (!existsSync(file) && existsSync(file + '.html')) file += '.html';
    const documentRequest = (request.headers.accept ?? '').includes('text/html');
    if (!existsSync(file) && documentRequest && !extname(pathname)) {
      for (const route of ['product', 'order']) {
        const template = resolve(base, route, '[id].html');
        if (pathname.startsWith('/' + route + '/') && existsSync(template)) file = template;
      }
      if (!existsSync(file)) file = resolve(base, 'index.html');
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('File not found. Reload the page to load the current preview.');
      return;
    }
    response.setHeader('Content-Type', mimeTypes[extname(file)] ?? 'application/octet-stream');
    response.statusCode = 200;
    response.end(request.method === 'HEAD' ? undefined : readFileSync(file));
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  for (const [app, port] of [['doctor', Number(process.env.TAWREED_DOCTOR_PREVIEW_PORT ?? 8081)], ['operations', Number(process.env.TAWREED_OPERATIONS_PREVIEW_PORT ?? 8082)]]) {
    const base = resolve(root, 'apps', app, 'dist');
    if (!existsSync(resolve(base, 'index.html'))) throw new Error(`Build ${app} before starting its preview.`);
    createServer(previewHandler(base)).listen(port, '127.0.0.1', () => console.log(`${app}: http://localhost:${port}`));
  }
}
