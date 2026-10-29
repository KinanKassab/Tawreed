import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const outputPath = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const html = await readFile(outputPath, 'utf8');
const localized = html
  .replace(/<html(?:\s+lang="[^"]*")?(?:\s+dir="[^"]*")?>/i, '<html lang="ar" dir="rtl">')
  .replace('<title>Tawreed Doctor</title>', '<title>توريد للطبيب</title>')
  .replace('</head>', '<meta name="theme-color" content="#173F43"/><meta name="application-name" content="توريد"/><meta name="apple-mobile-web-app-capable" content="yes"/><link rel="manifest" href="/manifest.webmanifest"/><link rel="apple-touch-icon" href="/icon.png"/></head>')
  .replace('</body>', `<script>if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>undefined));}</script></body>`);

if (!localized.includes('<html lang="ar" dir="rtl">') || !localized.includes('/manifest.webmanifest') || !localized.includes('/service-worker.js')) {
  throw new Error('Could not localize exported Web document metadata');
}

await writeFile(outputPath, localized, 'utf8');
await Promise.all([
  copyFile(fileURLToPath(new URL('../public/manifest.webmanifest', import.meta.url)), fileURLToPath(new URL('../dist/manifest.webmanifest', import.meta.url))),
  copyFile(fileURLToPath(new URL('../public/service-worker.js', import.meta.url)), fileURLToPath(new URL('../dist/service-worker.js', import.meta.url))),
  copyFile(fileURLToPath(new URL('../assets/images/icon.png', import.meta.url)), fileURLToPath(new URL('../dist/icon.png', import.meta.url))),
]);
