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

## 2026-10-25 — GitHub repository linkage verification

- Verified that the existing local repository uses `https://github.com/KinanKassab/Tawreed.git` as the `origin` fetch and push URL.
- Confirmed that the GitHub repository is reachable and currently has no branches or commits.
- Preserved all local files as untracked work; no commit or push was performed.
