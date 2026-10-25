# Project status

Last updated: 2026-10-25

## Current phase

Phases 0–12 and the locally verifiable parts of phases 14–15 are implemented. Phase 13 and live integration verification are blocked by external tooling/configuration.

An internal Operations expansion is now in product definition. Its approved first scope is orders, catalog/pricing, and inventory for one warehouse. The approved launch authorization model is cumulative (Owner > Admin > Operations Manager) while retaining individually modeled capabilities for later separation; no internal application or staff authorization has been implemented yet.

## Completed and verified

- Pushed the complete flattened monorepo to `https://github.com/KinanKassab/Tawreed` on `main` and created the dedicated Vercel project `tawreed-doctor` without replacing the existing Astro-based `tawreed` production project.
- Deployed the Doctor Web export to `https://tawreed-doctor.vercel.app`; Vercel reports the production deployment ready and the public response is HTTP 200 with the expected Arabic RTL shell.
- Verified that the existing local Git repository is linked to `https://github.com/KinanKassab/Tawreed.git` as `origin` and tracks the pushed `main` branch.
- Audited every supplied HTML, CSS, JavaScript, SVG, and PNG reference file without modifying the source.
- Created the pnpm monorepo, Expo SDK 58 universal app, shared packages, strict TypeScript, ESLint, pinned lockfile, and equivalent Codex/Claude rules.
- Implemented Arabic RTL, user-approved Segoe UI typography with native system fallbacks, responsive Web/mobile navigation, shared states, and the supplied store visual language. Mobile uses matching vector icons, a right-aligned Tawreed logo, back navigation on internal pages, and a persistent four-item bottom bar across authenticated routes.
- Implemented email/password auth, recovery, guarded WhatsApp OTP, catalog, search, product details, cart, checkout, orders/tracking, account/default address, support, and notifications placeholder.
- Implemented TanStack Query read persistence, user-scoped order cache clearing, local persistent cart, network awareness, and explicit offline write blocking.
- Added migration-based Doctor commerce and future operations schema, development seed data, explicit grants/RLS, immutable order snapshots, and the transactional idempotent `create_doctor_order` RPC.
- Added unit/validation/configuration tests, shared-component tests, repository contract tests, pgTAP database security tests, responsive Playwright tests, and a Maestro Android core-flow definition.
- Local Supabase starts successfully; the initial migration and development seed reset successfully; real database types were generated from the migrated schema.
- Replaced the six generic seed products with the supplied dental Product Master: 12 bilingual categories and 196 products, including English names, specifications, and proposed units; search covers Arabic/English names and SKU. Internal sourcing suggestions and intake priorities are isolated in a protected table unavailable to Doctor clients.
- Added safe failed-login recovery in an accessible popup that offers account setup without disclosing whether an email is registered, revised visible system states into user-facing Arabic copy, and made successful password registration enter the app immediately when Supabase returns a session.
- Unverified catalog records intentionally have no price or inventory, are labeled as pending commercial verification, and cannot be ordered until Operations supplies verified commercial data.
- Passed: dependency peer check, strict typecheck, lint, 23 Vitest tests, 19 pgTAP database/RLS/catalog tests, authenticated catalog API verification, 8 configured Playwright tests, a disposable-account mobile navigation/registration verification, Expo Doctor 20/20, and production Web export.

## Implemented but not executable in this machine

- Android launch, Maestro flow, and APK validation require Android SDK/ADB, Maestro, and an emulator/device or EAS credentials; those are unavailable.
- Live Supabase Auth, hosted RLS, Twilio WhatsApp delivery, and Vercel deployment require project configuration/credentials.

## Release blockers

- Add hosted `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` values to the `tawreed-doctor` Vercel project and redeploy. Until then, the deployed client correctly shows its Arabic service-unavailable state instead of attempting to use local Supabase values.
- Resolve and verify safe email/phone identity linking before enabling independent WhatsApp signup. The current client deliberately uses `shouldCreateUser: false`.
- Provide approved authentication frames and Tawreed app-icon/splash artwork for final visual approval.
- Supply hosted Supabase/Twilio/EAS/Vercel projects and secrets, then run the unexecuted release checks.
- Implement server-authorized, fully audited selling-price and exchange-rate mutations for the approved cumulative Owner/Admin/Operations hierarchy.

## Last successful validation

On 2026-10-25: `pnpm typecheck`, `pnpm lint`, `pnpm test` (23/23), `pnpm expo:doctor` (20/20), and `pnpm build:web` passed immediately before the GitHub/Vercel release. The production Vercel response returned HTTP 200 with Arabic RTL metadata and no runtime error logs. Docker was stopped during this release session, so `pnpm test:db` and `pnpm test:catalog` could not connect; `pnpm test:web` passed its four routing/layout cases and its four Supabase-dependent login-popup cases failed with the expected network-unavailable state. The preceding successful local-Supabase run remains 19/19 pgTAP checks, complete authenticated catalog verification, and 8/8 Web tests.

## Completion claim

The implementation is a working local production foundation, not a released build. Do not mark the product complete until hosted auth/integration checks, Android E2E, APK startup, hosted deployment, verified commercial catalog data, and final visual QA are executed successfully.
