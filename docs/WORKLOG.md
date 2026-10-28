# Worklog

## 2026-10-24 — Initial audit

- Inspected the empty production `Code` folder and all supplied files under `Design & Assets`.
- Identified Doctor screens, reusable patterns, responsive rules, tokens, assets, missing states, and contradictions.
- Reviewed current Expo Router/web export guidance and current Supabase auth/RLS/Data API guidance and changelog items.
- Created project instructions and persistent documentation foundation.
- No build or tests run yet; production code did not exist at session start.

## 2026-10-24 — Production foundation implementation

- Created the pinned pnpm/Expo workspace and shared configuration, domain, validation, data, UI, type, and token packages.
- Implemented the Arabic RTL Doctor application from auth through catalog, cart, checkout, orders, account, and support.
- Added persistent read-only offline queries, local cart persistence, connectivity guards, session lifecycle, and media resolution.
- Added the Supabase schema, explicit grants/RLS, seed data, future operations entities, and authoritative idempotent order function.
- Added 21 unit/component/repository tests, 4 responsive Playwright checks, pgTAP security tests, and the Maestro core journey.
- Fixed a browser-discovered issue where Expo development HTML reported `lang=en`; the runtime now enforces `lang=ar` and `dir=rtl`.
- Added a build-time HTML metadata guard and safe-area shell after the final accessibility/mobile UI checklist.
- Passed peer validation, strict typecheck, lint, Vitest, Playwright, Expo Doctor 20/20, and production Web export.
- Attempted local Supabase validation; blocked because Docker/Podman is not installed. Android/EAS validation is also blocked by missing ADB/emulator/Maestro/project credentials.

## 2026-10-25 — Local Supabase verification

- Confirmed the local Supabase stack starts and the initial migration plus development seed reset successfully.
- Placed only the local publishable key in the ignored Expo environment file; no secret/service-role value was added to client configuration.
- Corrected environment discovery by moving the Expo template/configuration to `apps/doctor/.env.example` and `apps/doctor/.env`.
- Generated the real `Database` TypeScript contract from the migrated local schema.
- Ran the pgTAP suite successfully: 12/12 security/database checks passed.
- Re-ran strict typecheck, lint, 21 Vitest tests, Expo Doctor 20/20, configured responsive Playwright tests 4/4, and the production Web export successfully.

## 2026-10-25 — Dental catalog import

- Versioned the supplied `tawreed_dental_catalog_syria.md` as the development Product Master source.
- Added a deterministic parser/seed generator with integrity checks for exactly 12 categories and 196 products.
- Expanded Product Master with English name, specifications, suggested sourcing brands, and catalog priority; regenerated database types.
- Replaced the generic six-product mock seed and reset the local database successfully.
- Preserved source truth: created no fabricated price or stock, exposed a pending-commercial-verification state, and disabled cart/checkout for unverified products.
- Added incremental 30-product catalog pagination so all 196 entries are browseable without rendering the entire catalog at once.
- Added authenticated REST/RLS catalog verification with automatic temporary-user cleanup.
- Preserved bilingual category data and added an indexed generated search field covering Arabic/English product names, SKU, and manufacturer without raw user-built filter syntax.
- Passed strict typecheck, lint, 22 Vitest tests, 16 pgTAP tests, authenticated catalog API verification, 4 Playwright tests, and production Web export.
- Diagnosed post-reset Auth 400 responses: the local database contained no users, the browser held a deleted user's refresh token, and password attempts used deleted credentials. Added specific Arabic mappings for invalid credentials, stale refresh tokens, unconfirmed email, and duplicate registration.

## 2026-10-25 — Sign-in recovery and typography

- Added a failed-login prompt that asks whether the user wants to prepare a new account and routes directly to registration.
- Kept the authentication response generic for unknown accounts and wrong passwords to prevent account enumeration.
- Replaced development-oriented visible wording across authentication, configuration, notifications, products, cart, and checkout with user-facing Arabic copy.
- Changed the application typeface to Segoe UI, removed the bundled IBM Plex Google-font dependency and startup gate, and retained system sans-serif fallbacks for native devices without Segoe UI.
- Moved unverified sourcing brands and intake priority out of the Doctor-readable `products` table into the RLS-enabled `product_sourcing_suggestions` table, revoked Doctor/anonymous access, and granted read-only access to `service_role` for internal verification.
- Reset the local database and regenerated database types.
- Passed peer validation, strict typecheck, lint, 22 Vitest tests, 19 pgTAP tests, authenticated catalog verification, 6 Playwright tests across mobile/desktop, Expo Doctor 20/20, and production Web export.

## 2026-10-25 — Popup, immediate registration, and mobile navigation

- Replaced the inline failed-login account suggestion with an accessible modal popup, including explicit “تجهيز حساب جديد” and “ليس الآن” actions and Android back dismissal.
- Changed password registration to enter the application immediately when Supabase returns a session; confirmation-required projects now keep the user on the same screen with a clear automatic-entry instruction.
- Replaced mobile header text actions with Material Community cart and notification icons, added a cart-count badge, placed actions on the physical left and the Tawreed logo on the physical right, and retained accessible labels and 48px targets.
- Added a back icon to every authenticated internal page with a safe home fallback when no history exists.
- Lifted the mobile bottom bar into the protected application shell so it remains visible on product, cart, checkout, notifications, order details/success, support, and the four root destinations.
- Added configurable Playwright test ports so verification does not interfere with the user's development server.
- Passed strict typecheck, lint, 23 Vitest tests, 8 Playwright tests across mobile/desktop, Expo Doctor 20/20, peer validation, and production Web export.
- Used disposable local accounts to verify immediate registration and the mobile navigation shell at 390×844, 375×812, and 812×375 with reduced motion; fixed landscape mobile detection, confirmed no horizontal overflow, and removed the accounts after verification.

## 2026-10-25 — Operations MVP product definition

- Confirmed one shared internal Web application with Owner, Admin, and Operations Manager capabilities; the owners will operate it directly before staff are hired.
- Limited the initial internal scope to Doctor orders, catalog/pricing, and inventory for one warehouse.
- Confirmed confirm-then-reserve order handling, complete-order fulfillment, Doctor-approved substitutions, FEFO stock usage, and Operations-owned WhatsApp support.
- Deferred procurement/vendor workflows, internal delivery management, and dedicated support roles.
- Recorded open decisions for financial approval boundaries and Owner/Admin account authority; no internal application or privileged mutation was implemented in this step.
- Confirmed cumulative launch permissions: Owner inherits Admin and Operations Manager, while Admin inherits Operations Manager; individual capabilities will remain separable for the later staffing phase.
- Confirmed that Operations Manager can directly change selling prices and exchange rates without an approval step; required immutable audit history for each old/new financial value change.

## 2026-10-25 — Operations foundation and first Web console

- Added `apps/operations` as a separate Arabic RTL Expo Web application sharing Tawreed repositories, domain models, design tokens, Segoe UI, and publishable Supabase configuration without sharing a client session with the Doctor app.
- Implemented staff-only login and a cumulative server-side rank model: Owner inherits Admin and Operations Manager; Admin inherits Operations Manager. Doctor accounts are rejected from the internal console.
- Added dashboard metrics and responsive sections for orders, catalog prices/availability, one-warehouse inventory, and USD/NEW_SYP exchange-rate control.
- Added audited server-authorized mutations for selling prices, exchange rates, catalog availability, inventory adjustments, and order status changes.
- Implemented confirm-then-reserve for complete orders, reservation release on cancellation, full stock deduction on dispatch, delivery progression, and safe resume from a reserved problem without double reservation.
- Added a local-only staff provisioning helper that rejects hosted URLs and never embeds a service-role key in either client.
- Expanded database/RLS tests to 46 passing checks and added 8 passing Operations Web tests across desktop, Pixel 7, 375×812, and 812×375 reduced-motion viewports.
- Merged overlapping read policies and verified the local Supabase database advisor reports no security or performance findings. The schema linter still reports the pre-existing false positive for the temporary `requested_items` table inside `create_doctor_order`; the function remains covered by passing database tests.
- Passed strict typecheck, lint, 23 Vitest tests, authenticated catalog verification, Doctor Web E2E 8/8, Expo Doctor 20/20 for both apps, and production Web exports for Doctor and Operations.
- Left staff-management UI, batch receiving/FEFO, substitutions with recorded Doctor approval, hosted Operations deployment, and approved Operations visual frames for subsequent work.

## 2026-10-25 — Integrated product management

- Replaced the limited catalog price editor with a responsive Arabic RTL management table showing product image, name, selling price, protected purchase cost, automatic per-unit profit, stock state, low-stock threshold, description, and actions.
- Added validated edit, cancel, save, and Doctor-style preview flows; draft previews reflect unsaved name, price, description, availability, and cropped image changes.
- Added device image selection plus interactive square crop, pan, zoom, and high-quality 1200×1200 WebP output. Uploads use unique immutable Storage paths and the existing provider-neutral media records.
- Added `product_costs` history with staff-only RLS, per-product `low_stock_threshold`, a guarded atomic product-update RPC, exact-stock safety against reservations, movement/audit records, and public product-media Storage policies restricted to staff writes.
- Verified that Doctor users can read the new published product media and Doctor-visible product fields but cannot read purchase costs.
- Created the local `owner@tawreed.app` account after the final reset without storing its credential in project files.
- Passed strict typecheck, lint, 24 unit/contract tests, 57 pgTAP checks, catalog verification, Doctor Web E2E 8/8, Operations Web E2E 12/12 across four viewport profiles, Expo Doctor 20/20 for both apps, both Web exports, and Supabase advisors with no findings.

## 2026-10-25 — GitHub repository linkage verification

- Verified that the existing local repository uses `https://github.com/KinanKassab/Tawreed.git` as the `origin` fetch and push URL.
- Confirmed that the GitHub repository is reachable and currently has no branches or commits.
- Preserved all local files as untracked work; no commit or push was performed.

## 2026-10-25 — GitHub push and Vercel production deployment

- Flattened the accidental nested Git repositories so the main repository contains the complete Doctor application rather than Git links; preserved the Doctor template history under the ignored `.git-nested-backups/` directory.
- Verified that real `.env` files, Vercel local metadata, and credential patterns were excluded from the upload.
- Created and pushed the initial `main` commit to `https://github.com/KinanKassab/Tawreed`.
- Preserved the existing Astro-based Vercel `tawreed` production site and created a separate `tawreed-doctor` project for the Expo application.
- Deployed the pushed commit to `https://tawreed-doctor.vercel.app`; Vercel reported `READY`, the response returned HTTP 200 with Arabic RTL metadata, and the runtime error scan was clean.
- Confirmed in a browser that the deployed app currently reaches its intentional Arabic service-unavailable state because hosted Supabase public environment values are not configured.
- Passed strict typecheck, lint, 23/23 Vitest tests, Expo Doctor 20/20, and the production Web export. Database/catalog tests were blocked because Docker was stopped; Web E2E passed 4/8, with the four Supabase-dependent cases receiving the expected network-unavailable state.

## 2026-10-25 — Published catalog diagnostic

- Inspected `tawreed_dental_pricing_4_columns.xlsx` read-only: it contains 196 unique product references, categories, and Arabic/English display names; all four pricing columns are empty.
- Confirmed that names, references, and categories are sufficient to display a pending/unpriced catalog; prices and inventory are only required before ordering.
- Confirmed the hosted Tawreed Supabase project is linked and its catalog tables exist, while anonymous access is correctly denied. Hosted row counts could not be verified without an authenticated Doctor session or a hosted privileged key/database credential.
- No application, workbook, database, or deployment data was changed during this diagnostic.

## 2026-10-25 — Hosted catalog import

- Used a locally stored Supabase secret key without exposing or committing it.
- Imported 12 active categories and 196 active products into the linked hosted Tawreed Supabase project.
- Took every Arabic/English product display name from `tawreed_dental_pricing_4_columns.xlsx`; retained the reviewed non-commercial description, specification, and unit metadata required by the catalog schema.
- Verified hosted counts through the protected server API: 12 categories, 196 products, and 0 product prices. No inventory, price, or availability claim was invented.
- The Vercel production project still requires a redeployment after its public Supabase environment values were added so Expo can include them in the Web build.

## 2026-10-25 — Dental category visuals

- Replaced the generic category dots on the Doctor home screen with twelve category-specific vector visuals from the application's existing Material Community Icons family.
- Matched the imagery to each dental category's contents, including restorative dentistry, endodontics, consumables/isolation, surgery, prosthodontics, rotary instruments, sterilization, diagnostics, orthodontics, paediatrics, devices, and clinic operations.
- Added accessible category-button labels and a responsive 2/3/4-column layout for phone, tablet, and desktop.
- Passed strict typecheck, lint, 23/23 Vitest tests, production Web export, and Doctor Web E2E 8/8.
- Committed and pushed the isolated change as `8d8fff9`; verified Vercel production now serves the rebuilt category chunk.

## 2026-10-25 — Product image candidate package

- Researched existing Internet product photography for all 196 dental catalog records without generating images.
- Prepared 539 WebP candidates: 147 products have three options and 49 products have two options; every product has at least two valid, locally opened image files.
- Numbered image folders and files by stable SKU, and created a machine-readable AI mapping, per-image source register, separate source-organization contact register, Arabic AI README, and category review sheets.
- Marked every image `permission-required`; the package is for review and rights clearance, not automatic publication.
- Verified 196 manifest records, 539 source rows, 326 source organizations, zero missing files, and zero invalid image files; exported the complete ZIP under `outputs/`.

## 2026-10-26 — Curated hosted product media

- Read the owner-curated `Design & Assets/images` folder without modifying it and interpreted its selected images, `edited.txt`, and `deleted.txt` markers.
- Produced a reviewable package under `outputs/product-media-ready`: 95 normalized 1200×1200 WebP images for 93 SKUs, a manifest, and a contact sheet.
- Created the hosted public `product-media` bucket, uploaded the curated files with content-hashed object keys, and linked them through `media_assets` and `product_media` (93 primary images plus two gallery images).
- Applied 19 bilingual catalog-name corrections and marked 102 owner-designated products inactive rather than deleting them.
- Independently verified 196 total / 94 active products, all 19 name edits, 95 media links, 93 primary flags, and successful public retrieval of all 95 WebP files; verification returned zero errors.
- Preserved all unrelated working-tree changes and did not modify the read-only visual reference folder.
- Corrected inconsistent apparent product scale after owner review: detected the real non-white content bounds of every image, retained a safety margin, resized the subject proportionally to a 1000-pixel maximum extent, and re-centered it on the 1200×1200 white canvas.
- Published content-hashed scale-v2 replacements and atomically relinked the 93 products. Verified 95/95 public images, 95/95 media links, and 93 primary flags; prior objects remain unlinked for safe rollback.
- Applied five owner-requested Arabic display-name corrections to the hosted catalog and the local Product Master/seed: `مسند MOD`, `أقماع ورقية`, `ألجينات`, `ميكروتور`, and `فلورايد للأطفال`. English names and images were left unchanged, and all five hosted values were read back successfully.
- Added active product `TWD-DEN-0197` (`مسند ملقط` / `Matrix Band Retainer Set`) under Restorative Dentistry with no price and unavailable ordering state, plus a zero-stock central inventory row.
- Published the owner-supplied matrix-retainer image as the new product's primary media and replaced the primary image for `TWD-DEN-0027` (`أقماع ورقية`) with the supplied paper-points image. Both exact JPEG originals were preserved, publicly retrieved, and linked successfully.
- Updated Product Master, seed, catalog-count checks, README, and the database catalog-count assertion from 196 to 197 products.
- Corrected `TWD-DEN-0014` from `مسند MOD` to `مسندة MOD`, then added active product `TWD-DEN-0198` (`مسندة MO` / `MO Matrix Retainer`) with zero stock and no price.
- Replaced the primary image for `TWD-DEN-0026` (`أقماع غوتا بيركا`), added the first primary image for `TWD-DEN-0022` (`مبارد H يدوية`), and published the owner-supplied image for `TWD-DEN-0198`. All three exact source files passed public Storage verification.
- Hosted verification now reports 198 total products, 96 active products, 102 inactive products, and 98 media links. Every active product now has a primary image.
- Replaced the Doctor app's Expo/iOS/Android icon, splash artwork, Web favicon, header brand mark, and login brand mark with the exact owner-supplied `app logo.png`. No generative edit was applied.
- Passed Doctor Expo Doctor 20/20, strict typecheck, lint, 24/24 tests, and the production Web export after the logo integration.

## 2026-10-26 — Hosted Operations release

- Applied the reviewed product-management migration and a forward-only Operations hardening/bootstrap migration to the hosted Tawreed Supabase project.
- Added one active main warehouse, confirmed the protected product-cost table and low-stock field, and aligned local migration filenames with the versions recorded by the hosted migration service.
- Created the confirmed hosted `owner@tawreed.app` user with active `owner` staff membership through a server-only bootstrap helper; no privileged key or password was committed.
- Verified hosted password authentication plus Owner context/product access through the publishable-key REST/RLS boundary.
- Passed 24/24 unit/contract tests, strict typecheck, lint, and both production Web exports. The local database reset could not run because Docker Desktop was stopped.
- Pushed commit `66dcabc` to GitHub. Vercel rebuilt the Doctor production project from that commit and a separate `tawreed-operations` project was linked to the same repository with root `apps/operations` and public Supabase client values only.
- Reviewed hosted Supabase advisors after migration. The remaining security notices are the intentionally policy-free deny-by-default future procurement tables, the intentionally authenticated transactional checkout RPC, and disabled leaked-password protection; performance notices are currently unused/missing indexes on low-volume or deferred tables. Password protection and index review were recorded as follow-up hardening work.
- Preserved unrelated backups, generated review outputs, Arabic notes, and the existing unstaged root `.env.example` deletion outside the release commit.

## 2026-10-26 — Public browsing and staged delivery onboarding

- Opened the Doctor home/catalog/product/cart shell to anonymous visitors while retaining RLS-protected checkout, orders, account, notifications, and support routes.
- Changed the cart continuation action to request login only when the visitor is ready to order and preserved `/checkout` across login or account setup.
- Rebuilt registration as three focused pages: first/last name, email/phone/contact preference, and delivery location.
- Added current-location permission/capture, reverse-geocoded address handling, native map selection, and Google Maps Web selection behind a restricted public key with a safe manual/preview fallback.
- Added profile/address coordinates and Google place identifiers, plus immutable order delivery coordinate snapshots. Phone is contact data only until verified identity linking is implemented.
- Added anonymous active-catalog grants/RLS without exposing profiles, orders, costs, inventory, sourcing, or Operations data.
- Updated the Operations database fixture for the 197-product catalog and corrected local seeding to reuse the bootstrapped active warehouse instead of creating a second one.
- Passed workspace lint, strict typecheck, 24/24 Vitest, Doctor Web export, Expo Doctor 20/20, Doctor Web E2E 10/10, all pgTAP tests 65/65 after a clean reset, and the authenticated 197-product catalog verification. Android E2E/APK remain unavailable on this machine.

## 2026-10-28 — Consolidated release preparation

- Consolidated the approved Doctor catalog/onboarding, exact supplied logo assets, 198-product metadata/media updates, and responsive Operations work for publication.
- Excluded local backups, generated outputs, schema ZIPs, credential-bearing environment files, and the destructive review-only replacement SQL from the release.
- Updated Doctor and Operations Expo patch dependencies and reinstalled the workspace; Expo Doctor then passed 20/20.
- Passed workspace strict typecheck, lint, 23/23 Vitest tests, and both production Web exports after removing the obsolete phone/OTP flow.
- Worked around a Windows-reserved local Supabase port range only for validation, restored the committed configuration afterward, and passed the clean reset, 65/65 pgTAP tests, 198-product catalog verification, and Doctor Web E2E 10/10.
- Operations Web E2E passed 11/12 in its parallel run; the only failure was a shared-product media race between projects, and that exact mobile image-edit test passed when rerun alone.
- Attempted the linked hosted migration through Supabase CLI. The API issued a temporary login role, but the linked PostgreSQL pooler repeatedly terminated the connection; the migration was therefore not claimed as applied.

## 2026-10-28 — Removed phone-based authentication

- Removed the WhatsApp sign-in button and deleted the phone/OTP authentication routes.
- Removed phone OTP methods from the shared data boundary and removed the unused OTP validators and contract test.
- Kept the phone field in staged registration, profiles, checkout, and order snapshots strictly for customer contact and delivery.
- Recorded email/password as the sole Doctor account identifier and removed Twilio authentication from the release blockers.
- Passed workspace strict typecheck, lint, 23/23 Vitest tests, Doctor Web export, and 4/4 focused login/registration Playwright checks across mobile and desktop. The full Web suite also ran but local-Supabase-dependent cases failed because the local service was unavailable.
