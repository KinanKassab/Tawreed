# Project status

Last updated: 2026-10-29

## Current phase

Phases 0–12 and the locally verifiable parts of phases 14–15 are implemented. Phase 13 and live integration verification are blocked by external tooling/configuration.

The internal Operations expansion now has a working first implementation under `apps/operations`. Its launch authorization model is cumulative (Owner > Admin > Operations Manager) while capabilities remain individually represented for later separation.

## Completed and verified

- Pushed the complete flattened monorepo to `https://github.com/KinanKassab/Tawreed` on `main` and created the dedicated Vercel project `tawreed-doctor` without replacing the existing Astro-based `tawreed` production project.
- Deployed Doctor commit `7ecaf77` to `https://tawreed.app` and `https://tawreed-doctor.vercel.app`; Vercel reports the production deployment ready. The public shell, manifest, service worker, 1254×1254 icon, favicon, and signed-out Orders/Account prompt were verified live on mobile and desktop.
- Verified that the existing local Git repository is linked to `https://github.com/KinanKassab/Tawreed.git` as `origin` and tracks the pushed `main` branch.
- Audited every supplied HTML, CSS, JavaScript, SVG, and PNG reference file without modifying the source.
- Created the pnpm monorepo, Expo SDK 58 universal app, shared packages, strict TypeScript, ESLint, pinned lockfile, and equivalent Codex/Claude rules.
- Implemented Arabic RTL, user-approved Segoe UI typography with native system fallbacks, responsive Web/mobile navigation, shared states, and the supplied store visual language. Mobile uses matching vector icons, a right-aligned Tawreed logo, back navigation on internal pages, and a persistent four-item bottom bar across authenticated routes.
- Added twelve semantically matched dental category visuals on the Doctor home screen, with accessible labels and responsive 2/3/4-column layout; Vercel production serves the updated bundle from commit `8d8fff9`.
- Prepared a separate, unshipped rights-review package with 539 existing Internet product-photo candidates for all 196 products (two or three per SKU), including AI mapping and source-organization registers. None are approved for publication until rights clearance.
- Implemented email/password-only auth and recovery, catalog, search, product details, cart, checkout, orders/tracking, account/default address, support, and notifications placeholder. Phone is contact/delivery data only.
- Added a signed-out Orders/Account navigation prompt that keeps visitors in context and carries the selected destination through login.
- Added a cache-first PWA shell with a large install icon, account-first installed launch, product-image loading/error states, and compact category icons.
- Split Google Maps configuration into independently restricted Web, Android, and iOS keys and fixed the iOS bundle identifier at `com.tawreed.doctor`.
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
- Applied the hosted product-management and Operations hardening migrations, provisioned the single active main warehouse, and created the confirmed hosted `owner@tawreed.app` identity with active `owner` staff membership.
- Created a separate Git-linked `tawreed-operations` Vercel project with public Supabase client configuration only; the latest consolidated Doctor release is commit `7ecaf77` on `main`.

## Implemented but not executable in this machine

- Android launch and Maestro verification require Android SDK/ADB, Maestro, and an emulator/device; those tools are not installed on this machine.
- The EAS account is authenticated, but `apps/doctor` is not linked to an EAS project, so an APK build cannot start until that external project is selected or created.

## Release blockers

- The hosted Supabase database now contains 12 categories and 196 products named from the supplied pricing workbook, with 0 product prices by design. Missing prices must not prevent catalog display, only ordering.
- The hosted catalog currently exposes 96 active products; 102 owner-marked products are retained but inactive. All 96 active products have primary photography.
- Provide approved authentication frames and Tawreed app-icon/splash artwork for final visual approval.
- Configure EAS, then run the remaining Android release checks.
- Implement the Admin staff-management UI and secure invitation/revocation flow; local staff bootstrap currently uses the local-only helper.
- Implement batch receiving and FEFO allocation before claiming expiry-aware fulfillment.
- Implement substitution proposals and recorded Doctor approval before enabling substitutions operationally.
- Provide approved Operations frames before claiming pixel-level visual approval; the current UI is a conservative extension of Tawreed's approved palette and typography.
- Enable Supabase leaked-password protection when the project plan supports it. Current production advisors also report informational missing-policy notices on deliberately inaccessible future procurement tables, the intentionally authenticated transactional `create_doctor_order` security-definer RPC, and unindexed foreign keys in mostly deferred/empty operational tables; review indexes before production volume grows.

## Last successful validation

On 2026-10-26, `pnpm test` (24/24), strict typecheck, lint, and both production Web exports passed. The hosted database accepted `product_management` and `operations_hardening_and_bootstrap`; verification confirmed one confirmed active Owner, one active warehouse, the low-stock column, and the protected cost table. A publishable-key password sign-in then read the Owner context and a product through the live RLS/API boundary. Docker was stopped, so the local reset/pgTAP rerun could not start; the prior complete local run remains 57/57 pgTAP, catalog verification, Doctor Web E2E 8/8, Operations Web E2E 12/12, and Expo Doctor 20/20 for both apps. Android E2E/APK remain unrun.

Later on 2026-10-26, the Doctor visitor/onboarding change passed workspace lint and strict typecheck, 24/24 Vitest tests, Doctor Web export, Expo Doctor 20/20, Doctor Web E2E 10/10, all 65/65 pgTAP database tests after a clean local reset, and the authenticated 197-product catalog verification. The seed now reuses the single active bootstrapped warehouse instead of creating a second local warehouse. Android E2E/APK remain unrun because ADB, Maestro, and EAS are unavailable. Interactive Google map selection additionally requires a restricted `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.

## Completion claim

The Doctor and Operations Web foundations are released against hosted Supabase, but the overall product is not complete. Do not claim final completion until commercial prices/inventory are verified, Android E2E/APK startup passes, staff administration and remaining fulfillment work are implemented, and final visual QA is approved.

## 2026-10-28 release validation

- Prepared the complete visitor catalog, staged registration/delivery-location flow, final 198-product catalog metadata, curated media mappings, exact owner-supplied branding, and responsive Operations updates for release.
- Updated Doctor and Operations to the Expo SDK 58 patch versions required by Expo Doctor; Expo Doctor passed 20/20 afterward.
- Passed workspace strict typecheck, lint, 23/23 Vitest tests, and both Doctor and Operations production Web exports after removing the obsolete phone/OTP flow.
- Passed a clean local migration reset, all 65/65 pgTAP tests, authenticated catalog verification for 198 products, and Doctor Web E2E 10/10. Operations Web E2E passed 11/12 in the parallel run; the single shared-product media race passed immediately when rerun alone.
- Applied `20261026173000_public_catalog_and_delivery_location.sql` to hosted Supabase through the transaction pooler on 2026-10-28. Direct anonymous REST verification succeeded and returned 96 active products, confirming the public catalog grants and policies are live.
- Removed phone/WhatsApp authentication from the Doctor client while retaining phone as contact/delivery data. Workspace strict typecheck, lint, 23/23 Vitest tests, Doctor Web export, and the four focused mobile/desktop login-and-registration Web tests passed. The complete Web suite was not green because tests requiring local Supabase encountered an unavailable local service; this auth change did not require a database migration.
- Added a cache-first installed-Web experience: persisted catalog content renders before background revalidation, the PWA app shell is cached, and the installed icon starts at the account route. Product images now show reserved loading feedback and an explicit fallback; compact icon categories were added to the product page; in-app logo artwork was removed while favicon/native/PWA branding remains.
- Added six-digit email signup verification, a localized confirmation template, and a server-side support-email function plus setup documentation. Resend SMTP, the verified sender domain, support recipient, and Edge Function secrets are configured and deployed.
- Verified this change with workspace strict typecheck, lint, 23/23 Vitest tests, Expo Doctor 20/20, and Doctor Web export. Android E2E/APK and live email delivery were not run.
- Verified `auth.tawreed.app` in Resend and created a production sending-only API key restricted to that domain. The secret was not written to the repository or exposed to either client.
- Enabled hosted Supabase custom SMTP with Resend (`smtp.resend.com:465`), sender `Tawreed <no-reply@auth.tawreed.app>`, and verified the saved values after a full dashboard reload. Configured `problem@tawreed.app` as the support recipient, stored all three Edge Function secrets server-side, and deployed `send-support-email` as an active JWT-protected function. Live authenticated signup/support delivery tests remain pending.
- On 2026-10-29, corrected the hosted Auth drift that still used an eight-digit OTP and the default English confirmation template. Hosted Supabase now uses a six-digit OTP, the Arabic Tawreed code template, `https://tawreed.app` as the site URL, and the Web/native redirect allow-list. A real-inbox resend check remains pending.
