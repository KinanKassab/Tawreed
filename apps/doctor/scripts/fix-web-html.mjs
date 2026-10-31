import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const outputPath = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const html = await readFile(outputPath, 'utf8');
const headMarkup = `
    <meta name="description" content="مستلزماتك الطبية، واصلة لعندك. منصة تربط الأطباء والطلاب والعيادات بموردين موثوقين." />
    <meta name="theme-color" content="#0E5245" />
    <meta name="application-name" content="توريد" />
    <meta name="apple-mobile-web-app-title" content="توريد" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta property="og:title" content="توريد | Tawreed" />
    <meta property="og:description" content="احتياجك، واصل لعندك." />
    <meta property="og:image" content="/og-tawreed.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.webmanifest" />`;
const localized = html
  .replace(/<html(?:\s+lang="[^"]*")?(?:\s+dir="[^"]*")?>/i, '<html lang="ar" dir="rtl">')
  .replace(/<title>[^<]*<\/title>/i, '<title>توريد | مستلزماتك الطبية</title>')
  .replace('</head>', `${headMarkup}\n  </head>`)
  .replace('</body>', `<script>if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>undefined));}</script>\n</body>`);

for (const required of ['<html lang="ar" dir="rtl">', '/manifest.webmanifest', '/service-worker.js', '/favicon.svg', 'توريد | مستلزماتك الطبية']) {
  if (!localized.includes(required)) throw new Error(`Missing exported web metadata: ${required}`);
}

await writeFile(outputPath, localized, 'utf8');

const publicFiles = [
  'manifest.webmanifest', 'service-worker.js', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png',
  'app-icon-192.png', 'app-icon-512.png', 'maskable-512.png', 'og-tawreed.png',
];
await Promise.all(publicFiles.map((name) => copyFile(
  fileURLToPath(new URL(`../public/${name}`, import.meta.url)),
  fileURLToPath(new URL(`../dist/${name}`, import.meta.url)),
)));
