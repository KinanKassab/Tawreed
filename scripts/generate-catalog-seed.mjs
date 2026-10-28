import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourcePath = resolve(root, 'data/catalogs/tawreed_dental_catalog_syria.md');
const outputPath = resolve(root, 'supabase/seed.sql');
const source = await readFile(sourcePath, 'utf8');

const sqlText = (value) => `'${value.replaceAll("'", "''")}'`;
const sqlArray = (values) => `array[${values.map(sqlText).join(', ')}]::text[]`;
const uuid = (prefix, number) => `${prefix}-0000-0000-0000-${String(number).padStart(12, '0')}`;

const categories = [...source.matchAll(/^## الفئة (\d+): (.+?) — (.+)$/gm)].map((match) => ({
  number: Number(match[1]),
  nameAr: match[2].trim(),
  nameEn: match[3].trim(),
}));

const productMatches = [...source.matchAll(/^### (\d{3})\. (.+?) — (.+)$/gm)];
const products = productMatches.map((match, index) => {
  const bodyStart = match.index + match[0].length;
  const bodyEnd = productMatches[index + 1]?.index ?? source.length;
  const body = source.slice(bodyStart, bodyEnd);
  const field = (label) => body.match(new RegExp(`^- \\*\\*${label}:\\*\\*\\s*(.+)$`, 'm'))?.[1]?.trim();
  const sku = field('رقم المنتج')?.replaceAll('`', '');
  const categoryLabel = field('الفئة');
  const description = field('الوصف والاستخدام');
  const specifications = field('المواصفات والخيارات');
  const unit = field('وحدة البيع المقترحة');
  const brands = field('ماركات مقترحة')?.split('،').map((brand) => brand.trim()).filter(Boolean) ?? [];
  const priority = field('أولوية الإدخال');
  const category = categories.find((candidate) => categoryLabel?.startsWith(candidate.nameAr));

  if (!sku || !category || !description || !specifications || !unit || !priority) {
    throw new Error(`Incomplete product ${match[1]} (${match[2]})`);
  }

  return {
    number: Number(match[1]), sku, categoryNumber: category.number,
    nameAr: match[2].trim(), nameEn: match[3].trim(), description,
    specifications, unit, brands, priority,
  };
});

if (categories.length !== 12 || products.length !== 198) {
  throw new Error(`Catalog integrity check failed: expected 12 categories/198 products, found ${categories.length}/${products.length}`);
}

const categoryValues = categories.map((category) =>
  `  (${sqlText(uuid('10000000', category.number))}, ${sqlText(`dental-${String(category.number).padStart(2, '0')}`)}, ${sqlText(category.nameAr)}, ${sqlText(category.nameEn)}, ${category.number})`,
).join(',\n');

const productValues = products.map((product) =>
  `  (${sqlText(uuid('20000000', product.number))}, ${sqlText(product.sku)}, ${sqlText(product.nameAr)}, ${sqlText(product.nameEn)}, ${sqlText(uuid('10000000', product.categoryNumber))}, null, ${sqlText(product.unit)}, null, ${sqlText(product.description)}, ${sqlText(product.specifications)}, 'unavailable', true)`,
).join(',\n');

const sourcingValues = products.map((product) =>
  `  (${sqlText(uuid('20000000', product.number))}, ${sqlArray(product.brands)}, ${sqlText(product.priority)}, 'مرجع كتالوج مقترح؛ يتطلب تحقق فريق العمليات')`,
).join(',\n');

const sql = `-- Generated from data/catalogs/tawreed_dental_catalog_syria.md by scripts/generate-catalog-seed.mjs.
-- Catalog entries are proposed Product Master data. Prices, brands, and availability are not verified offers.

insert into public.currency_settings(code, display_label_ar, decimal_places, enabled, is_base, is_default_display) values
  ('USD', 'دولار أمريكي', 2, true, true, true),
  ('NEW_SYP', 'ليرة سورية جديدة', 2, true, false, false);

insert into public.exchange_rates(base_currency, quote_currency, rate, active) values ('USD', 'NEW_SYP', 100.00000000, true);
insert into public.financial_settings(id, delivery_fee_minor, delivery_fee_currency, tax_rate_bps) values (true, 600, 'USD', 0);
insert into public.warehouses(code, name_ar)
select 'CENTRAL', 'المستودع المركزي لتوريد'
where not exists (select 1 from public.warehouses where active);

insert into public.categories(id, slug, name_ar, name_en, sort_order) values
${categoryValues};

insert into public.products(
  id, sku, name_ar, name_en, category_id, manufacturer, unit_label_ar, package_label_ar,
  description_ar, specifications_ar, availability, active
) values
${productValues};

insert into public.product_sourcing_suggestions(product_id, suggested_brands, catalog_priority, source_note) values
${sourcingValues};

insert into public.inventory_balances(warehouse_id, product_id, on_hand, reserved)
select w.id, p.id, 0, 0
from public.warehouses w cross join public.products p
where w.id = (select id from public.warehouses where active order by created_at limit 1);
`;

await writeFile(outputPath, sql, 'utf8');
console.log(`Generated ${products.length} products in ${categories.length} categories at ${outputPath}`);
