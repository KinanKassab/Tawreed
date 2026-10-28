# Implementation plan

## Phase 0 — audit and memory

- [x] Inventory `Code` and `Design & Assets`.
- [x] Audit screens, assets, tokens, responsive behavior, and missing states.
- [x] Create agent rules and persistent documentation.

## Phase 1 — workspace and quality gates

- [x] Create pnpm workspace and universal Expo Doctor app.
- [x] Enable strict TypeScript, ESLint, Vitest, component tests, Playwright, and Maestro configuration.
- [x] Pin compatible dependencies and create the lockfile.

## Phase 2 — design system and shell

- [x] Apply Segoe UI typography with system fallbacks and explicit weights; remove the bundled-font startup gate.
- [x] Build typed tokens and shared primitives.
- [x] Implement RTL app shell, responsive web frame, safe areas, and navigation.
- [x] Define loading, empty, error, and offline components.

## Phase 3 — backend foundation

- [x] Add local Supabase configuration and migrations.
- [x] Model Doctor-facing commerce plus future Tawreed operations concepts.
- [x] Add grants, RLS, transactional/idempotent order RPC, seeds, and generated database types.
- [x] Add and execute RLS/database tests against the reset local schema.

## Phase 4 — authentication

- [x] Email/password login, registration, reset flow, session lifecycle, and profile bootstrap.
- [x] Email/password is the only account creation and sign-in path; phone remains contact/delivery data only.

## Phase 5 — catalog

- [x] Categories, bounded catalog queries, search, category routing, details, availability, and media resolver.

## Phase 6 — offline reads

- [x] TanStack Query persistence with platform adapters.
- [x] Cache catalog/products and the active Doctor's order history only.
- [x] Clear user-scoped cache on logout/account switch and block offline mutations.

## Phase 7–8 — cart and checkout

- [x] Local cart with server-backed product identifiers and client previews only.
- [x] Server-authoritative validation, totals, snapshots, cash on delivery, and idempotent order creation.

## Phase 9–10 — orders and account

- [x] Order history/details/tracking.
- [x] Profile, clinic, default address, support, and report-problem flows.

## Phase 11–15 — hardening and release

- [ ] Complete responsive QA at required widths and compare authenticated screenshots with the reference. Responsive public routes are verified; authenticated comparison needs a running backend.
- [ ] Run unit, component, integration, RLS, Web E2E, and Android E2E checks. Local unit/component/repository/RLS/Web checks pass; Android remains environment-blocked.
- [ ] Validate Expo dependencies, production Web export, Vercel configuration, Android APK, RTL, fonts, and offline behavior. Expo/Web/RTL/fonts pass; live offline, deployment, and APK checks remain.
- [ ] Update status, known issues, changelog, and handoff with only verified claims.
