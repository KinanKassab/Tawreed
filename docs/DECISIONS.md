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
