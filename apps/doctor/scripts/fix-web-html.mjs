import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const outputPath = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const html = await readFile(outputPath, 'utf8');
const localized = html.replace(/<html(?:\s+lang="[^"]*")?(?:\s+dir="[^"]*")?>/i, '<html lang="ar" dir="rtl">');

if (localized === html && !html.includes('<html lang="ar" dir="rtl">')) {
  throw new Error('Could not localize exported Web document metadata');
}

await writeFile(outputPath, localized, 'utf8');
