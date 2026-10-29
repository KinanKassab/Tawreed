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
- Applied the linked hosted migration through the transaction pooler after the session-pooler connection was repeatedly terminated. Direct anonymous REST verification returned `0-1/96`, confirming all 96 active products are publicly readable.
- Removed the temporary user-level database-password environment variable immediately after migration and verification.

## 2026-10-28 — Removed phone-based authentication

- Removed the WhatsApp sign-in button and deleted the phone/OTP authentication routes.
- Removed phone OTP methods from the shared data boundary and removed the unused OTP validators and contract test.
- Kept the phone field in staged registration, profiles, checkout, and order snapshots strictly for customer contact and delivery.
- Recorded email/password as the sole Doctor account identifier and removed Twilio authentication from the release blockers.
- Passed workspace strict typecheck, lint, 23/23 Vitest tests, Doctor Web export, and 4/4 focused login/registration Playwright checks across mobile and desktop. The full Web suite also ran but local-Supabase-dependent cases failed because the local service was unavailable.
# 2026-10-28 — Cache-first PWA, product media states, and email flows

- Made persisted catalog data render first and revalidate in the background on mount/reconnect without enabling offline mutations.
- Added PWA manifest/service worker output, account-first installed launch, compact catalog category icons, product-image loading/error fallbacks, and removed visible in-app logo artwork while preserving app/site icons.
- Added six-digit signup email verification/resend, an Arabic Supabase email template, and a protected Edge Function that emails saved support reports without exposing provider secrets to clients.
- Added `docs/EMAIL_SETUP.md` and recorded the remaining external SMTP/sender/recipient deployment configuration.
- Passed strict typecheck, lint, 23/23 unit tests, Expo Doctor 20/20, and Doctor Web export. Android E2E/APK and live production email were not run.

## 2026-10-28 — Resend domain and hosted SMTP

- Confirmed that Resend reports `auth.tawreed.app` as verified, including DKIM and both sending records.
- Created `Tawreed Production` with sending-only access restricted to `auth.tawreed.app`; its value was handled through the browser clipboard and was not stored in repository files.
- Enabled custom SMTP in hosted Supabase using `smtp.resend.com`, port `465`, username `resend`, and sender `Tawreed <no-reply@auth.tawreed.app>`.
- Reloaded the Supabase dashboard and verified that sender, host, username, and encrypted stored-password state persisted.
- Remaining email work: choose the support-report recipient, set Edge Function secrets, deploy `send-support-email`, and run live signup/support delivery tests.

## 2026-10-28 — Support email activation

- Set `SUPPORT_EMAIL_TO=problem@tawreed.app`, `SUPPORT_EMAIL_FROM=Tawreed Support <support@auth.tawreed.app>`, and the restricted Resend API key as hosted Supabase Edge Function secrets without writing their values to the repository.
- Cleared the Resend key from the Windows clipboard after Supabase confirmed all three secrets were stored.
- Deployed `send-support-email` through the linked Supabase CLI using API bundling; Supabase reports version 1 as `ACTIVE` with JWT verification enabled.
- Verified the three custom secret names through the hosted secrets listing and confirmed the public endpoint rejects a request without authorization with HTTP 401.
- A live authenticated Doctor support-case delivery and a signup-code inbox check remain to be exercised with real test credentials.

## 2026-10-29 — Guest auth prompt and production release preparation

- Added one accessible sign-in modal shared by mobile and desktop navigation for signed-out Orders and Account selections, including destination-preserving login routing and Playwright coverage.
- Split Google Maps into independently restricted Web, Android, and iOS environment variables and added the stable iOS bundle identifier `com.tawreed.doctor`.
- Upgraded Expo SDK 58 patch dependencies consistently across Doctor, Operations, and shared native packages; Expo Doctor passed 20/20 afterward.
- Upgraded the installable Web icon from the small favicon to the full 1254×1254 app icon and versioned the service-worker shell cache.
- Passed workspace strict typecheck, lint, 23/23 Vitest tests, Expo Doctor 20/20, both Web exports, and the focused signed-out Orders/Account prompt test 2/2 on Pixel 7 and desktop profiles. Local database, catalog, Operations Web E2E, and the remaining local-dependent Doctor Web E2E could not complete because Docker Desktop was not running. Android E2E could not start because ADB and Maestro are absent; EAS is authenticated but the app is not linked to an EAS project.
- Pushed Doctor release commit `7ecaf77` to GitHub `main`; Vercel production reached `READY` and aliased it to `tawreed.app`, `www.tawreed.app`, and `tawreed-doctor.vercel.app`. Live HTTP checks returned 200 for the shell, manifest, service worker, full app icon, and favicon, and headless mobile/desktop checks confirmed the guest sign-in prompt is visible.

## 2026-10-29 — Delivery address lookup diagnosis

- Verified the production Web map key is present and the Google Maps script and interactive map load successfully.
- Reproduced point selection on production: coordinates update, while Google rejects `Geocoding Service` because Geocoding API is not authorized on the key.
- Unified reverse geocoding for map clicks and current-location selection across Web/native, preserves manually entered addresses on lookup failure, and now reports a clear manual-entry fallback instead of a misleading success message.
- Doctor typecheck, lint, 23/23 tests, and Web export passed after the change.

## 2026-10-29 — Hosted signup-code correction

- Investigated a production report that the signup activation code did not arrive and compared the linked hosted Auth configuration against the application contract.
- Found hosted drift: Supabase still generated eight-digit OTPs and used its default English confirmation template while the Doctor activation screen accepted exactly six digits.
- Updated only the hosted Auth settings needed for production: six-digit OTPs, the Arabic Tawreed confirmation-code template, `https://tawreed.app` as the site URL, and the intended Web/native redirect allow-list.
- Re-ran the hosted configuration diff and confirmed zero remaining managed Auth differences; the existing Resend SMTP host, sender, username, port, and enabled state remained unchanged.
- A fresh resend to the user's real inbox is still required to verify final mailbox delivery and spam filtering.
## 2026-10-29 — Priced USD catalog replacement

- Transcribed the owner-approved catalog into `data/catalogs/tawreed_priced_catalog_usd.json` with USD as the explicitly confirmed currency.
- Added grouped product options without weakening server-authoritative checkout: each option retains its own product ID and price row, while Doctor catalog/detail views group siblings and require an option choice.
- Generated 11 categories, 131 product groups, and 202 product/option rows. Exactly 167 rows have numeric USD prices and are active; 35 rows marked unspecified/on-request are archived. The public catalog exposes 109 priced product groups.
- Added a guarded hosted replacement utility that deletes the pre-existing 102 archived rows and their safe orphaned media, archives active rows absent from the approved catalog, replaces prices, and verifies the resulting active catalog. The destructive apply requires an exact confirmation environment value.
- Preserved commercial integrity by importing no inventory and leaving every row unavailable until Operations verifies stock.
- Local clean reset passed. Workspace strict typecheck, lint, 23/23 Vitest tests, 65/65 pgTAP tests, authenticated public catalog verification, and both production Web exports passed. Hosted migration/data replacement succeeded: 102 prior archived rows were deleted, 167 active USD-priced rows were verified, 123 rows remain archived, and no active row lacks a price.

## 2026-10-29 — Production activation-email delivery diagnosis

- Reproduced the live resend flow on `www.tawreed.app`; the UI reported success.
- Confirmed the corresponding hosted Supabase Auth `/resend` request completed with HTTP 200 at 16:39:23 Riyadh time.
- Verified custom SMTP is enabled with `smtp.resend.com:465`, the Tawreed sender, and the expected username; DNS/DKIM and the Resend return-path records resolve.
- Found no sent emails in the Resend account, and the intended `Tawreed Production` sending-only API key reports `No activity`.
- Concluded that the stored Supabase SMTP password does not match the intended active Resend key. No credential was exposed or changed. Repair requires creating a fresh restricted key, replacing the Supabase SMTP password, saving, and repeating the real-inbox test.

## 2026-10-29 — Complete current-catalog image candidate package

- Read the hosted catalog inventory and grouped 290 current product rows (167 active, 123 archived) into 219 actual products so variant rows share the same image choices.
- Reused only exact-name prior candidates and researched missing products from Internet sources, then manually reviewed contact sheets and replaced visibly wrong results for veneer preparation burs, Hexitol/chlorhexidine, surface/foam disinfectants, and sodium-hypochlorite irrigant.
- Produced 640 candidates: 202 products have three options and 17 have two; no product has fewer than two.
- Normalized every file to a centered 1200×1200 WebP and verified all files, dimensions, manifest links, and 640 source rows.
- Added AI mapping, rights/source records, 359 source organizations, Arabic instructions, and 28 visual review sheets under `outputs/tawreed_product_images_all_current/`. All candidates remain permission-required and were not published.

## 2026-10-30 — Current product price-list export

- Read all 290 current hosted product rows and their active price records without exposing or storing a privileged key.
- Created an Arabic Excel list with product number, product name (including option/package labels), and numeric USD price.
- Preserved blank price cells for the 123 rows without a current explicit price; verified 290 total rows, 167 numeric prices, no spreadsheet formula errors, and reviewed the rendered layout.

