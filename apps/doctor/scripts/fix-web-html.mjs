import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const outputPath = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const html = await readFile(outputPath, 'utf8');
// Shown until React mounts and replaces #root's contents: a plain white splash, then a static copy of the
// header + HomeSkeleton (packages/ui) so the hand-off to the live skeleton and content does not jump.
const block = (height, width = '100%', extra = '') => `<i class="bs-b${extra}" style="height:${height}px;width:${width}"></i>`;
const heading = `<div class="bs-head">${block(20, '16%')}${block(32, '34%')}</div>`;
const tile = `<div class="bs-tile">${block(64, '64px', ' bs-visual')}${block(18, '56%')}</div>`;
const card = `<div class="bs-card">${block(180)}${block(22, '42%')}${block(24, '82%')}${block(20, '58%')}${block(24, '48%')}${block(44)}</div>`;
const bootPlaceholder = `<div class="bs" aria-hidden="true">`
  + `<div class="bs-header"><div class="bs-header-in"><div class="bs-actions">${block(28, '28px', ' bs-round')}${block(28, '28px', ' bs-round')}</div>${block(32, '32px', ' bs-logo')}</div></div>`
  + `<div class="bs-page"><div class="bs-welcome">${block(20, '44%')}${block(48, '80%')}${block(30, '94%')}${block(52, '100%', ' bs-field')}<div class="bs-row">${block(48, '150px')}${block(48, '150px')}</div></div>`
  + `${heading}<div class="bs-tiles">${tile.repeat(8)}</div>${heading}<div class="bs-cards">${card.repeat(4)}</div></div></div>`;
const bootStyles = `
    <style>
      html,body,#root{background:#FFFFFF}body{margin:0}.bs,.bs *{box-sizing:border-box}
      .bs{flex:1;display:flex;flex-direction:column;background:#FBF6EC;overflow:hidden;animation:bs-in .3s ease .25s both}
      .bs-header{background:#FFFFFF;border-bottom:1px solid #DDE2E0}
      .bs-header-in{direction:ltr;max-width:1200px;min-height:72px;margin:0 auto;padding:0 16px;display:flex;align-items:center;justify-content:space-between}
      .bs-actions{display:flex;gap:28px;padding-left:10px}
      .bs-page{width:100%;max-width:1200px;margin:0 auto;padding:16px;display:flex;flex-direction:column;gap:24px}
      .bs-welcome{display:flex;flex-direction:column;align-items:flex-start;gap:16px;padding:32px 24px}
      .bs-row{align-self:stretch;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:12px}
      .bs-head{display:flex;align-items:center;justify-content:space-between}
      .bs-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
      .bs-tile{min-height:132px;padding:12px;background:#FFFFFF;border:1px solid #DDE2E0;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px}
      .bs-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
      .bs-card{padding:12px;background:#FFFFFF;border:1px solid #DDE2E0;border-radius:18px;display:flex;flex-direction:column;gap:8px;box-shadow:0 4px 18px rgba(20,32,29,.05)}
      .bs-b{display:block;position:relative;overflow:hidden;flex:none;background:#F7F8F7;border-radius:12px}
      .bs-b::after{content:"";position:absolute;inset:0 auto 0 0;width:28%;background:#ECF5F2;opacity:.72;animation:bs-sheen 1.45s linear infinite}
      .bs-field{background:#FFFFFF;border:1.5px solid #DDE2E0;border-radius:14px}
      .bs-visual{border-radius:18px}.bs-round{border-radius:50%}.bs-logo{border-radius:8px}
      @media (max-width:900px){.bs-tiles{grid-template-columns:repeat(3,1fr)}.bs-tiles .bs-tile:nth-child(n+7){display:none}}
      @media (max-width:680px){.bs-tiles{grid-template-columns:repeat(2,1fr)}.bs-tiles .bs-tile:nth-child(n+5){display:none}}
      @keyframes bs-in{from{opacity:0}to{opacity:1}}
      @keyframes bs-sheen{from{transform:translateX(-140px)}to{transform:translateX(380px)}}
      @media (prefers-reduced-motion:reduce){.bs{animation:none}.bs-b::after{display:none}}
    </style>`;
const headMarkup = `${bootStyles}
    <meta name="mobile-web-app-capable" content="yes" />
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
    <link rel="manifest" href="/manifest.webmanifest" />
    <!-- Arabic/Latin subsets of assets/fonts (fontTools pyftsubset, woff2), started alongside the JS bundles. -->
    <link rel="preload" href="/fonts/kufi.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
    <style>
      @font-face{font-family:"NotoKufiArabic";src:url('/fonts/kufi.woff2') format('woff2');font-display:swap;font-weight:100 900}
      @font-face{font-family:"Manrope";src:url('/fonts/manrope.woff2') format('woff2');font-display:swap;font-weight:200 800}
    </style>`;
const localized = html
  .replace(/<html(?:\s+lang="[^"]*")?(?:\s+dir="[^"]*")?>/i, '<html lang="ar" dir="rtl">')
  .replace(/<title>[^<]*<\/title>/i, '<title>توريد | مستلزماتك الطبية</title>')
  .replace('</head>', `${headMarkup}\n  </head>`)
  .replace('<div id="root"></div>', `<div id="root">${bootPlaceholder}</div>`)
  .replace('</body>', `<script>if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>undefined));}</script>\n</body>`);

for (const required of ['<html lang="ar" dir="rtl">', '/manifest.webmanifest', '/service-worker.js', '/favicon.svg', 'توريد | مستلزماتك الطبية', bootPlaceholder]) {
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
