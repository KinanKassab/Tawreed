# Handoff

## Current state

The universal Doctor app, shared packages, Supabase schema/RLS/RPC/seed, generated database types, and automated test harnesses are implemented. Local database, code quality, and Web checks pass. The UI uses Segoe UI with native system fallbacks; failed sign-in opens a safe account-setup popup; successful local registration enters the app immediately; and authenticated mobile pages share one persistent bottom bar plus internal-page back navigation. No production credentials were added, and the visual reference in `../Design & Assets` remains untouched.

The existing `Code` folder is a local Git repository whose `origin` fetch/push URL is `https://github.com/KinanKassab/Tawreed.git`. The GitHub repository is currently empty, the local branch has no commits yet, and all project files remain untracked pending an explicit initial commit and push.

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

1. Design the server-controlled cumulative Owner > Admin > Operations Manager capability matrix and immutable audit model; keep capabilities individually modeled for later separation. Operations may directly change selling prices and exchange rates.
2. Define the internal Web application boundary without weakening Doctor isolation; the approved MVP covers orders, catalog/pricing, and one-warehouse inventory only.
3. Create a local Doctor after the latest database reset and visually inspect the paginated 196-product dental catalog. Existing local accounts were removed by the reset.
4. Add verified prices, inventory/availability, and approved product media before enabling purchasing; current imported catalog records are intentionally browse-only.
5. Configure the hosted Supabase/Twilio project and validate auth redirects and WhatsApp delivery without enabling independent phone signup.
6. Supply approved app artwork/auth frames; run Web/Android screenshot comparison and record deviations in `docs/DESIGN_AUDIT.md`.
7. Link EAS, build the preview APK, install it, and run `.maestro/core-flow.yaml`.
8. Configure Vercel public environment values, deploy, and repeat Playwright against the deployed URL.

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
