# Testing

## Automated layers

| Layer | Coverage | Command | Current result |
|---|---|---|---|
| Unit | Money totals/formatting, availability/order labels, error normalization, auth/profile/checkout validators, public config | `pnpm test` | Passed as part of 23 tests |
| Component | Product Card interaction/disabled state and all availability badges | `pnpm test` | Passed as part of 23 tests |
| Repository contract | Immediate registration session, WhatsApp no-signup guard, checkout RPC payload/response, centralized media resolution | `pnpm test` | Passed as part of 23 tests |
| Database/RLS | RLS/grants, protected sourcing metadata, checkout rejection, 12-category/196-product seed integrity, no invented price/inventory | `pnpm test:db` | 19/19 passed against reset local database |
| Catalog API integration | Temporary confirmed Doctor reads the full Product Master and searches English/SKU through authenticated REST/RLS; user is removed afterward | `pnpm test:catalog` | Passed: 12 bilingual categories, 196 complete products, 0 prices |
| Web E2E | Arabic/RTL metadata, Segoe UI, login controls, account-setup popup navigation/dismissal, and horizontal overflow at Pixel 7 and desktop sizes | `pnpm test:web` | 8/8 passed |
| Android E2E | Login → catalog → product → cart → checkout → success → orders → detail | `pnpm e2e:android` | Authored; blocked by missing ADB/emulator, Maestro, and configured test backend |

## Additional gates

`pnpm typecheck`, `pnpm lint`, `pnpm peers check`, `pnpm expo:doctor`, and `pnpm build:web` are required before release. They passed on 2026-10-25.

The pgTAP suite lives at `supabase/tests/rls_and_checkout.sql` and passed locally on 2026-10-25. The local catalog integration script lives at `scripts/verify-local-catalog.mjs`. The Maestro flow lives at `.maestro/core-flow.yaml` and remains unrun.

Disposable-account browser verification at 390×844, 375×812, and 812×375 confirmed immediate entry after registration, left-side header icons, right-side logo placement, internal-page back navigation, the persistent authenticated bottom bar in portrait/landscape, reduced-motion behavior, and no landscape horizontal overflow. Temporary accounts were deleted after the checks.

## Manual release checks still required

- Confirm email registration/confirmation, password login/reset, logout, and session restoration against the hosted Supabase project.
- Confirm WhatsApp delivery through the configured Twilio/Twilio Verify service, using an already-linked phone only.
- Exercise cached catalog and cached order history after a successful online load, then verify every write fails clearly while offline.
- Compare authenticated Web and Android screenshots to the supplied home, catalog, product, cart, checkout, order, and account references.
- Install the preview APK on a real/emulated Android device and complete the core journey.
