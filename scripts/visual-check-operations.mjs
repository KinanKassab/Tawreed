import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.OPERATIONS_VISUAL_BASE_URL;
const email = process.env.OPERATIONS_VISUAL_EMAIL;
const password = process.env.OPERATIONS_VISUAL_PASSWORD;
const outputDir = resolve(process.env.OPERATIONS_VISUAL_OUTPUT_DIR ?? 'artifacts/operations-visual');

if (!baseUrl || !email || !password) {
  throw new Error('Set OPERATIONS_VISUAL_BASE_URL, OPERATIONS_VISUAL_EMAIL, and OPERATIONS_VISUAL_PASSWORD.');
}
const deploymentUrl = new URL(baseUrl);
const routeUrl = (pathname) => {
  const url = new URL(pathname, deploymentUrl.origin);
  deploymentUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));
  return url.toString();
};

const viewports = [
  { name: 'phone-320', width: 320, height: 800 },
  { name: 'phone-375', width: 375, height: 812 },
  { name: 'phone-414', width: 414, height: 896 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-landscape-1024', width: 1024, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];
const sections = [
  { name: 'overview', label: 'نظرة عامة' },
  { name: 'orders', label: 'الطلبات' },
  { name: 'catalog', label: /الكتالوج/ },
  { name: 'inventory', label: 'المخزون' },
  { name: 'settings', label: 'سعر الصرف' },
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: viewports[1] });
const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});

for (const viewport of viewports) {
  await page.setViewportSize(viewport);
  await page.goto(routeUrl('/login'), { waitUntil: 'networkidle' });
  await page.screenshot({ path: resolve(outputDir, `${viewport.name}-login.png`) });
}

await page.setViewportSize(viewports[1]);
await page.goto(routeUrl('/login'), { waitUntil: 'networkidle' });
await page.getByLabel('البريد الإلكتروني').fill(email);
await page.getByLabel('كلمة المرور').fill(password);
await page.getByRole('button', { name: 'دخول آمن' }).click();
await page.getByText('نظرة عامة', { exact: true }).first().waitFor({ timeout: 30_000 });

for (const viewport of viewports) {
  await page.setViewportSize(viewport);
  for (const section of sections) {
    await page.getByRole('tab', { name: section.label }).click();
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`${viewport.name}/${section.name}: horizontal overflow ${overflow}px`);
    await page.screenshot({ path: resolve(outputDir, `${viewport.name}-${section.name}.png`) });
  }
}

for (const viewport of [viewports[1], viewports[3], viewports[5]]) {
  await page.setViewportSize(viewport);
  await page.getByRole('tab', { name: /الكتالوج/ }).click();
  await page.getByRole('button', { name: 'تعديل', exact: true }).first().click();
  await page.screenshot({ path: resolve(outputDir, `${viewport.name}-product-editor.png`) });
  await page.getByLabel('إغلاق التعديل').click();
  await page.getByRole('button', { name: /معاينة/ }).first().click();
  await page.screenshot({ path: resolve(outputDir, `${viewport.name}-product-preview.png`) });
  await page.getByLabel('إغلاق المعاينة').click();
}

await browser.close();
if (consoleErrors.length) throw new Error(`Browser console errors:\n${consoleErrors.join('\n')}`);
console.log(`Visual checks passed for ${viewports.length} viewports and ${sections.length} dashboard screens.`);
console.log(outputDir);
