# Tawreed Doctor | توريد — تطبيق الطبيب

Production-oriented Expo application for Doctor purchasing across Android and Web. The app is Arabic-first and RTL, uses Supabase for authentication and commerce data, and keeps checkout pricing authoritative in Postgres.

## What is included

- Public catalog browsing with checkout-gated authentication, staged email/password registration, delivery-location capture, and password recovery. Phone numbers are retained only for contact and delivery.
- Responsive home, catalog, product, cart, checkout, orders, tracking, account, support, and notification routes.
- Persistent read-only offline cache for catalog, products, and the active Doctor's orders; writes are never queued.
- Supabase schema, seed data, explicit grants, RLS policies, and an idempotent transactional checkout function.
- Strict TypeScript workspace packages for configuration, domain models, validation, data access, design tokens, and UI.
- Unit, database security, responsive browser smoke, and Android journey test harnesses.

The supplied visual source remains untouched in `../Design & Assets`. See `docs/DESIGN_AUDIT.md` for the mapping and known source gaps.

## Prerequisites

- Node.js 22 LTS (Node 24 is also accepted by this workspace).
- pnpm 11.25.0 through Corepack.
- Docker Desktop or another Docker-compatible runtime for local Supabase.
- Android Studio/emulator for local Android testing, or an EAS account for cloud builds.
- Maestro for the Android end-to-end flow.

## First run

```powershell
# User-scoped install; does not require an Administrator terminal on Windows.
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
Copy-Item apps/doctor/.env.example apps/doctor/.env
pnpm supabase:start
pnpm supabase:reset
pnpm supabase:types
```

`corepack enable` may fail with `EPERM` when Node is installed under `C:\Program Files`. The user-scoped npm command above is the supported fallback for this workspace. If this terminal was open before pnpm was installed and still cannot find it, close and reopen PowerShell once.

After `pnpm supabase:start`, copy the local API URL and publishable key reported by the CLI into `apps/doctor/.env`:

```text
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local public key>
# Optional until a restricted browser/Android/iOS Google Maps key is provisioned:
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=<restricted public maps key>
```

Without the Google Maps key, onboarding still supports current-location capture, manual address entry, and a Google Maps preview link. In-app map-point selection is enabled when the restricted key is present. Restrict the key to Tawreed's Web origins and native application identifiers; never use a server secret in Expo.

Then start a target:

```powershell
pnpm dev:web
pnpm dev:android
pnpm dev:operations
```

The local database seeds the supplied 12-category, 198-product dental catalog. Create a Doctor through the registration screen before exercising authenticated routes. Local confirmation emails are available in the Supabase mail viewer at `http://127.0.0.1:54324`.

The Arabic RTL Operations console lives in `apps/operations`. Copy the same public Supabase URL/key into `apps/operations/.env` from its `.env.example`; never place a secret or service-role key in either app. Its product table manages Doctor-visible names/descriptions/prices/media plus staff-only costs, profit, stock, and low-stock thresholds. New product images are interactively cropped and normalized to 1200×1200 WebP before upload. To provision a local staff account, set `TAWREED_STAFF_EMAIL`, `TAWREED_STAFF_PASSWORD`, and optionally `TAWREED_STAFF_RANK` (`owner`, `admin`, or `operations_manager`), then run `pnpm staff:create:local`. This helper refuses hosted URLs. Launch permissions are cumulative: Owner includes Admin and Operations Manager; Admin includes Operations Manager.

## Validation

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm expo:doctor
pnpm build:web
pnpm build:operations
pnpm test:web
pnpm test:operations-web
pnpm test:db
pnpm test:catalog
```

`pnpm test:web` covers configured signed-out routing and the Arabic RTL Doctor login layout. `pnpm test:operations-web` creates disposable local Owner/Doctor accounts and verifies responsive staff entry, product editing, unsaved preview, real image selection/crop/upload, persisted Storage output, internal navigation, exchange-rate controls, and denial of non-staff accounts. `pnpm test:db` runs against the migrated local database and verifies grants, RLS, Doctor cost isolation, product/media updates, audited financial changes, confirm-then-reserve, complete dispatch, and unauthenticated checkout rejection.

`pnpm test:catalog` creates a temporary confirmed local Doctor, reads the catalog through the authenticated REST/RLS boundary, verifies 12 categories and 198 complete dental products, confirms that no price or stock was invented, and removes the temporary user.

## Dental catalog source

The Product Master source is `data/catalogs/tawreed_dental_catalog_syria.md`. Regenerate `supabase/seed.sql` after an approved source edit with:

```powershell
node scripts/generate-catalog-seed.mjs
pnpm supabase:reset
pnpm supabase:types
pnpm test:db
pnpm test:catalog
```

The source explicitly identifies brands as internal sourcing suggestions and contains no verified prices or inventory. Accordingly, imported records appear for browsing but remain non-orderable and display “السعر والتوفر قيد التأكيد” until verified price and availability data are added. Internal sourcing suggestions are not exposed to Doctor clients.

For the Android core journey, provide a confirmed test Doctor and run:

```powershell
$env:TEST_EMAIL='doctor@example.test'
$env:TEST_PASSWORD='replace-with-test-password'
$env:TEST_DELIVERY_ADDRESS='دمشق، شارع الاختبار، بناء ١٠'
$env:TEST_RECIPIENT_NAME='طبيب الاختبار'
$env:TEST_RECIPIENT_PHONE='+963900000000'
pnpm e2e:android
```

## Database and security

The initial migration is `supabase/migrations/20261024190644_initial_tawreed_schema.sql`. Apply hosted changes through reviewed migrations, then regenerate `packages/types/src/database.generated.ts` against the target schema. Do not expose the Supabase secret/service-role key to Expo or Web.

Checkout calls `public.create_doctor_order`. The function authenticates the caller, re-reads active products and current pricing/configuration, computes currency snapshots and totals, and commits the order, items, and first status record atomically. A client UUID is the idempotency key.

Authentication uses email and password only. Phone numbers collected during registration and checkout are contact and delivery details, never sign-in identifiers.

## Builds and deployment

Web export:

```powershell
pnpm build:web
```

The deployable output is `apps/doctor/dist`; root `vercel.json` supplies the SPA rewrite. Add the two `EXPO_PUBLIC_SUPABASE_*` values to the Vercel project before building.

Android preview APK and production AAB:

```powershell
cd apps/doctor
npx eas-cli@25.3.0 login
npx eas-cli@25.3.0 init
npx eas-cli@25.3.0 build --platform android --profile preview
npx eas-cli@25.3.0 build --platform android --profile production
```

Set the resulting EAS project ID and replace the starter Expo app-icon assets only after approved Tawreed brand artwork is supplied.

## Documentation map

- `docs/PROJECT_STATUS.md` — verified implementation state and blockers.
- `docs/ARCHITECTURE.md` — boundaries and runtime structure.
- `docs/DATABASE.md` — schema, grants, RLS, checkout, and import path.
- `docs/AUTH.md` and `docs/OFFLINE.md` — security and cache behavior.
- `docs/TESTING.md` — test layers and current execution status.
- `docs/OPEN_QUESTIONS.md` — product decisions still required.
- `docs/HANDOFF.md` — exact continuation checklist.
