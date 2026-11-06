import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const projectRoot = path.resolve(root, '..');
const extractPath = path.join(root, 'data', 'catalogs', 'tawreed_excel_catalog_extract.json');
const reportPath = path.join(root, 'data', 'catalogs', 'tawreed_excel_catalog_sync_report.json');
const apply = process.argv.includes('--apply');
const emitPriceSql = process.argv.includes('--emit-price-sql');
const emitMediaSql = process.argv.includes('--upload-storage-and-emit-media-sql');
const verifyOnly = process.argv.includes('--verify-only');
const confirmation = process.env.TAWREED_CONFIRM_EXCEL_SYNC;
if (apply) throw new Error('Direct --apply is disabled. Use --emit-price-sql, --upload-storage-and-emit-media-sql, then --verify-only so audited SQL runs with database-owner privileges.');

const env = Object.fromEntries(
  (await fs.readFile(path.join(root, '.env'), 'utf8')).split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
const baseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const secretKey = env.SUPABASE_SECRET_KEY;
if (!baseUrl || !secretKey) throw new Error('Hosted Supabase URL/secret key are unavailable.');
if (/127\.0\.0\.1|localhost/.test(baseUrl)) throw new Error('This script is intended for the configured hosted catalog.');

const headers = { apikey: secretKey, Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' };
async function rest(pathname, init = {}) {
  const response = await fetch(`${baseUrl}/rest/v1/${pathname}`, { ...init, headers: { ...headers, ...init.headers } });
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${pathname}: ${response.status} ${text.slice(0, 1000)}`);
  return text ? JSON.parse(text) : null;
}
const chunks = (items, size = 50) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
const normalize = (value) => String(value ?? '').normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[\sـ]+/g, ' ').trim().toLowerCase();
const textOrNull = (value) => String(value ?? '').trim() || null;
const numberOrNull = (value) => value === null || value === undefined || value === '' || Number.isNaN(Number(value)) ? null : Number(value);
const slugify = (value) => String(value).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase();

const extract = JSON.parse(await fs.readFile(extractPath, 'utf8'));
const productRows = extract.sheets.products.rows.filter((row) => row.group_id && row.review_action !== 'REMOVE');
const productByGroup = new Map(productRows.map((row) => [row.group_id, row]));
const optionRows = extract.sheets.options.rows.filter((row) => productByGroup.has(row.group_id) && row.review_action !== 'REMOVE');
const optionsByGroup = new Map();
for (const row of optionRows) optionsByGroup.set(row.group_id, [...(optionsByGroup.get(row.group_id) ?? []), row]);

const desired = [];
for (const product of productRows) {
  const sourceOptions = optionsByGroup.get(product.group_id) ?? [];
  const options = sourceOptions.length ? sourceOptions : [{ option_id: null, option_label_ar: null, price: null, new_price: null, review_action: 'BASE', excelRow: null }];
  const labels = options.map((option) => option.review_action === 'ADD'
    ? textOrNull(option.new_option_label_ar) ?? textOrNull(option.option_label_ar)
    : textOrNull(option.option_label_ar));
  const grouped = options.length > 1 || labels.some(Boolean);
  options.forEach((option, index) => {
    const label = labels[index];
    const price = numberOrNull(option.new_price) ?? numberOrNull(option.price);
    desired.push({
      groupId: product.group_id,
      categoryAr: product.category_ar,
      nameAr: product.product_name_ar,
      nameEn: textOrNull(product.product_name_en),
      optionId: textOrNull(option.option_id),
      labelAr: label,
      price,
      active: price !== null,
      groupKey: grouped ? `excel-${normalize(product.group_id).replace(/[^a-z0-9]+/g, '-')}` : null,
      product,
      option,
    });
  });
}

const categorySlugs = new Map([
  ['سوائل', 'liquids'], ['سمنتات', 'cements'], ['ترميمية', 'restorative'], ['كومبوزت', 'composite'],
  ['سنابل', 'burs'], ['أجهزة', 'equipment'], ['معدنيات', 'metal-instruments'], ['إنفكشن كنترول', 'infection-control'],
  ['جراحة', 'surgery'], ['تعويضات ثابتة / متحركة', 'prosthodontics'], ['لبية', 'endodontics'],
]);

const existingCategories = await rest('categories?select=id,slug,name_ar,name_en,sort_order,active&limit=1000');
const existingProducts = await rest('products?select=id,sku,name_ar,name_en,manufacturer,unit_label_ar,package_label_ar,description_ar,specifications_ar,availability,active,category_id,variant_group_key,variant_label_ar,product_prices(id,amount_minor,currency,decimal_places,active),product_media(media_asset_id,is_primary,sort_order)&order=sku&limit=1000');
const existingAssets = await rest('media_assets?select=id,provider,object_key,mime_type,width,height,checksum&limit=5000');
const warehouses = await rest('warehouses?select=id&active=eq.true&order=created_at&limit=1');
if (!warehouses.length) throw new Error('No active warehouse is available.');

const categoryByName = new Map(existingCategories.map((row) => [normalize(row.name_ar), row]));
const categories = [...new Set(productRows.map((row) => row.category_ar))].map((nameAr, index) => {
  const existing = categoryByName.get(normalize(nameAr));
  const slug = categorySlugs.get(nameAr);
  if (!slug) throw new Error(`Unknown Excel category: ${nameAr}`);
  return { id: existing?.id ?? crypto.randomUUID(), slug, name_ar: nameAr, name_en: existing?.name_en ?? null, sort_order: existing?.sort_order ?? index + 1, active: true };
});
const categoryIdByName = new Map(categories.map((row) => [normalize(row.name_ar), row.id]));

const existingByKey = new Map();
const existingBySku = new Map(existingProducts.map((row) => [row.sku, row]));
for (const row of existingProducts) {
  const key = `${normalize(row.name_ar)}|${normalize(row.variant_label_ar ?? row.package_label_ar)}`;
  existingByKey.set(key, [...(existingByKey.get(key) ?? []), row]);
}
const usedExistingIds = new Set();
let reused = 0;
let created = 0;
for (const row of desired) {
  const key = `${normalize(row.nameAr)}|${normalize(row.labelAr)}`;
  const candidates = (existingByKey.get(key) ?? []).filter((candidate) => !usedExistingIds.has(candidate.id));
  const legacyNumber = /^OPT-(\d+)$/.exec(row.optionId ?? '')?.[1];
  const legacySku = legacyNumber ? `TWD-USD-${legacyNumber.padStart(4, '0')}` : null;
  const byLegacySku = legacySku ? existingBySku.get(legacySku) : null;
  const existing = byLegacySku && !usedExistingIds.has(byLegacySku.id) ? byLegacySku : candidates[0] ?? null;
  if (existing) {
    row.id = existing.id;
    row.sku = existing.sku;
    row.existing = existing;
    usedExistingIds.add(existing.id);
    reused++;
  } else {
    row.id = crypto.randomUUID();
    row.sku = `TWD-XLS-${slugify(row.groupId)}${row.optionId ? `-${slugify(row.optionId)}` : ''}`.slice(0, 96);
    if (desired.some((other) => other !== row && other.sku === row.sku)) row.sku = `${row.sku.slice(0, 83)}-${crypto.randomUUID().slice(0, 12)}`;
    created++;
  }
}

const desiredIds = new Set(desired.map((row) => row.id));
const toArchive = existingProducts.filter((row) => !desiredIds.has(row.id) && row.active);
const alreadyArchivedMissing = existingProducts.filter((row) => !desiredIds.has(row.id) && !row.active);
const changedPrices = [];
for (const row of desired) {
  const activeUsd = row.existing?.product_prices?.find((price) => price.active && price.currency === 'USD') ?? null;
  const activePrices = row.existing?.product_prices?.filter((price) => price.active) ?? [];
  const desiredMinor = row.price === null ? null : Math.round(row.price * 100);
  if ((desiredMinor === null && activePrices.length) || (desiredMinor !== null && (!activeUsd || activeUsd.amount_minor !== desiredMinor))) {
    changedPrices.push({ row, activePrices, desiredMinor });
  }
}

const imageRows = extract.sheets.images.rows.filter((row) => productByGroup.has(row.group_id) && row.status === 'AVAILABLE' && row.image_path && row.sha256);
const imagesByGroup = new Map();
const uniqueImages = new Map();
for (const row of imageRows) {
  const localPath = path.resolve(projectRoot, String(row.image_path).replaceAll('/', path.sep));
  const image = { ...row, localPath };
  imagesByGroup.set(row.group_id, [...(imagesByGroup.get(row.group_id) ?? []), image]);
  uniqueImages.set(row.sha256, image);
}
const missingImageFiles = [];
for (const image of uniqueImages.values()) {
  try { await fs.access(image.localPath); } catch { missingImageFiles.push({ groupId: image.group_id, path: image.localPath }); }
}
const groupsWithoutImages = productRows.filter((row) => !(imagesByGroup.get(row.group_id)?.length)).map((row) => ({ groupId: row.group_id, nameAr: row.product_name_ar }));
const existingAssetByChecksum = new Map(existingAssets.filter((asset) => asset.checksum).map((asset) => [String(asset.checksum).toLowerCase(), asset]));
const imagesToUpload = [...uniqueImages.values()].filter((image) => !existingAssetByChecksum.has(String(image.sha256).toLowerCase()));

const report = {
  mode: apply ? 'apply' : 'dry-run',
  target: new URL(baseUrl).hostname,
  sourceWorkbook: extract.source,
  before: { products: existingProducts.length, active: existingProducts.filter((row) => row.active).length, archived: existingProducts.filter((row) => !row.active).length, mediaAssets: existingAssets.length },
  excel: { groups: productRows.length, optionRows: optionRows.length, desiredProductRows: desired.length, pricedRows: desired.filter((row) => row.active).length, archivedForMissingPrice: desired.filter((row) => !row.active).length },
  matching: { reused, created, activeRowsToArchive: toArchive.length, alreadyArchivedMissing: alreadyArchivedMissing.length, pricesToChange: changedPrices.length },
  media: { excelRows: imageRows.length, uniqueFiles: uniqueImages.size, reusableAssets: uniqueImages.size - imagesToUpload.length, filesToUpload: imagesToUpload.length, missingFiles: missingImageFiles.length, groupsWithoutImages: groupsWithoutImages.length },
  createdRows: desired.filter((row) => !row.existing).map((row) => ({ groupId: row.groupId, nameAr: row.nameAr, labelAr: row.labelAr, price: row.price, sku: row.sku })),
  archivedRows: toArchive.map((row) => ({ id: row.id, sku: row.sku, nameAr: row.name_ar, labelAr: row.variant_label_ar ?? row.package_label_ar })),
  missingImageFiles,
  groupsWithoutImages,
};
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

if (emitPriceSql) {
  const priceSqlPath = path.join(root, 'data', 'catalogs', 'tawreed_excel_price_sync.sql');
  const allProductIds = existingProducts.map((row) => `'${row.id}'::uuid`).join(',\n  ');
  const priceValues = desired.filter((row) => row.price !== null)
    .map((row) => `  ('${row.id}'::uuid, 'USD'::public.currency_code, ${Math.round(row.price * 100)}::bigint, 2::smallint, true)`)
    .join(',\n');
  const sql = `begin;\n\nupdate public.product_prices\nset active = false,\n    valid_to = greatest(clock_timestamp(), valid_from + interval '1 microsecond')\nwhere active and product_id in (\n  ${allProductIds}\n);\n\ninsert into public.product_prices(product_id, currency, amount_minor, decimal_places, active) values\n${priceValues};\n\ncommit;\n`;
  await fs.writeFile(priceSqlPath, sql);
  console.log(JSON.stringify({ priceSqlPath, rows: desired.filter((row) => row.price !== null).length }));
  process.exit(0);
}

if (emitMediaSql) {
  if (missingImageFiles.length) throw new Error(`Cannot upload media: ${missingImageFiles.length} image files are missing.`);
  const sqlText = (value) => value === null ? 'null' : `'${String(value).replaceAll("'", "''")}'`;
  const deterministicUuid = (checksum) => {
    const bytes = Buffer.from(String(checksum).slice(0, 32), 'hex');
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  };
  const assetByChecksum = new Map(existingAssetByChecksum);
  const assetsToInsert = [];
  let uploaded = 0;
  for (const image of uniqueImages.values()) {
    const checksum = String(image.sha256).toLowerCase();
    if (assetByChecksum.has(checksum)) continue;
    const buffer = await fs.readFile(image.localPath);
    const actualChecksum = crypto.createHash('sha256').update(buffer).digest('hex');
    if (actualChecksum !== checksum) throw new Error(`Checksum mismatch: ${image.localPath}`);
    const type = imageType(buffer, image.file_name);
    const dimensions = imageDimensions(buffer);
    const objectKey = `excel-catalog/${image.group_id}/${checksum}.${type.extension}`;
    await uploadStorage(objectKey, buffer, type.mime);
    const asset = {
      id: deterministicUuid(checksum), provider: 'supabase', object_key: objectKey, mime_type: type.mime,
      alt_text_ar: productByGroup.get(image.group_id)?.product_name_ar ?? image.product_name_ar,
      width: dimensions.width, height: dimensions.height, checksum,
      metadata: { purpose: 'excel-catalog', source_path: image.image_path, excel_group_id: image.group_id, normalized: false },
    };
    assetByChecksum.set(checksum, asset);
    assetsToInsert.push(asset);
    uploaded++;
    if (uploaded % 25 === 0) console.log(JSON.stringify({ progress: 'storage-upload', uploaded, total: imagesToUpload.length }));
  }
  const mediaLinks = [];
  for (const [groupId, rows] of Map.groupBy(desired, (row) => row.groupId)) {
    const product = productByGroup.get(groupId);
    const images = [...(imagesByGroup.get(groupId) ?? [])].sort((a, b) => String(a.file_name).localeCompare(String(b.file_name)));
    if (!images.length) continue;
    const primaryIndex = Math.max(0, images.findIndex((image) => String(image.image_path) === String(product.image_link)));
    const ordered = [images[primaryIndex], ...images.filter((_, index) => index !== primaryIndex)];
    for (const row of rows) ordered.forEach((image, index) => mediaLinks.push({ product_id: row.id, media_asset_id: assetByChecksum.get(String(image.sha256).toLowerCase()).id, sort_order: index, is_primary: index === 0 }));
  }
  const assetValues = assetsToInsert.map((asset) => `  (${sqlText(asset.id)}::uuid, 'supabase'::public.media_provider, ${sqlText(asset.object_key)}, ${sqlText(asset.mime_type)}, ${sqlText(asset.alt_text_ar)}, ${asset.width}, ${asset.height}, ${sqlText(asset.checksum)}, ${sqlText(JSON.stringify(asset.metadata))}::jsonb)`).join(',\n');
  const linkValues = mediaLinks.map((link) => `  (${sqlText(link.product_id)}::uuid, ${sqlText(link.media_asset_id)}::uuid, ${link.sort_order}, ${link.is_primary})`).join(',\n');
  const desiredIdValues = desired.map((row) => `${sqlText(row.id)}::uuid`).join(',\n  ');
  const mediaSql = `begin;\n\n${assetValues ? `insert into public.media_assets(id, provider, object_key, mime_type, alt_text_ar, width, height, checksum, metadata) values\n${assetValues}\non conflict (id) do update set object_key=excluded.object_key, mime_type=excluded.mime_type, alt_text_ar=excluded.alt_text_ar, width=excluded.width, height=excluded.height, checksum=excluded.checksum, metadata=excluded.metadata;\n\n` : ''}delete from public.product_media where product_id in (\n  ${desiredIdValues}\n);\n\n${linkValues ? `insert into public.product_media(product_id, media_asset_id, sort_order, is_primary) values\n${linkValues}\non conflict (product_id, media_asset_id) do update set sort_order=excluded.sort_order, is_primary=excluded.is_primary;\n\n` : ''}commit;\n`;
  const mediaSqlPath = path.join(root, 'data', 'catalogs', 'tawreed_excel_media_sync.sql');
  await fs.writeFile(mediaSqlPath, mediaSql);
  console.log(JSON.stringify({ mediaSqlPath, uploaded, assetsToInsert: assetsToInsert.length, mediaLinks: mediaLinks.length }));
  process.exit(0);
}

if (verifyOnly) {
  const failures = [];
  const desiredMatched = desired.filter((row) => row.existing);
  if (desiredMatched.length !== desired.length) failures.push(`${desired.length - desiredMatched.length} desired rows do not match a database row`);
  if (toArchive.length) failures.push(`${toArchive.length} non-Excel rows remain active`);
  if (changedPrices.length) failures.push(`${changedPrices.length} price rows differ from Excel`);
  let expectedMediaLinks = 0;
  let actualMediaLinks = 0;
  for (const row of desired) {
    const actual = row.existing;
    if (!actual) continue;
    if (actual.active !== row.active) failures.push(`${actual.sku}: active mismatch`);
    const activeUsd = actual.product_prices?.find((price) => price.active && price.currency === 'USD');
    if (row.price !== null && activeUsd?.amount_minor !== Math.round(row.price * 100)) failures.push(`${actual.sku}: USD price mismatch`);
    if (row.price === null && actual.product_prices?.some((price) => price.active)) failures.push(`${actual.sku}: unpriced row has active price`);
    const expectedImages = imagesByGroup.get(row.groupId)?.length ?? 0;
    const actualImages = actual.product_media?.length ?? 0;
    expectedMediaLinks += expectedImages;
    actualMediaLinks += actualImages;
    if (actualImages !== expectedImages) failures.push(`${actual.sku}: expected ${expectedImages} images, found ${actualImages}`);
    if (expectedImages && actual.product_media.filter((link) => link.is_primary).length !== 1) failures.push(`${actual.sku}: expected exactly one primary image`);
  }
  const storageAssets = [...uniqueImages.keys()].map((checksum) => existingAssetByChecksum.get(String(checksum).toLowerCase())).filter(Boolean);
  const missingStorageObjects = [];
  for (const batch of chunks(storageAssets, 12)) {
    const results = await Promise.all(batch.map(async (asset) => {
      const objectPath = asset.object_key.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`${baseUrl}/storage/v1/object/public/product-media/${objectPath}`, { method: 'HEAD' });
      return { asset, ok: response.ok, status: response.status };
    }));
    missingStorageObjects.push(...results.filter((result) => !result.ok).map((result) => ({ objectKey: result.asset.object_key, status: result.status })));
  }
  if (missingStorageObjects.length) failures.push(`${missingStorageObjects.length} Storage objects are unavailable`);
  const verification = {
    applied: true,
    verifiedAt: new Date().toISOString(),
    target: new URL(baseUrl).hostname,
    totals: {
      databaseProducts: existingProducts.length,
      desiredProducts: desired.length,
      activeProducts: existingProducts.filter((row) => row.active).length,
      archivedProducts: existingProducts.filter((row) => !row.active).length,
      excelGroups: productRows.length,
      pricedRows: desired.filter((row) => row.active).length,
      excelUniqueImages: uniqueImages.size,
      matchedMediaAssets: storageAssets.length,
      expectedMediaLinks,
      actualMediaLinks,
      groupsWithoutImages: groupsWithoutImages.length,
    },
    failures,
    missingStorageObjects,
    groupsWithoutImages,
  };
  await fs.writeFile(reportPath, JSON.stringify(verification, null, 2) + '\n');
  console.log(JSON.stringify(verification, null, 2));
  if (failures.length) process.exit(1);
  process.exit(0);
}

if (!apply) process.exit(0);
if (confirmation !== 'APPLY-EXCEL-CATALOG-AND-ARCHIVE-MISSING') throw new Error('Refusing hosted Excel sync without the exact confirmation environment value.');
if (missingImageFiles.length) throw new Error(`Refusing sync because ${missingImageFiles.length} Excel image files are missing.`);
if (reused < 120 || created > 70) throw new Error(`Refusing suspicious match plan: reused=${reused}, created=${created}.`);

await rest('categories?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(categories) });

const dbProductRows = desired.map((row) => ({
  id: row.id,
  sku: row.sku,
  name_ar: row.nameAr,
  name_en: row.nameEn ?? row.existing?.name_en ?? null,
  manufacturer: row.existing?.manufacturer ?? null,
  unit_label_ar: row.existing?.unit_label_ar ?? 'قطعة',
  package_label_ar: row.labelAr,
  description_ar: row.existing?.description_ar ?? null,
  specifications_ar: row.existing?.specifications_ar ?? null,
  category_id: categoryIdByName.get(normalize(row.categoryAr)),
  availability: row.existing?.availability ?? 'unavailable',
  active: row.active,
  variant_group_key: row.groupKey,
  variant_label_ar: row.labelAr,
}));
for (const batch of chunks(dbProductRows, 75)) await rest('products?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(batch) });

const newRows = desired.filter((row) => !row.existing);
for (const batch of chunks(newRows, 75)) await rest('inventory_balances?on_conflict=warehouse_id,product_id', {
  method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
  body: JSON.stringify(batch.map((row) => ({ warehouse_id: warehouses[0].id, product_id: row.id, on_hand: 0, reserved: 0 }))),
});

const now = new Date().toISOString();
const idsToArchive = [...toArchive, ...alreadyArchivedMissing].map((row) => row.id);
for (const batch of chunks(idsToArchive)) {
  const inFilter = batch.join(',');
  await rest(`products?id=in.(${inFilter})`, { method: 'PATCH', body: JSON.stringify({ active: false, availability: 'unavailable' }) });
  await rest(`product_prices?product_id=in.(${inFilter})&active=eq.true`, { method: 'PATCH', body: JSON.stringify({ active: false, valid_to: now }) });
}

for (const change of changedPrices) {
  if (change.activePrices.length) await rest(`product_prices?id=in.(${change.activePrices.map((price) => price.id).join(',')})`, { method: 'PATCH', body: JSON.stringify({ active: false, valid_to: now }) });
  if (change.desiredMinor !== null) await rest('product_prices', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ product_id: change.row.id, currency: 'USD', amount_minor: change.desiredMinor, decimal_places: 2, active: true }),
  });
}

function imageType(buffer, fileName) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === '.png') return { mime: 'image/png', extension: 'png' };
  if (extension === '.webp') return { mime: 'image/webp', extension: 'webp' };
  return { mime: 'image/jpeg', extension: extension === '.jpeg' ? 'jpeg' : 'jpg' };
}
function imageDimensions(buffer) {
  if (buffer.subarray(1, 4).toString() === 'PNG') return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') {
    const type = buffer.subarray(12, 16).toString();
    if (type === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
    if (type === 'VP8L') {
      const bits = buffer.readUInt32LE(21);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
    }
    if (type === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset++; continue; }
      const marker = buffer[offset + 1];
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      if (marker === 0xd9 || marker === 0xda) break;
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }
  throw new Error('Unsupported or invalid image dimensions.');
}
async function uploadStorage(objectKey, buffer, mime) {
  const objectPath = objectKey.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${baseUrl}/storage/v1/object/product-media/${objectPath}`, {
    method: 'POST',
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}`, 'Content-Type': mime, 'x-upsert': 'true', 'cache-control': '3600' },
    body: buffer,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Storage upload ${objectKey}: ${response.status} ${text.slice(0, 500)}`);
}

const assetByChecksum = new Map(existingAssetByChecksum);
let uploaded = 0;
for (const image of uniqueImages.values()) {
  const checksum = String(image.sha256).toLowerCase();
  if (assetByChecksum.has(checksum)) continue;
  const buffer = await fs.readFile(image.localPath);
  const actualChecksum = crypto.createHash('sha256').update(buffer).digest('hex');
  if (actualChecksum !== checksum) throw new Error(`Checksum mismatch: ${image.localPath}`);
  const type = imageType(buffer, image.file_name);
  const dimensions = imageDimensions(buffer);
  const objectKey = `excel-catalog/${image.group_id}/${checksum}.${type.extension}`;
  await uploadStorage(objectKey, buffer, type.mime);
  const asset = {
    id: crypto.randomUUID(), provider: 'supabase', object_key: objectKey, mime_type: type.mime,
    alt_text_ar: productByGroup.get(image.group_id)?.product_name_ar ?? image.product_name_ar,
    width: dimensions.width, height: dimensions.height, checksum,
    metadata: { purpose: 'excel-catalog', source_path: image.image_path, excel_group_id: image.group_id, normalized: false },
  };
  await rest('media_assets', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(asset) });
  assetByChecksum.set(checksum, asset);
  uploaded++;
  if (uploaded % 25 === 0) console.log(JSON.stringify({ progress: 'media-upload', uploaded, total: imagesToUpload.length }));
}

for (const batch of chunks(desired.map((row) => row.id))) {
  await rest(`product_media?product_id=in.(${batch.join(',')})`, { method: 'DELETE' });
}
const mediaLinks = [];
for (const [groupId, rows] of Map.groupBy(desired, (row) => row.groupId)) {
  const product = productByGroup.get(groupId);
  const images = [...(imagesByGroup.get(groupId) ?? [])].sort((a, b) => String(a.file_name).localeCompare(String(b.file_name)));
  if (!images.length) continue;
  const primaryIndex = Math.max(0, images.findIndex((image) => String(image.image_path) === String(product.image_link)));
  const ordered = [images[primaryIndex], ...images.filter((_, index) => index !== primaryIndex)];
  for (const row of rows) ordered.forEach((image, index) => mediaLinks.push({ product_id: row.id, media_asset_id: assetByChecksum.get(String(image.sha256).toLowerCase()).id, sort_order: index, is_primary: index === 0 }));
}
for (const batch of chunks(mediaLinks, 100)) await rest('product_media', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(batch) });

const verified = await rest('products?select=id,sku,name_ar,active,variant_group_key,variant_label_ar,product_prices(amount_minor,currency,active),product_media(media_asset_id,is_primary)&limit=1000');
const byId = new Map(verified.map((row) => [row.id, row]));
const failures = [];
for (const row of desired) {
  const actual = byId.get(row.id);
  if (!actual) failures.push(`${row.id}: missing product`);
  else {
    if (actual.active !== row.active) failures.push(`${row.sku}: active mismatch`);
    const usd = actual.product_prices?.find((price) => price.active && price.currency === 'USD');
    if (row.price !== null && usd?.amount_minor !== Math.round(row.price * 100)) failures.push(`${row.sku}: price mismatch`);
    if (row.price === null && actual.product_prices?.some((price) => price.active)) failures.push(`${row.sku}: unpriced row has active price`);
    if ((imagesByGroup.get(row.groupId)?.length ?? 0) && !actual.product_media?.some((link) => link.is_primary)) failures.push(`${row.sku}: missing primary image`);
  }
}
const nonExcelActive = verified.filter((row) => !desiredIds.has(row.id) && row.active);
if (nonExcelActive.length) failures.push(`${nonExcelActive.length} non-Excel rows remain active`);
if (failures.length) throw new Error(`Verification failed:\n${failures.slice(0, 30).join('\n')}`);

const finalReport = {
  ...report,
  applied: true,
  appliedAt: new Date().toISOString(),
  result: { totalRows: verified.length, desiredRows: desired.length, activeRows: desired.filter((row) => row.active).length, archivedRows: verified.filter((row) => !row.active).length, uploadedMedia: uploaded, linkedMediaRows: mediaLinks.length, verificationFailures: 0 },
};
await fs.writeFile(reportPath, JSON.stringify(finalReport, null, 2) + '\n');
console.log(JSON.stringify(finalReport.result, null, 2));
