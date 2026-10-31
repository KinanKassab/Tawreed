import { chromium } from '@playwright/test';

const baseUrl = process.argv[2] ?? 'http://localhost:8081';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'ar-SY' });
const page = await context.newPage();
const runtimeErrors = [];
page.on('pageerror', (error) => runtimeErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error' && /failed to fetch|authretryablefetcherror/i.test(message.text())) runtimeErrors.push(message.text());
});
await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.documentElement.lang === 'ar' && document.title.includes('مستلزماتك الطبية'));
await page.waitForTimeout(1200);

const documentState = await page.evaluate(() => ({
  lang: document.documentElement.lang,
  dir: document.documentElement.dir,
  title: document.title,
  themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
  manifestHref: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
  faviconHref: document.querySelector('link[rel="icon"]')?.getAttribute('href'),
}));

const manifestResponse = await page.request.get(`${baseUrl}/manifest.webmanifest`);
if (!manifestResponse.ok()) throw new Error(`Manifest request failed: ${manifestResponse.status()}`);
const manifest = await manifestResponse.json();

for (const icon of manifest.icons ?? []) {
  const response = await page.request.get(new URL(icon.src, baseUrl).toString());
  if (!response.ok()) throw new Error(`Icon request failed: ${icon.src} (${response.status()})`);
}

await page.waitForTimeout(1500);
const serviceWorker = await page.evaluate(async () => Boolean(navigator.serviceWorker && (await navigator.serviceWorker.getRegistrations()).length));

const required = {
  lang: 'ar', dir: 'rtl', title: 'توريد | مستلزماتك الطبية', themeColor: '#0E5245', manifestHref: '/manifest.webmanifest',
};
for (const [key, value] of Object.entries(required)) {
  if (documentState[key] !== value) throw new Error(`${key} expected ${value}, received ${documentState[key]}`);
}
if (manifest.name !== 'توريد | Tawreed' || manifest.short_name !== 'توريد' || manifest.display !== 'standalone') throw new Error('Manifest naming or display mode is invalid');
if (!manifest.icons?.some((icon) => icon.purpose === 'maskable')) throw new Error('Maskable icon is missing');
if (!serviceWorker) throw new Error('Service worker is not registered');
if (runtimeErrors.length) throw new Error(`Runtime errors detected: ${runtimeErrors.join(' | ')}`);

console.log(JSON.stringify({ document: documentState, manifest: { name: manifest.name, shortName: manifest.short_name, display: manifest.display, themeColor: manifest.theme_color, iconCount: manifest.icons.length }, serviceWorker }, null, 2));
await browser.close();
