# Database

The initial migration is `supabase/migrations/20261024190644_initial_tawreed_schema.sql`; development data is in `supabase/seed.sql`. Supabase is configured to avoid automatic table exposure, so API reachability requires both explicit grants and an allowing RLS policy.

## Doctor-facing model

- Identity/profile: `profiles`, `addresses`.
- Catalog/media: `categories`, `products`, `media_assets`, `product_media`, `product_prices`.
- Currency/financial controls: `currency_settings`, `exchange_rates`, `financial_settings`.
- Orders: `orders`, `order_items`, `order_status_history`.
- Support: `support_cases`.

Authenticated Doctors can read active catalog/configuration rows and only their own profile, addresses, orders, history, and support cases. Doctors cannot insert/update catalog or orders directly. Profile/address/support writes remain ownership constrained.

## Operations-ready model

`warehouses`, `inventory_balances`, `inventory_batches`, `inventory_movements`, `vendors`, `purchase_orders`, `purchase_order_items`, and `goods_receipts` establish the future central-warehouse/procurement boundary. Doctor roles receive no table grants for this data.

The first internal implementation adds `staff_accounts`, `audit_events`, and `order_inventory_reservations`. Staff ranks are cumulative (`operations_manager < admin < owner`) but authorization is evaluated against server-controlled membership rows rather than user-editable metadata. Operations reads are protected by RLS; Doctor sessions receive zero internal rows even where an authenticated Data API grant is necessary for the shared browser role.

Operations mutations use narrowly granted functions for selling prices, exchange rates, inventory adjustments, complete-order confirmation/reservation, and order progression. Audit triggers capture actor, time, target, and old/new row data. Confirmation reserves all requested quantities atomically from the single active warehouse or marks the order as a problem; cancellation releases active reservations and dispatch deducts the complete reserved quantity. Batch receiving and FEFO allocation are not implemented yet.

## Transactional checkout

`public.create_doctor_order` is the only Doctor order-creation path. It is a tightly granted `security definer` function with an empty pinned search path. It:

1. Requires `auth.uid()` and rejects empty/invalid input.
2. Returns an existing owned order for a repeated idempotency key.
3. Re-reads active products/prices, configured currency precision/rate, and financial settings.
4. Rejects unavailable or missing products and invalid quantities.
5. Calculates base/display minor-unit amounts, fees, tax, and total on the server.
6. Persists address/recipient, SKU/name/unit/package, item price, currency precision, rate, and financial snapshots.
7. Inserts the order, items, and initial status history atomically.

Historical rows remain interpretable if catalog prices, exchange rates, names, or configuration later change.

## Tests and generated types

`supabase/tests/rls_and_checkout.sql` contains pgTAP security and catalog-integrity checks, including denial of Doctor access to internal sourcing metadata. Run `pnpm supabase:reset`, `pnpm supabase:types`, `pnpm test:db`, and `pnpm test:catalog` whenever migrations or catalog data change.

## Catalog source and import path

The supplied Product Master is versioned at `data/catalogs/tawreed_dental_catalog_syria.md`. `scripts/generate-catalog-seed.mjs` validates the expected 12 categories/196 products and deterministically generates `supabase/seed.sql`. The Doctor-facing product schema preserves English name, Arabic description/specifications, and proposed selling unit. Suggested sourcing brands and intake priority are stored separately in `product_sourcing_suggestions`, which has RLS enabled and no `anon` or `authenticated` grants.

The source states that brands, availability, inventory, and prices are unverified. Consequently the seed creates no `product_prices`, assigns zero inventory, and keeps each record non-orderable. Suggested brands are informational sourcing candidates, not a manufacturer claim or Doctor-visible offer. A future Operations flow must verify and populate price/availability/inventory before ordering is enabled.

Future catalog CSV columns remain: `sku`, `name_ar`, `name_en`, `category_slug`, `manufacturer`, `unit_label_ar`, `package_label_ar`, `description_ar`, `specifications_ar`, `availability`, `base_price_minor`, `base_currency`, `media_provider`, `media_object_key`, `media_external_url`, `media_alt_ar`, and `active`. Validate every row, resolve categories/media first, then upsert Product Master by SKU and price records by product/currency. Never import vendor purchase cost into a Doctor-readable table.

## Operations product management

`products.low_stock_threshold` stores the alert boundary independently for each product. Current and historical purchase costs live in `product_costs`, which has explicit authenticated grants plus staff-only RLS; Doctor policies return no cost rows. Selling prices continue to use `product_prices` so Doctor reads and checkout use the same authoritative active price.

`operations_update_product` validates staff rank and all numeric/text bounds, locks the product and single warehouse balance, refuses stock below reserved quantity, updates Doctor-visible product fields, versions selling price and purchase cost, records exact-stock movements, and binds an optional normalized primary image in one database transaction. The browser uploads a unique Storage object first and deletes it if the database call fails. The public `product-media` bucket permits public delivery but restricts insert/delete operations to authenticated Operations staff under RLS. Product image records remain provider-neutral in `media_assets` and `product_media`; the normalized size is 1200×1200 pixels.
