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
  const categories = await json(await fetch(`${local.API_URL}/rest/v1/categories?select=id,slug,name_ar&active=eq.true&order=sort_order`, { headers }));
  const products = await json(await fetch(`${local.API_URL}/rest/v1/products?select=sku,name_ar,active,availability,variant_group_key,variant_label_ar,product_prices(amount_minor,currency,active)&order=sku&limit=300`, { headers }));
  const arabicSearch = await json(await fetch(`${local.API_URL}/rest/v1/products?select=sku&search_text=ilike.*كومبوزت%20سيال*`, { headers }));
  const skuSearch = await json(await fetch(`${local.API_URL}/rest/v1/products?select=sku&search_text=ilike.*TWD-USD-0202*`, { headers }));

  const active = products.filter((product) => product.active);
  const visibleGroups = new Set(active.map((product) => product.variant_group_key ?? product.sku));
  if (categories.length !== 11) throw new Error(`Expected 11 categories, received ${categories.length}`);
  if (categories.some((category) => !category.name_ar)) throw new Error('One or more categories lost its Arabic name');
  if (products.length !== 167 || active.length !== 167) throw new Error(`Expected 167 publicly visible active rows, received ${products.length}/${active.length}`);
  if (visibleGroups.size !== 109) throw new Error(`Expected 109 visible grouped products, received ${visibleGroups.size}`);
  if (active.some((product) => product.availability !== 'unavailable' || product.product_prices.length !== 1 || product.product_prices[0].currency !== 'USD')) {
    throw new Error('Every active row must have exactly one explicit USD price while remaining unavailable until stock is verified');
  }
  if (!arabicSearch.length) throw new Error('Arabic product-name search failed');
  if (!skuSearch.some((product) => product.sku === 'TWD-USD-0202')) throw new Error('SKU search failed');

  console.log('Verified public catalog API: 11 categories, 109 grouped products, 167 active priced rows, explicit USD prices only.');
} finally {
  if (userId) {
    const response = await fetch(`${local.API_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { apikey: local.SERVICE_ROLE_KEY, Authorization: `Bearer ${local.SERVICE_ROLE_KEY}` },
    });
    if (!response.ok) console.warn('Temporary local verification user could not be removed.');
  }
}
