import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const cliEntry = resolve(root, 'node_modules/supabase/dist/supabase.js');
const status = execFileSync(process.execPath, [cliEntry, 'status', '-o', 'env'], { cwd: root, encoding: 'utf8' });
const local = Object.fromEntries(status.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) return [];
  return [[match[1], match[2].replace(/^"|"$/g, '')]];
}));

for (const key of ['API_URL', 'PUBLISHABLE_KEY', 'SERVICE_ROLE_KEY']) {
  if (!local[key]) throw new Error(`Supabase local status did not provide ${key}`);
}

const email = `catalog-check-${crypto.randomUUID()}@example.test`;
const password = `Local-${crypto.randomUUID()}-9a!`;
let userId;

const json = async (response) => {
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(body)}`);
  return body;
};

try {
  const created = await json(await fetch(`${local.API_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: local.SERVICE_ROLE_KEY, Authorization: `Bearer ${local.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: 'فحص الكتالوج المحلي' } }),
  }));
  userId = created.id;

  const session = await json(await fetch(`${local.API_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: local.PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }));
  const headers = { apikey: local.PUBLISHABLE_KEY, Authorization: `Bearer ${session.access_token}` };
  const categories = await json(await fetch(`${local.API_URL}/rest/v1/categories?select=id,slug,name_ar,name_en&order=sort_order`, { headers }));
  const products = await json(await fetch(`${local.API_URL}/rest/v1/products?select=sku,name_ar,name_en,specifications_ar,availability,product_prices(amount_minor)&product_prices.active=eq.true&order=sku&limit=250`, { headers }));
  const sourcing = await json(await fetch(`${local.API_URL}/rest/v1/product_sourcing_suggestions?select=product_id,suggested_brands,catalog_priority`, {
    headers: { apikey: local.SERVICE_ROLE_KEY, Authorization: `Bearer ${local.SERVICE_ROLE_KEY}` },
  }));
  const englishSearch = await json(await fetch(`${local.API_URL}/rest/v1/products?select=sku&search_text=ilike.*Flowable%20Composite*`, { headers }));
  const skuSearch = await json(await fetch(`${local.API_URL}/rest/v1/products?select=sku&search_text=ilike.*TWD-DEN-0196*`, { headers }));

  if (categories.length !== 12) throw new Error(`Expected 12 categories, received ${categories.length}`);
  if (categories.some((category) => !category.name_ar || !category.name_en)) throw new Error('One or more categories lost a bilingual name');
  if (products.length !== 198) throw new Error(`Expected 198 products, received ${products.length}`);
  if (products.some((product) => !product.name_ar || !product.name_en || !product.specifications_ar)) {
    throw new Error('One or more catalog records lost required source fields');
  }
  if (sourcing.length !== 198 || sourcing.some((entry) => !entry.catalog_priority)) throw new Error('Internal sourcing metadata is incomplete');
  if (products.some((product) => product.availability !== 'unavailable' || product.product_prices.length !== 0)) {
    throw new Error('Unverified catalog records must not expose price or purchasable availability');
  }
  if (!englishSearch.some((product) => product.sku === 'TWD-DEN-0002')) throw new Error('English product-name search failed');
  if (!skuSearch.some((product) => product.sku === 'TWD-DEN-0196')) throw new Error('SKU search failed');

  console.log('Verified authenticated catalog API: 12 bilingual categories, 198 complete products, Arabic/English/SKU search, 0 invented prices.');
} finally {
  if (userId) {
    const response = await fetch(`${local.API_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { apikey: local.SERVICE_ROLE_KEY, Authorization: `Bearer ${local.SERVICE_ROLE_KEY}` },
    });
    if (!response.ok) console.warn('Temporary local verification user could not be removed.');
  }
}
