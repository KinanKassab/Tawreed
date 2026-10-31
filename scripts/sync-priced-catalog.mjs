import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, 'data', 'catalogs', 'tawreed_priced_catalog_usd.json');
const catalog = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const apply = process.argv.includes('--apply');
const confirmation = process.env.TAWREED_CONFIRM_CATALOG_REPLACE;

const env = Object.fromEntries(
  fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const baseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const secretKey = env.SUPABASE_SECRET_KEY;
if (!baseUrl || !secretKey) throw new Error('Hosted Supabase URL/server key are unavailable.');
if (catalog.currency !== 'USD' || catalog.decimalPlaces !== 2) throw new Error('Unexpected catalog currency configuration.');

const headers = {
  apikey: secretKey,
  Authorization: `Bearer ${secretKey}`,
  'Content-Type': 'application/json',
};

async function rest(pathname, init = {}) {
  const response = await fetch(`${baseUrl}/rest/v1/${pathname}`, { ...init, headers: { ...headers, ...init.headers } });
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${pathname}: ${response.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function deleteStorageObject(objectKey) {
  const objectPath = objectKey.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${baseUrl}/storage/v1/object/product-media/${objectPath}`, {
    method: 'DELETE',
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
  });
  const body = await response.text();
  const alreadyMissing = response.status === 404
    || (response.status === 400 && /not found|does not exist/i.test(body));
  if (!response.ok && !alreadyMissing) {
    throw new Error(`Storage cleanup failed for ${objectKey}: ${response.status} ${body.slice(0, 300)}`);
  }
}

const normalize = (value) => value.normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[\sـ]+/g, ' ').trim().toLowerCase();
const groupKey = (slug, name) => `priced-${slug}-${crypto.createHash('sha1').update(name).digest('hex').slice(0, 12)}`;
const amountMinor = (value) => Math.round(value * 100);

const categories = catalog.categories;
const desired = [];
let sequence = 1;
for (const category of categories) {
  for (const item of category.items) {
    const options = item.options ?? [{ label: null, price: item.price ?? null }];
    const grouped = Boolean(item.options);
    for (const option of options) {
      desired.push({
        sequence: sequence++,
        categorySlug: category.slug,
        categoryName: category.name,
        nameAr: item.name,
        optionLabelAr: option.label,
        variantGroupKey: grouped ? groupKey(category.slug, item.name) : null,
        price: option.price,
        active: typeof option.price === 'number',
      });
    }
  }
}

const existingProducts = await rest('products?select=id,sku,name_ar,name_en,manufacturer,unit_label_ar,package_label_ar,description_ar,specifications_ar,availability,active,category_id,variant_group_key,variant_label_ar&order=sku&limit=1000');
const archivedProducts = existingProducts.filter((product) => !product.active);
const liveProducts = existingProducts.filter((product) => product.active);
const existingCategories = await rest('categories?select=id,slug,name_ar,name_en,active&limit=1000');

const categoriesBySlug = new Map(existingCategories.map((category) => [category.slug, category]));
const categoryRows = categories.map((category) => ({
  id: categoriesBySlug.get(category.slug)?.id ?? crypto.randomUUID(),
  slug: category.slug,
  name_ar: category.name,
  name_en: categoriesBySlug.get(category.slug)?.name_en ?? null,
  active: true,
}));
const categoryIdBySlug = new Map(categoryRows.map((category) => [category.slug, category.id]));

const unusedLive = new Map();
for (const product of liveProducts) {
  const key = `${normalize(product.name_ar)}|${normalize(product.variant_label_ar ?? product.package_label_ar ?? '')}`;
  unusedLive.set(key, [...(unusedLive.get(key) ?? []), product]);
}

let reused = 0;
let created = 0;
for (const row of desired) {
  const key = `${normalize(row.nameAr)}|${normalize(row.optionLabelAr ?? '')}`;
  const matches = unusedLive.get(key) ?? [];
  const existing = matches.shift();
  if (existing) {
    row.id = existing.id;
    row.sku = existing.sku;
    row.existing = existing;
    reused++;
  } else {
    row.id = crypto.randomUUID();
    row.sku = row.active
      ? `TWD-USD-${String(row.sequence).padStart(4, '0')}`
      : `TWD-USD-ARCH-${String(row.sequence).padStart(4, '0')}`;
    created++;
  }
}

const desiredIds = new Set(desired.map((row) => row.id));
const newlyArchived = liveProducts.filter((product) => !desiredIds.has(product.id));
const pricedRows = desired.filter((row) => row.active);
const unpricedRows = desired.filter((row) => !row.active);

const report = {
  mode: apply ? 'apply' : 'dry-run',
  before: { total: existingProducts.length, active: liveProducts.length, archived: archivedProducts.length },
  incoming: { categories: categories.length, groupedProducts: categories.reduce((sum, category) => sum + category.items.length, 0), rows: desired.length, pricedRows: pricedRows.length, rowsArchivedForMissingPrice: unpricedRows.length },
  matching: {
    reused,
    created,
    createdPriced: desired.filter((row) => !row.existing && row.active).length,
    createdArchived: desired.filter((row) => !row.existing && !row.active).length,
    currentActiveArchivedAsMissing: newlyArchived.length,
  },
  afterExpected: { activeRows: pricedRows.length, archivedRows: unpricedRows.length + newlyArchived.length, visibleGroupedProducts: categories.reduce((sum, category) => sum + category.items.filter((item) => item.options ? item.options.some((option) => typeof option.price === 'number') : typeof item.price === 'number').length, 0) },
};
console.log(JSON.stringify(report, null, 2));

if (!apply) process.exit(0);
if (confirmation !== 'DELETE-ALL-ARCHIVED-AND-REPLACE-CATALOG') {
  throw new Error('Refusing destructive catalog replacement without the exact confirmation environment value.');
}

// Capture media belonging to products that are already archived before deleting those products.
const archivedIds = archivedProducts.map((product) => product.id);
let archivedMediaLinks = [];
if (archivedIds.length) {
  const archivedOrderItems = await rest(`order_items?select=id&product_id=in.(${archivedIds.join(',')})&limit=1`);
  if (archivedOrderItems.length) {
    throw new Error('Refusing to delete archived products referenced by historical order items.');
  }
  archivedMediaLinks = await rest(`product_media?select=product_id,media_asset_id,media_assets(id,provider,object_key)&product_id=in.(${archivedIds.join(',')})&limit=1000`);
  for (const table of ['order_inventory_reservations', 'inventory_movements', 'inventory_batches', 'inventory_balances', 'purchase_order_items']) {
    await rest(`${table}?product_id=in.(${archivedIds.join(',')})`, { method: 'DELETE' });
  }
  await rest(`products?id=in.(${archivedIds.join(',')})`, { method: 'DELETE' });
}

// Delete only media assets that became unreferenced because the already-archived products were deleted.
if (archivedMediaLinks.length) {
  const remainingLinks = await rest('product_media?select=media_asset_id&limit=5000');
  const referenced = new Set(remainingLinks.map((link) => link.media_asset_id));
  for (const link of archivedMediaLinks) {
    if (referenced.has(link.media_asset_id)) continue;
    const asset = Array.isArray(link.media_assets) ? link.media_assets[0] : link.media_assets;
    if (asset?.provider === 'supabase' && asset.object_key) {
      await deleteStorageObject(asset.object_key);
    }
    await rest(`media_assets?id=eq.${link.media_asset_id}`, { method: 'DELETE' });
  }
}

await rest('categories?on_conflict=slug', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(categoryRows),
});
const desiredCategoryIds = new Set(categoryRows.map((category) => category.id));
const obsoleteCategories = existingCategories.filter((category) => !desiredCategoryIds.has(category.id));
if (obsoleteCategories.length) {
  await rest(`categories?id=in.(${obsoleteCategories.map((category) => category.id).join(',')})`, {
    method: 'PATCH',
    body: JSON.stringify({ active: false }),
  });
}

if (newlyArchived.length) {
  const ids = newlyArchived.map((product) => product.id);
  await rest(`products?id=in.(${ids.join(',')})`, { method: 'PATCH', body: JSON.stringify({ active: false, availability: 'unavailable' }) });
  await rest(`product_prices?product_id=in.(${ids.join(',')})&active=eq.true`, { method: 'PATCH', body: JSON.stringify({ active: false, valid_to: new Date().toISOString() }) });
}

const productRows = desired.map((row) => ({
  id: row.id,
  sku: row.sku,
  name_ar: row.nameAr,
  name_en: row.existing?.name_en ?? null,
  manufacturer: row.existing?.manufacturer ?? null,
  unit_label_ar: row.existing?.unit_label_ar ?? 'قطعة',
  package_label_ar: row.optionLabelAr ?? row.existing?.package_label_ar ?? null,
  description_ar: row.existing?.description_ar ?? null,
  specifications_ar: row.existing?.specifications_ar ?? null,
  category_id: categoryIdBySlug.get(row.categorySlug),
  availability: 'unavailable',
  active: row.active,
  variant_group_key: row.variantGroupKey,
  variant_label_ar: row.optionLabelAr,
}));
for (let index = 0; index < productRows.length; index += 100) {
  await rest('products?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(productRows.slice(index, index + 100)),
  });
}

const allDesiredIds = desired.map((row) => row.id);
await rest(`product_prices?product_id=in.(${allDesiredIds.join(',')})`, { method: 'DELETE' });
const priceRows = pricedRows.map((row) => ({
  product_id: row.id,
  currency: catalog.currency,
  amount_minor: amountMinor(row.price),
  decimal_places: catalog.decimalPlaces,
  active: true,
}));
for (let index = 0; index < priceRows.length; index += 100) {
  await rest('product_prices', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(priceRows.slice(index, index + 100)) });
}

// Remove media records and Storage objects that no longer belong to any product.
const allMediaAssets = await rest('media_assets?select=id,provider,object_key&limit=5000');
const allMediaLinks = await rest('product_media?select=media_asset_id&limit=5000');
const referencedMediaIds = new Set(allMediaLinks.map((link) => link.media_asset_id));
const orphanedMediaAssets = allMediaAssets.filter((asset) => !referencedMediaIds.has(asset.id));
for (const asset of orphanedMediaAssets) {
  if (asset.provider === 'supabase' && asset.object_key) await deleteStorageObject(asset.object_key);
  await rest(`media_assets?id=eq.${asset.id}`, { method: 'DELETE' });
}

const verificationProducts = await rest('products?select=id,name_ar,active,variant_group_key,variant_label_ar,product_prices(amount_minor,currency,active)&limit=1000');
const activeRows = verificationProducts.filter((product) => product.active);
const archivedRows = verificationProducts.filter((product) => !product.active);
const activeWithoutPrice = activeRows.filter((product) => !product.product_prices?.some((price) => price.active));
const archivedWithPrice = archivedRows.filter((product) => product.product_prices?.some((price) => price.active));
if (
  verificationProducts.length !== desired.length
  || activeRows.length !== pricedRows.length
  || archivedRows.length !== unpricedRows.length
  || activeWithoutPrice.length
  || archivedWithPrice.length
) {
  throw new Error(
    `Verification failed: ${verificationProducts.length} total, ${activeRows.length} active, ${archivedRows.length} archived, `
    + `${activeWithoutPrice.length} active without price, ${archivedWithPrice.length} archived with active price.`,
  );
}
console.log(JSON.stringify({
  applied: true,
  totalRows: verificationProducts.length,
  activeRows: activeRows.length,
  archivedRows: archivedRows.length,
  activeWithoutPrice: activeWithoutPrice.length,
  archivedWithPrice: archivedWithPrice.length,
  orphanedMediaAssetsDeleted: orphanedMediaAssets.length,
}, null, 2));
