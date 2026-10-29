# Handoff

## Current state

The universal Doctor app, shared packages, hosted Supabase schema/RLS/RPC, Operations Web app, generated database types, and automated test harnesses are implemented. Code quality and both Web exports passed at the last recorded release check. Visitors can browse the active catalog and keep a cart without signing in; selecting Orders or Account shows a sign-in prompt and preserves that destination through login, while checkout and all user-scoped pages remain protected. Registration is a three-page flow for name, contact/follow-up preference, and delivery location. Account creation, sign-in, and recovery use email/password only; the phone number is contact/delivery data and no phone/WhatsApp authentication route remains. Registration can capture the current location, accept an in-app map point when the matching platform-restricted Google Maps key is configured, and snapshots coordinates/address for delivery. The UI uses Segoe UI with native system fallbacks; failed sign-in opens a safe account-setup popup; successful registration enters the app immediately when a session is available; and mobile pages share one persistent bottom bar plus internal-page back navigation. No privileged credential was committed, and the visual reference in `../Design & Assets` remains untouched.

Repeat Web launches now restore cached catalog reads before background revalidation, and an installed PWA opens `/account`. The app shell has a service worker/manifest, product images have loading/error states, and the catalog has compact category icons. Brand artwork is retained for favicon/native/PWA icons but removed from the in-app header/login content. Signup confirmation accepts a six-digit email OTP; hosted Auth was synchronized on 2026-10-29 from the stale eight-digit/default-template configuration to the Arabic Tawreed code template. `auth.tawreed.app` is verified in Resend and hosted Supabase custom SMTP is enabled with `Tawreed <no-reply@auth.tawreed.app>`. Support cases are saved under RLS and sent to `problem@tawreed.app` by the deployed, JWT-protected `send-support-email` Edge Function. All provider/function secrets are server-side; only a real-inbox resend and authenticated support-delivery verification remain pending as documented in `docs/EMAIL_SETUP.md`.

The existing `Code` folder is linked to `https://github.com/KinanKassab/Tawreed.git`; `main` is pushed and tracks `origin/main`. Nested Git metadata discovered during the initial push was preserved locally under the ignored `.git-nested-backups/` folder, and the full Doctor application is committed as ordinary monorepo source.

The Doctor Web app has a dedicated Vercel project, `tawreed-doctor`, with production URLs `https://tawreed.app` and `https://tawreed-doctor.vercel.app`. Its public hosted Supabase values and Web map key are configured. Live checks passed for the root shell, PWA assets, guest auth prompt, and map rendering. Google Cloud still rejects the JavaScript Geocoding Service until Geocoding API is enabled and added to the Web key restrictions, so automatic address text is pending that external setting. The older Astro-based Vercel project named `tawreed` was not replaced. Operations has a separate Git-linked Vercel project, `tawreed-operations`, rooted at `apps/operations` and configured with public Supabase client values only.

The first internal Operations Web implementation exists in `apps/operations`. Staff membership is server-controlled in `public.staff_accounts` with cumulative ranks (`operations_manager < admin < owner`); Doctor accounts receive no Operations context or internal rows. The UI covers dashboard metrics, orders, full product management, one-warehouse inventory adjustments, and exchange rates. Product management includes name/description, selling price, protected cost and automatic profit, exact stock, low-stock threshold, availability, standardized image crop/upload, and Doctor-style draft preview. Financial, inventory, product, media, staff, and order mutations append audit events. Confirming an order reserves its complete quantity; dispatch deducts it; cancellation releases it; and resolving a reserved problem does not reserve twice.

A confirmed hosted Owner account exists for `owner@tawreed.app`, has active `owner` staff membership, and passed a publishable-key sign-in/RLS smoke test. Its temporary credential was provided to the user and is not stored in the repository.

The hosted catalog now reflects the owner-curated `Design & Assets/images` instructions plus the later product additions. It retains 198 records, of which 96 are active and 102 are reversibly inactive. All active products now have primary media. Current product-media links total 98 because one product has three gallery images. The latest changes corrected `مسندة MOD`, added `مسندة MO`, replaced the Gutta-Percha image, and added the missing H-Files image using the owner's exact files.

The Doctor app now uses the exact owner-supplied `app logo.png` for the Web favicon, visible Web/mobile header mark, login branding, generic Expo icon, iOS icon, Android adaptive foreground, and splash image. The logo integration passes Expo Doctor 20/20, typecheck, lint, unit tests, and Web export; it is present in the working tree but has not been pushed from the current unrelated feature branch.

Five later Arabic-only label corrections are also live and persisted locally: TWD-DEN-0014 `مسند MOD`, TWD-DEN-0027 `أقماع ورقية`, TWD-DEN-0082 `ألجينات`, TWD-DEN-0114 `ميكروتور`, and TWD-DEN-0160 `فلورايد للأطفال`.

## Last verified commands

On 2026-10-25:

```text
pnpm peers check     passed
pnpm typecheck       passed
pnpm lint            passed
pnpm test            24 passed
pnpm test:db         57 passed
pnpm test:catalog    passed (12 bilingual categories / 196 products / Arabic-English-SKU search / protected sourcing metadata / 0 invented prices)
pnpm test:web        8 passed
pnpm expo:doctor     20/20 passed
pnpm build:web       passed
pnpm test:operations-web 12 passed (including image crop/upload and product persistence on desktop / Pixel 7 / 375×812 / 812×375 reduced motion)
pnpm build:operations passed
Operations Expo Doctor 20/20 passed
Supabase database advisors passed with no findings
```

On 2026-10-26, hosted catalog/media verification also passed after the latest changes: 198 total products, 96 active, 102 inactive, 98 media links, and successful public retrieval verification for all three newly supplied assets. This was a focused hosted-data verification, not a rerun of the full local application suite.

Later on 2026-10-26, `pnpm test` (24/24), strict typecheck, lint, and both Web exports passed. Hosted migrations, Owner membership, the one-warehouse bootstrap, protected product costs, and low-stock fields were verified. Docker was stopped, so the local reset/pgTAP rerun was unavailable; use the preceding 57/57 database run as the latest local pgTAP evidence.

For the visitor/onboarding update on 2026-10-26: workspace lint and strict typecheck passed; Vitest passed 24/24; Doctor Web export passed; Expo Doctor passed 20/20; Doctor Web E2E passed 10/10 on Pixel 7 and desktop profiles; all pgTAP suites passed 65/65 after a clean local reset; and the authenticated 197-product catalog check passed. The seed was corrected to reuse the single active bootstrapped warehouse. Android E2E/APK were not run because ADB, Maestro, and EAS are unavailable.

`supabase db lint --local` still reports the pre-existing `requested_items` temporary-table resolution false positive inside `create_doctor_order`; the checkout function is exercised by the passing pgTAP suite.

## Exact continuation point

0. Production Resend verification, Supabase SMTP, six-digit Arabic signup template, production site/redirect URLs, Edge Function secrets, and the active `send-support-email` deployment are complete. Exercise a fresh resend to a real signup inbox and authenticated support-report delivery to `problem@tawreed.app`.

0. Verify an authenticated Doctor sees the 96-product hosted assortment and its curated primary images in production. All active SKUs now have a selected primary image.
0. Verify an authenticated Doctor can complete registration and checkout with the newly deployed delivery coordinates. The hosted `20261026173000_public_catalog_and_delivery_location.sql` migration is applied, and anonymous REST verification returns the expected 96 active products.
1. Preserve `outputs/product-media-ready/manifest.json` as the exact mapping of approved files, 19 name corrections, and 102 inactive SKUs. The older Internet candidate package remains rights-review material only and must not be imported automatically.
2. Implement Admin-managed staff invitations, rank changes, revocation, final-Owner protection, and a staff audit view. The local bootstrap helper is not a hosted provisioning flow.
3. Implement goods receipt into inventory batches and FEFO allocation/dispatch, with expiry validation and tests.
4. Implement substitution proposals with product/quantity/price delta and recorded Doctor approval (WhatsApp initially), then recalculate authoritative totals server-side.
5. Add detailed order-item inspection and explicit Doctor-facing messages to the Operations order workflow.
6. Obtain approved Operations frames and complete visual QA; OQ-006 remains open.
7. Continue Doctor release work: approved auth frames, EAS APK, Android Maestro, and final deployed verification.

## Files to inspect first

`README.md`, `docs/PROJECT_STATUS.md`, `docs/OPEN_QUESTIONS.md`, `data/catalogs/tawreed_dental_catalog_syria.md`, `scripts/generate-catalog-seed.mjs`, `supabase/migrations/20261025090000_expand_dental_product_master.sql`, `supabase/tests/rls_and_checkout.sql`, and `packages/types/src/database.generated.ts`.

## Do not regress

- Keep all Supabase calls in `packages/data`; screens use repositories/hooks.
- Keep sourcing suggestions and intake priorities inaccessible to Doctor clients.
- Keep failed-login messaging generic so it does not reveal whether an account exists.
- Keep the protected-shell mobile bottom bar visible on every authenticated route and preserve internal-page back navigation.
- Never send authoritative price/totals from the client or grant Doctor roles access to operations tables.
- Keep staff membership server-controlled in `staff_accounts`; never move rank authorization into user-editable metadata.
- Keep order confirmation atomic and full-order only; do not queue Operations mutations offline.
- Keep `product_costs` staff-only; never add it to Doctor queries or grants. Keep product images normalized to 1200×1200 and publish them through `media_assets`/`product_media`, not direct image columns.
- Keep Doctor authentication email/password-only; never treat the contact phone as an account identifier.
- Do not queue offline writes or modify the supplied design source.
