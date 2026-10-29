# Decisions

## ADR-001 — Universal Expo application

- Date: 2026-10-24
- Status: accepted
- Decision: use one Expo Router application for Android, Web, and future iOS.
- Reason: mandated stack and shared product behavior.
- Consequence: platform differences are isolated behind adapters; no separate web app.

## ADR-002 — Reference fidelity over generated style guidance

- Date: 2026-10-24
- Status: accepted
- Decision: preserve the supplied palette, geometry, density, and responsive behavior. UI guidance tools are used only for accessibility/platform checks.
- Reason: the approved visual design is the source of truth.
- Consequence: no speculative visual redesign or substitute palette; ADR-008 records the later user-approved font change.

## ADR-003 — Supabase boundaries

- Date: 2026-10-24
- Status: accepted
- Decision: screens call feature hooks/repositories; only the Supabase adapter calls `supabase-js`.
- Reason: testability and future backend portability.
- Consequence: database rows are mapped deliberately into domain models.

## ADR-004 — Transactional order RPC

- Date: 2026-10-24
- Status: accepted
- Decision: implement order creation as a narrowly granted Postgres function that authenticates `auth.uid()`, re-reads products/prices/configuration, calculates totals, snapshots commercial data, and enforces an idempotency key in one transaction.
- Reason: Postgres functions are transactional and keep authoritative pricing next to the data.
- Consequence: the function is security-definer only where necessary, lives behind explicit execute grants, pins `search_path`, performs its own authorization, and receives product IDs/quantities rather than prices.

## ADR-005 — Explicit API grants plus RLS

- Date: 2026-10-24
- Status: accepted
- Decision: migrations explicitly grant only required table/function privileges and enable RLS on every exposed table.
- Reason: current Supabase projects may not auto-expose new tables; grants and RLS solve different layers.
- Consequence: authenticated/anonymous reachability is reviewable and tested.

## ADR-006 — Offline scope

- Date: 2026-10-24
- Status: accepted
- Decision: persist only catalog/product reads and user-scoped order reads; never queue writes.
- Reason: explicit product requirement and commercial safety.
- Consequence: network guards block checkout/auth/profile/financial mutations with Arabic feedback.

## ADR-007 — Currency representation

- Date: 2026-10-24
- Status: accepted
- Decision: store monetary minor units as integers and exchange rates as fixed-precision numeric values; use `USD` and `NEW_SYP`.
- Reason: deterministic totals and immutable history.
- Consequence: formatting/decimal behavior comes from server-controlled currency settings.

## ADR-008 — Segoe UI typography

- Date: 2026-10-25
- Status: accepted
- Decision: use Segoe UI throughout the Doctor application. Web uses the installed Segoe UI family with Tahoma/Arial fallbacks; native platforms use their system sans-serif when Segoe UI is unavailable.
- Reason: direct product-owner request superseding the earlier IBM Plex Sans Arabic requirement.
- Consequence: bundled Google font loading and its startup gate are removed, while explicit weights preserve hierarchy across platforms.

## ADR-009 — Safe failed-login recovery

- Date: 2026-10-25
- Status: accepted
- Decision: after an invalid email/password attempt, show a generic user-facing error and offer account setup without confirming whether the email exists.
- Reason: give new users a clear recovery path while preventing account enumeration.
- Consequence: the registration route is directly reachable from the recovery prompt; wrong-password and unknown-account responses intentionally remain indistinguishable.

## ADR-010 — Immediate post-registration entry

- Date: 2026-10-25
- Status: accepted
- Decision: when password registration returns an authenticated session, enter the Doctor application immediately instead of returning to sign-in.
- Reason: direct product-owner request to remove duplicate credential entry.
- Consequence: projects with mandatory email confirmation keep the user on the registration screen with a clear confirmation message; opening the confirmation link establishes the session without re-entering credentials.

## ADR-011 — Persistent authenticated mobile navigation

- Date: 2026-10-25
- Status: accepted
- Decision: render one mobile bottom navigation bar at the protected-app shell so it remains visible on tab roots and internal screens. Internal screens also show a back action in the app header.
- Reason: direct product-owner request for reliable movement between every authenticated page.
- Consequence: nested Expo tabs retain routing semantics while their built-in bar is hidden; the shell bar owns the visible mobile navigation and safe-area inset.

## ADR-012 — Initial internal Operations scope

- Date: 2026-10-25
- Status: accepted
- Decision: the first Tawreed internal back-office phase covers Doctor orders, catalog/pricing, and one-warehouse inventory. Procurement, vendor workflows, internal delivery management, and dedicated support staffing are deferred.
- Reason: the owners will operate the business directly at launch and want the smallest useful operational surface before hiring employees.
- Consequence: the first release supports confirm-then-reserve order handling, complete-order fulfillment only, substitution with Doctor approval, FEFO stock selection, and Operations-owned WhatsApp support.

## ADR-013 — Owner-led role model

- Date: 2026-10-25
- Status: accepted
- Decision: use one internal Web application with a cumulative hierarchy: Owner inherits every Admin and Operations Manager capability, and Admin inherits every Operations Manager capability. Initial owners therefore operate the whole system directly; Admin provisions future staff accounts.
- Reason: the founders/owners will run Tawreed initially, but permissions must be separable when employees are hired.
- Consequence: staff authorization must be server-controlled and implemented as individual capabilities behind the cumulative rank mapping, so inheritance can later be replaced by separated or custom assignments without changing business data. Doctor identities remain outside staff authorization, and privileged actions require an audit trail.

## ADR-014 — Direct Operations financial controls

- Date: 2026-10-25
- Status: accepted
- Decision: Operations Manager may directly change Doctor selling prices and exchange rates without a prior Owner/Admin approval step. Admin and Owner inherit the same capabilities through the cumulative role hierarchy.
- Reason: the owners will perform Operations work directly during the initial phase and want one operational control surface.
- Consequence: every price and exchange-rate mutation must be server-authorized and append an immutable audit event containing the actor, timestamp, affected record, and old/new values.

## ADR-015 — Product costs and normalized product media

- Date: 2026-10-25
- Status: accepted
- Decision: store purchase-cost history in a staff-only table, keep Doctor-visible selling prices in the existing price history, and normalize newly managed primary product images to 1200×1200 WebP files linked through the existing provider-neutral media tables.
- Reason: Operations needs margin visibility and consistent product imagery without exposing internal costs or coupling product rows to one media provider.
- Consequence: Doctor clients never receive `product_costs`; product saves are server-authorized and audited; Storage writes require staff RLS; each new image uses an immutable unique object key to avoid stale CDN results.

## ADR-016 — Curated catalog removals remain reversible

- Date: 2026-10-26
- Status: accepted
- Decision: treat `deleted.txt` markers in the owner-curated image folders as catalog deactivation (`products.active = false`), not physical row deletion. Normalize selected product photos to 1200×1200 WebP without cropping the product and publish them through the provider-neutral media model.
- Reason: preserve order/catalog referential integrity while reflecting the owner's approved visible assortment and photography.
- Consequence: 102 products remain recoverable but hidden from Doctor catalog policies; 95 selected images cover 93 of the 94 active products, and future replacements can use new immutable object keys.

## ADR-017 — Separate production projects for Doctor and Operations

- Date: 2026-10-26
- Status: accepted
- Decision: deploy Doctor and Operations as separate Vercel projects from the same monorepo. Doctor retains `tawreed.app`; Operations builds only from `apps/operations` and receives the same public Supabase URL/publishable key, never a secret key.
- Reason: the internal console needs an independent release boundary without replacing the existing Doctor site or the older `tawreed` project.
- Consequence: each surface can be deployed or rolled back independently, while authorization remains entirely server-controlled by Supabase staff membership and RLS.

## ADR-018 — Public catalog with gated ordering and staged onboarding

- Date: 2026-10-26
- Status: accepted
- Decision: allow anonymous visitors to read only the active Doctor catalog and retain a local cart; require authentication when entering checkout or any user-scoped route. Registration is a three-page flow for name, contact preferences, and delivery location. Delivery coordinates and the resolved address are snapshotted with an order.
- Reason: visitors must be able to evaluate the assortment before committing to an account, while orders and personal data remain protected. Breaking registration into focused steps reduces form overload and lets location consent appear in context.
- Consequence: `anon` receives RLS-limited select access only to active categories, products, prices, and linked public media. Profiles, orders, support, Operations data, and all mutations remain unavailable. Email/password is the only account identifier; phone is stored for contact/delivery only.

## ADR-019 — Email/password-only Doctor authentication

- Date: 2026-10-28
- Status: accepted
- Decision: remove phone and WhatsApp OTP sign-in from the Doctor client. Account creation, sign-in, and recovery use email/password only; the collected phone number remains required contact and delivery data.
- Reason: WhatsApp Business messaging cannot reliably serve Syrian `+963` recipients, and the product owner chose to remove number-based registration.
- Consequence: the Doctor app exposes no phone-auth routes, repository methods, or OTP validators. Phone values must never be treated as proof of identity.

## ADR-020 — Cache-first PWA and email delivery

- Date: 2026-10-28
- Status: accepted
- Decision: restore persisted catalog reads immediately, revalidate them in the background on mount/reconnect, install a same-origin app-shell service worker, and open installed Web apps at the authenticated account route. Email confirmation uses a six-digit Supabase email OTP, while support reports are saved under RLS before a server-side function sends them by email.
- Reason: direct product-owner request for faster repeat launches, an account-first installed experience, code-based email activation, and emailed support reports.
- Consequence: no mutation is cached or queued; email-provider secrets remain server-side; production requires configured SMTP, a verified sending domain, Edge Function secrets, and deployment of `send-support-email`.

## ADR-021 — Guest navigation prompts and platform-specific map keys

- Date: 2026-10-29
- Status: accepted
- Decision: when a signed-out visitor selects Orders or Account from primary navigation, keep the visitor on the current page and show an accessible sign-in prompt that preserves the requested return path. Configure Google Maps with separate Web, Android, and iOS keys.
- Reason: protected destinations should explain why authentication is required without abruptly discarding browsing context, and Google application restrictions are platform-specific.
- Consequence: the Web key is restricted by HTTP referrer and Maps JavaScript API; Android is restricted by `com.tawreed.doctor` plus the signing SHA-1 and Maps SDK for Android; iOS is restricted by `com.tawreed.doctor` and Maps SDK for iOS.
