import { copyFile, readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// The web build is statically rendered (app.json web.output "static"): every route's HTML comes from
// src/app/+html.tsx. This only guards that metadata and copies the public files the PWA relies on.
const distUrl = new URL('../dist/', import.meta.url);
const pages = (await readdir(fileURLToPath(distUrl), { recursive: true })).filter((name) => name.endsWith('.html'));
for (const page of ['index.html', 'catalog.html', 'product/[id].html']) {
  if (!pages.some((name) => name.replaceAll('\\', '/') === page)) throw new Error(`Missing statically rendered page: ${page}`);
}

const home = await readFile(new URL('index.html', distUrl), 'utf8');
for (const required of ['<html lang="ar" dir="rtl">', '/manifest.webmanifest', '/service-worker.js', '/favicon.svg', '/fonts/kufi.woff2', 'توريد | مستلزماتك الطبية', 'مستلزماتك الطبية، واصلة لعندك']) {
  if (!home.includes(required)) throw new Error(`Missing exported web metadata or content in index.html: ${required}`);
}

const publicFiles = [
  'manifest.webmanifest', 'service-worker.js', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png',
  'app-icon-192.png', 'app-icon-512.png', 'maskable-512.png', 'og-tawreed.png',
];
await Promise.all(publicFiles.map((name) => copyFile(
  fileURLToPath(new URL(`../public/${name}`, import.meta.url)),
  fileURLToPath(new URL(name, distUrl)),
)));
