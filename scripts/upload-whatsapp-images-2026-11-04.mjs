import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const repoRoot = String.raw`L:\AKODUS\01-Products\Tawreed`;
const envPath = path.join(repoRoot, 'Code', '.env');
const packageRoot = path.join(repoRoot, 'Design & Assets', 'WhatsApp-Review-2026-11-04-Yasmin');
const originalsDir = path.join(packageRoot, '02-images', 'originals', 'whatsapp');
const preparedDir = path.join(packageRoot, '02-images', 'prepared', 'web');

const images = [
  { id: 'WA-YK-037', time: '11:57:40 AM', caption: 'خيوط تبعيد لثه', product: 'خيوط تبعيد لثة', file: 'WA-YK-037-gingival-retraction-cord.jpeg', source: String.raw`C:\Users\Kinan\Downloads\WhatsApp Image 2026-11-04 at 11.57.40 AM.jpeg`, width: 500, height: 500 },
  { id: 'WA-YK-038', time: '11:57:48 AM', caption: 'خواتم لبية', product: 'خواتم لبية', file: 'WA-YK-038-endodontic-rings.jpeg', source: String.raw`C:\Users\Kinan\Downloads\WhatsApp Image 2026-11-04 at 11.57.48 AM.jpeg`, width: 1600, height: 1600 },
  { id: 'WA-YK-039', time: '11:58:11 AM', caption: 'هذا هو Gic medicem', product: 'Gic Medicem', file: 'WA-YK-039-gic-medicem.jpeg', source: String.raw`C:\Users\Kinan\Downloads\WhatsApp Image 2026-11-04 at 11.58.11 AM.jpeg`, width: 258, height: 193 },
  { id: 'WA-YK-040', time: '11:58:42 AM', caption: 'مجموعة تترك / تيوب / بوند / مخرش', product: 'مجموعة تترك', options: ['مجموعة كاملة', 'تيوب', 'بوند', 'مخرش'], file: 'WA-YK-040-tetric-set.jpeg', source: String.raw`C:\Users\Kinan\Downloads\WhatsApp Image 2026-11-04 at 11.58.42 AM.jpeg`, width: 554, height: 554 },
  { id: 'WA-YK-041', time: '11:59:02 AM', caption: 'مجموعة kdm / تيوب / بوند / مخرش', product: 'مجموعة KDM', options: ['مجموعة كاملة', 'تيوب', 'بوند', 'مخرش'], file: 'WA-YK-041-kdm-set.jpeg', source: String.raw`C:\Users\Kinan\Downloads\WhatsApp Image 2026-11-04 at 11.59.02 AM.jpeg`, width: 465, height: 659 },
  { id: 'WA-YK-042', time: '11:59:13 AM', caption: 'مجموعة كاريزما / تيوب / بوند / مخرش', product: 'مجموعة كاريزما', options: ['مجموعة كاملة', 'تيوب', 'بوند', 'مخرش'], file: 'WA-YK-042-charisma-set.jpeg', source: String.raw`C:\Users\Kinan\Downloads\WhatsApp Image 2026-11-04 at 11.59.13 AM.jpeg`, width: 232, height: 215 },
  { id: 'WA-YK-043', time: '11:56:25 AM', caption: 'اسنان اكريل', product: 'أسنان أكريل', file: 'WA-YK-043-acrylic-teeth.jpeg', source: String.raw`C:\Users\Kinan\Downloads\WhatsApp Image 2026-11-04 at 11.56.25 AM.jpeg`, width: 554, height: 554 },
  { id: 'WA-YK-044', time: '11:56:31 AM', caption: 'بولي كربوكسلات', product: 'بولي كاربوسلات', file: 'WA-YK-044-polycarboxylate-cement.jpeg', source: String.raw`C:\Users\Kinan\Downloads\WhatsApp Image 2026-11-04 at 11.56.31 AM.jpeg`, width: 284, height: 176 },
  { id: 'WA-YK-045', time: '11:56 AM', caption: 'ماءات كالسيوم', product: 'ماءات كالسيوم', file: 'WA-YK-045-calcium-hydroxide.jpeg', source: String.raw`L:\AKODUS\01-Products\Tawreed\outputs\01a1a2a8-81b9-7b81-9886-62f83a40b0a4\excel-update-work\recovered-whatsapp-candidates\085-f894396b2fd7.jpg`, width: 500, height: 500 },
  { id: 'WA-YK-046', time: '11:56 AM', caption: 'قاتل عصب روسي', product: 'قاتل عصب روسي', file: 'WA-YK-046-russian-pulp-devitalizer.jpeg', source: String.raw`L:\AKODUS\01-Products\Tawreed\outputs\01a1a2a8-81b9-7b81-9886-62f83a40b0a4\excel-update-work\recovered-whatsapp-candidates\043-6651e1d57c59.jpg`, width: 447, height: 447 },
  { id: 'WA-YK-047', time: '11:56 AM', caption: 'شانات صينيه', product: 'شانات', options: ['صينية'], file: 'WA-YK-047-chinese-dental-bibs.jpeg', source: String.raw`L:\AKODUS\01-Products\Tawreed\outputs\01a1a2a8-81b9-7b81-9886-62f83a40b0a4\excel-update-work\recovered-whatsapp-candidates\007-22735204b1af.jpg`, width: 550, height: 550 },
  { id: 'WA-YK-048', time: '11:56 AM', caption: 'شانات مريض', product: 'شانات', options: ['مريض'], file: 'WA-YK-048-patient-bib-roll.jpeg', source: String.raw`L:\AKODUS\01-Products\Tawreed\outputs\01a1a2a8-81b9-7b81-9886-62f83a40b0a4\excel-update-work\recovered-whatsapp-candidates\101-317e87d82d78.jpg`, width: 480, height: 480 },
  { id: 'WA-YK-049', time: '11:56 AM', caption: 'رؤوس ارواء', product: 'رؤوس إرواء', file: 'WA-YK-049-irrigation-tips.jpeg', source: String.raw`L:\AKODUS\01-Products\Tawreed\outputs\01a1a2a8-81b9-7b81-9886-62f83a40b0a4\excel-update-work\recovered-whatsapp-candidates\065-fd374bb790e2.jpg`, width: 399, height: 311 },
  { id: 'WA-YK-050', time: '11:56 AM', caption: 'رؤوس تخريش', product: 'رؤوس تخريش', options: ['كيس', 'حبة'], file: 'WA-YK-050-etching-tips.jpeg', source: String.raw`L:\AKODUS\01-Products\Tawreed\outputs\01a1a2a8-81b9-7b81-9886-62f83a40b0a4\excel-update-work\recovered-whatsapp-candidates\013-5a30ae6623bc.jpg`, width: 600, height: 600 },
];

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).filter((line) => line && !line.trim().startsWith('#') && line.includes('=')).map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }));
}

function uuidFromSha(sha) {
  const hex = `${sha.slice(0, 12)}5${sha.slice(13, 16)}a${sha.slice(17, 32)}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const env = parseEnv(await fs.readFile(envPath, 'utf8'));
const baseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const secretKey = env.SUPABASE_SECRET_KEY;
if (!baseUrl || !secretKey) throw new Error('Missing Supabase credentials in Code/.env');

await fs.mkdir(originalsDir, { recursive: true });
await fs.mkdir(preparedDir, { recursive: true });

const manifest = [];
for (const image of images) {
  const bytes = await fs.readFile(image.source);
  const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
  const originalPath = path.join(originalsDir, image.file);
  const preparedPath = path.join(preparedDir, image.file);
  await fs.writeFile(originalPath, bytes);
  await fs.writeFile(preparedPath, bytes);

  const objectKey = `whatsapp-updates/2026-11-04/${checksum}.jpeg`;
  const encodedPath = objectKey.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${baseUrl}/storage/v1/object/product-media/${encodedPath}`, {
    method: 'POST',
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
      'cache-control': '3600',
    },
    body: bytes,
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`Upload failed for ${image.file}: ${response.status} ${responseText}`);
  manifest.push({
    ...image,
    source: image.source,
    originalPath,
    preparedPath,
    checksum,
    bytes: bytes.length,
    mediaAssetId: uuidFromSha(checksum),
    objectKey,
    publicUrl: `${baseUrl}/storage/v1/object/public/product-media/${objectKey}`,
  });
  console.log(JSON.stringify({ uploaded: image.id, objectKey, bytes: bytes.length }));
}

await fs.mkdir(path.join(packageRoot, '03-sources'), { recursive: true });
await fs.writeFile(path.join(packageRoot, '03-sources', 'image-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ complete: true, count: manifest.length, manifest: path.join(packageRoot, '03-sources', 'image-manifest.json') }));
