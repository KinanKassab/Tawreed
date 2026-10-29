import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourcePath = resolve(root, 'data/catalogs/tawreed_priced_catalog_usd.json');
const outputPath = resolve(root, 'supabase/seed.sql');
const catalog = JSON.parse(await readFile(sourcePath, 'utf8'));

const sqlText = (value) => value === null ? 'null' : `'${String(value).replaceAll("'", "''")}'`;
const uuid = (prefix, number) => `${prefix}-0000-0000-0000-${String(number).padStart(12, '0')}`;
const amountMinor = (value) => Math.round(value * 100);

if (catalog.currency !== 'USD' || catalog.decimalPlaces !== 2) {
  throw new Error('Catalog must use USD with two decimal places.');
}

const products = [];
let sequence = 1;
for (const [categoryIndex, category] of catalog.categories.entries()) {
  for (const item of category.items) {
    const options = item.options ?? [{ label: null, price: item.price ?? null }];
    for (const option of options) {
      products.push({
        number: sequence++,
        categoryNumber: categoryIndex + 1,
        category,
        nameAr: item.name,
        optionLabelAr: option.label,
        groupKey: item.options ? `priced-${category.slug}-${createHash('sha1').update(item.name).digest('hex').slice(0, 12)}` : null,
        price: option.price,
      });
    }
  }
}

const categoryValues = catalog.categories.map((category, index) =>
  `  (${sqlText(uuid('11000000', index + 1))}, ${sqlText(category.slug)}, ${sqlText(category.name)}, null, ${index + 1}, true)`,
).join(',\n');

const productValues = products.map((product) =>
  `  (${sqlText(uuid('20000000', product.number))}, ${sqlText(`TWD-USD-${String(product.number).padStart(4, '0')}`)}, ${sqlText(product.nameAr)}, ${sqlText(uuid('11000000', product.categoryNumber))}, 'قطعة', ${sqlText(product.optionLabelAr)}, 'unavailable', ${typeof product.price === 'number'}, ${sqlText(product.groupKey)}, ${sqlText(product.optionLabelAr)})`,
).join(',\n');

const priceValues = products.filter((product) => typeof product.price === 'number').map((product) =>
  `  (${sqlText(uuid('20000000', product.number))}, 'USD', ${amountMinor(product.price)}, 2, true)`,
).join(',\n');

const sql = `-- Generated from data/catalogs/tawreed_priced_catalog_usd.json by scripts/generate-catalog-seed.mjs.
-- USD was explicitly confirmed by the product owner. Missing/on-request prices remain archived.

insert into public.currency_settings(code, display_label_ar, decimal_places, enabled, is_base, is_default_display) values
  ('USD', 'دولار أمريكي', 2, true, true, true),
  ('NEW_SYP', 'ليرة سورية جديدة', 2, false, false, false);

insert into public.financial_settings(id, delivery_fee_minor, delivery_fee_currency, tax_rate_bps)
values (true, 0, 'USD', 0);

insert into public.warehouses(code, name_ar)
select 'CENTRAL', 'المستودع المركزي لتوريد'
where not exists (select 1 from public.warehouses where active);

insert into public.categories(id, slug, name_ar, name_en, sort_order, active) values
${categoryValues};

insert into public.products(
  id, sku, name_ar, category_id, unit_label_ar, package_label_ar, availability, active, variant_group_key, variant_label_ar
) values
${productValues};

insert into public.product_prices(product_id, currency, amount_minor, decimal_places, active) values
${priceValues};

insert into public.inventory_balances(warehouse_id, product_id, on_hand, reserved)
select w.id, p.id, 0, 0
from public.warehouses w cross join public.products p
where w.id = (select id from public.warehouses where active order by created_at limit 1);
`;

await writeFile(outputPath, sql, 'utf8');
console.log(`Generated ${products.length} rows (${products.filter((product) => typeof product.price === 'number').length} active/priced) in ${catalog.categories.length} categories at ${outputPath}`);
