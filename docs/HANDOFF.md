# Handoff

## Current state

The universal Doctor app, shared packages, Supabase schema/RLS/RPC/seed, generated database types, and automated test harnesses are implemented. Local database, code quality, and Web checks pass. The UI uses Segoe UI with native system fallbacks; failed sign-in opens a safe account-setup popup; successful local registration enters the app immediately; and authenticated mobile pages share one persistent bottom bar plus internal-page back navigation. No production credentials were added, and the visual reference in `../Design & Assets` remains untouched.

The existing `Code` folder is linked to `https://github.com/KinanKassab/Tawreed.git`; `main` is pushed and tracks `origin/main`. Nested Git metadata discovered during the initial push was preserved locally under the ignored `.git-nested-backups/` folder, and the full Doctor application is committed as ordinary monorepo source.

The Doctor Web app has a dedicated Vercel project, `tawreed-doctor`, with production URL `https://tawreed-doctor.vercel.app`. It builds successfully from GitHub and returns HTTP 200. The project has no hosted Supabase environment values yet, so browser verification reaches the intentional Arabic service-unavailable state. The older Astro-based Vercel project named `tawreed` and its production domains were not replaced.

## Last verified commands

On 2026-10-25:

```text
pnpm peers check     passed
pnpm typecheck       passed
pnpm lint            passed
pnpm test            23 passed
pnpm test:db         19 passed
pnpm test:catalog    passed (12 bilingual categories / 196 products / Arabic-English-SKU search / protected sourcing metadata / 0 invented prices)
pnpm test:web        8 passed
pnpm expo:doctor     20/20 passed
pnpm build:web       passed
```

## Exact continuation point

1. Configure hosted Supabase, add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the `tawreed-doctor` Vercel project for production/preview, redeploy, and repeat Playwright against the deployed URL.
2. Design the server-controlled cumulative Owner > Admin > Operations Manager capability matrix and immutable audit model; keep capabilities individually modeled for later separation. Operations may directly change selling prices and exchange rates.
3. Define the internal Web application boundary without weakening Doctor isolation; the approved MVP covers orders, catalog/pricing, and one-warehouse inventory only.
4. Create a local Doctor after the latest database reset and visually inspect the paginated 196-product dental catalog. Existing local accounts were removed by the reset.
5. Add verified prices, inventory/availability, and approved product media before enabling purchasing; current imported catalog records are intentionally browse-only.
6. Configure Twilio and validate auth redirects and WhatsApp delivery without enabling independent phone signup.
7. Supply approved app artwork/auth frames; run Web/Android screenshot comparison and record deviations in `docs/DESIGN_AUDIT.md`.
8. Link EAS, build the preview APK, install it, and run `.maestro/core-flow.yaml`.

## Files to inspect first

`README.md`, `docs/PROJECT_STATUS.md`, `docs/OPEN_QUESTIONS.md`, `data/catalogs/tawreed_dental_catalog_syria.md`, `scripts/generate-catalog-seed.mjs`, `supabase/migrations/20261025090000_expand_dental_product_master.sql`, `supabase/tests/rls_and_checkout.sql`, and `packages/types/src/database.generated.ts`.

## Do not regress

- Keep all Supabase calls in `packages/data`; screens use repositories/hooks.
- Keep sourcing suggestions and intake priorities inaccessible to Doctor clients.
- Keep failed-login messaging generic so it does not reveal whether an account exists.
- Keep the protected-shell mobile bottom bar visible on every authenticated route and preserve internal-page back navigation.
- Never send authoritative price/totals from the client or grant Doctor roles access to operations tables.
- Keep WhatsApp `shouldCreateUser: false` until a verified linking ceremony is approved.
- Do not queue offline writes or modify the supplied design source.
