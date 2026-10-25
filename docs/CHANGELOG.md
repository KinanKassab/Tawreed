# Changelog

## 2026-10-24

- Added repository audit, implementation plan, architecture/security decisions, open questions, and agent handoff documentation.
- Added Expo Doctor application, shared workspace packages, and responsive Arabic RTL design system.
- Added Supabase auth, catalog/profile/order/support adapters, persistent offline reads, local cart, and protected navigation.
- Added migration, RLS/grants, seed data, operations-ready entities, and transactional idempotent checkout.
- Added unit, component, repository, database, Web E2E, and Android E2E test harnesses plus Vercel/EAS configuration.
- Added reproducible setup/release README and updated project status/handoff with verified results and blockers.
- Replaced generic mock catalog seed data with the supplied 12-category, 196-product Syrian dental Product Master.
- Added Product Master metadata, deterministic catalog seed generation, browse-only unverified commercial states, pagination, and authenticated catalog integration verification.

## 2026-10-25

- Changed application typography to Segoe UI with native system fallbacks and removed bundled Google-font loading.
- Added a safe failed-login recovery prompt that offers account setup without revealing whether an email is registered.
- Reworded visible authentication, configuration, catalog, cart, checkout, notification, and product states as user-facing messages.
- Moved sourcing suggestions and catalog priority out of the Doctor-readable product table into a protected internal table.
- Converted failed-login account setup into an accessible popup with an explicit dismiss action.
- Added immediate authenticated entry after successful password registration.
- Updated the mobile header with matching vector icons, left-side actions, a right-side logo, internal back navigation, and a persistent authenticated bottom bar.
