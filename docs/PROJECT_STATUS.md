# Project status

Last updated: 2026-10-26

## Current phase

Phases 0–12 and the locally verifiable parts of phases 14–15 are implemented. Phase 13 and live integration verification are blocked by external tooling/configuration.

The internal Operations expansion now has a working first implementation under `apps/operations`. Its launch authorization model is cumulative (Owner > Admin > Operations Manager) while capabilities remain individually represented for later separation.

## Completed and verified

- Pushed the complete flattened monorepo to `https://github.com/KinanKassab/Tawreed` on `main` and created the dedicated Vercel project `tawreed-doctor` without replacing the existing Astro-based `tawreed` production project.
- Deployed the Doctor Web export to `https://tawreed-doctor.vercel.app`; Vercel reports the production deployment ready and the public response is HTTP 200 with the expected Arabic RTL shell.
- Verified that the existing local Git repository is linked to `https://github.com/KinanKassab/Tawreed.git` as `origin` and tracks the pushed `main` branch.
- Audited every supplied HTML, CSS, JavaScript, SVG, and PNG reference file without modifying the source.
- Created the pnpm monorepo, Expo SDK 58 universal app, shared packages, strict TypeScript, ESLint, pinned lockfile, and equivalent Codex/Claude rules.
- Implemented Arabic RTL, user-approved Segoe UI typography with native system fallbacks, responsive Web/mobile navigation, shared states, and the supplied store visual language. Mobile uses matching vector icons, a right-aligned Tawreed logo, back navigation on internal pages, and a persistent four-item bottom bar across authenticated routes.
- Added twelve semantically matched dental category visuals on the Doctor home screen, with accessible labels and responsive 2/3/4-column layout; Vercel production serves the updated bundle from commit `8d8fff9`.
- Prepared a separate, unshipped rights-review package with 539 existing Internet product-photo candidates for all 196 products (two or three per SKU), including AI mapping and source-organization registers. None are approved for publication until rights clearance.
- Implemented email/password auth, recovery, guarded WhatsApp OTP, catalog, search, product details, cart, checkout, orders/tracking, account/default address, support, and notifications placeholder.
- Implemented TanStack Query read persistence, user-scoped order cache clearing, local persistent cart, network awareness, and explicit offline write blocking.
- Added migration-based Doctor commerce and future operations schema, development seed data, explicit grants/RLS, immutable order snapshots, and the transactional idempotent `create_doctor_order` RPC.
- Added unit/validation/configuration tests, shared-component tests, repository contract tests, pgTAP database security tests, responsive Playwright tests, and a Maestro Android core-flow definition.
- Local Supabase starts successfully; the initial migration and development seed reset successfully; real database types were generated from the migrated schema.
- Replaced the six generic seed products with the supplied dental Product Master: 12 bilingual categories and 196 products, including English names, specifications, and proposed units; search covers Arabic/English names and SKU. Internal sourcing suggestions and intake priorities are isolated in a protected table unavailable to Doctor clients.
- Added safe failed-login recovery in an accessible popup that offers account setup without disclosing whether an email is registered, revised visible system states into user-facing Arabic copy, and made successful password registration enter the app immediately when Supabase returns a session.
- Unverified catalog records intentionally have no price or inventory, are labeled as pending commercial verification, and cannot be ordered until Operations supplies verified commercial data.
- Passed: dependency peer check, strict typecheck, lint, 23 Vitest tests, 19 pgTAP database/RLS/catalog tests, authenticated catalog API verification, 8 configured Playwright tests, a disposable-account mobile navigation/registration verification, Expo Doctor 20/20, and production Web export.
- Added a separate Arabic RTL Operations Web app with secure staff-only entry, responsive dashboard, order confirmation and complete fulfillment controls, catalog search, selling-price/availability editing, one-warehouse inventory adjustments, and exchange-rate editing.
- Added server-controlled cumulative staff ranks, RLS policies, explicit grants, immutable staff-visible audit history, full-order reservations, release/dispatch inventory movements, and guarded financial/inventory/order RPCs. Reconfirming a previously reserved problem order resumes it without double reservation.
- Added a local-only staff provisioning helper that refuses hosted URLs and keeps privileged keys out of both clients.
- Expanded Operations catalog management into a responsive product table with editable Arabic name/description, selling price, protected purchase cost, exact stock, per-product low-stock threshold, automatic per-unit profit, availability, image crop/upload, and Doctor-style draft preview.
- Added standardized 1200×1200 WebP product images in the existing provider-neutral media model and a guarded atomic product-update RPC. Purchase cost remains unavailable to Doctor clients, while published names, descriptions, prices, availability, and primary media flow through the existing Doctor catalog repository.
- Created the local `owner@tawreed.app` staff identity after the final database reset; no privileged credential was written to repository files.
- Curated the owner-selected product photography from the read-only Design & Assets reference into 95 normalized 1200×1200 WebP files for 93 products, uploaded all files to the hosted public `product-media` bucket, and linked them through `media_assets`/`product_media`.
- Re-normalized all 95 published images by detected subject bounds so the product itself—not only the canvas—uses a consistent maximum 1000-pixel extent inside the 1200×1200 frame. The transformation preserves aspect ratio and safety padding; all replacement URLs and links passed hosted verification.
- Applied the image-folder instructions to the hosted catalog: verified 19 bilingual name corrections and reversibly deactivated 102 products instead of deleting records. Hosted verification passed for all 95 public image URLs and all 95 media links.

## Implemented but not executable in this machine

- Android launch, Maestro flow, and APK validation require Android SDK/ADB, Maestro, and an emulator/device or EAS credentials; those are unavailable.
- Live Supabase Auth, hosted RLS, Twilio WhatsApp delivery, and Vercel deployment require project configuration/credentials.

## Release blockers

- Redeploy the `tawreed-doctor` Vercel project after the hosted `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` values added by the owner. Expo public values are embedded at build time.
- The hosted Supabase database now contains 12 categories and 196 products named from the supplied pricing workbook, with 0 product prices by design. Missing prices must not prevent catalog display, only ordering.
- The hosted catalog currently exposes 94 active products; 102 owner-marked products are retained but inactive. Ninety-three active products have curated photography and one active product remains without a selected image.
- Resolve and verify safe email/phone identity linking before enabling independent WhatsApp signup. The current client deliberately uses `shouldCreateUser: false`.
- Provide approved authentication frames and Tawreed app-icon/splash artwork for final visual approval.
- Supply hosted Supabase/Twilio/EAS/Vercel projects and secrets, then run the unexecuted release checks.
- Implement the Admin staff-management UI and secure invitation/revocation flow; local staff bootstrap currently uses the local-only helper.
- Implement batch receiving and FEFO allocation before claiming expiry-aware fulfillment.
- Implement substitution proposals and recorded Doctor approval before enabling substitutions operationally.
- Provide approved Operations frames before claiming pixel-level visual approval; the current UI is a conservative extension of Tawreed's approved palette and typography.

## Last successful validation

On 2026-10-26, a hosted media/catalog verification confirmed 196 total products, 94 active products, 102 inactive products, 19 exact bilingual name edits, 95 media rows/links, 93 primary images, and 95/95 publicly retrievable WebP objects with zero errors. The previous full local suite remains the 2026-10-25 run: `pnpm typecheck`, `pnpm lint`, `pnpm test` (24/24), `pnpm test:db` (57/57), `pnpm test:catalog`, `pnpm test:web` (8/8), `pnpm test:operations-web` (12/12), Expo Doctor (20/20 for both apps), both Web builds, and Supabase advisors. Android E2E/APK and hosted Operations integration were not run.

## Completion claim

The implementation is a working local production foundation, not a released build. Do not mark the product complete until hosted auth/integration checks, Android E2E, APK startup, hosted deployment, verified commercial catalog data, and final visual QA are executed successfully.
