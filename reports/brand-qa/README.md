# Tawreed identity v1.0 - implementation report

## Scope applied

- Replaced the shared visual foundation with Tawreed primitive and semantic tokens, including light and dark theme maps, 4-point spacing, approved radii, and soft shadows.
- Self-hosted Noto Kufi Arabic and Manrope from the approved brand package.
- Restyled shared buttons, inputs, badges, cards, product cards, search, chips, toast, and order-tracking states through semantic tokens.
- Applied Arabic-first RTL behavior, logical positioning, five-item mobile navigation, Western digits, and the `ل.س` suffix.
- Copied and integrated the approved SVG logos without recoloring or redrawing.
- Replaced the Expo starter/native assets with the approved Tawreed app icon, adaptive icon, splash artwork, favicon, Apple touch icon, and PWA icons.
- Updated app naming, metadata, search copy, manifest, cache version, URL scheme, and the social image.
- Removed superseded Expo/React demo artwork and old logo/icon references from the Doctor app.

## Main files and folders changed

- `packages/design-tokens/src/index.ts`
- `packages/ui/src/index.tsx`
- `packages/domain/src/index.ts`
- `apps/doctor/src/app/**`
- `apps/doctor/src/components/**`
- `apps/doctor/src/locales/ar.ts`
- `apps/doctor/src/lib/category-icons.ts`
- `apps/doctor/assets/brand/`
- `apps/doctor/assets/fonts/`
- `apps/doctor/assets/images/`
- `apps/doctor/public/`
- `apps/doctor/app.json`
- `apps/doctor/scripts/fix-web-html.mjs`
- `scripts/verify-brand-pwa.mjs`

## Verification results

- Workspace TypeScript: passed.
- Workspace lint: passed.
- Unit tests: 24/24 passed.
- Doctor web production build: passed.
- PWA audit script: passed for Arabic/RTL metadata, title, theme color, manifest, icon availability, maskable declaration, and service-worker registration.
- Favicon contains 16x16, 32x32, and 48x48 frames.
- Icon dimensions verified: Apple 180, app icons 192/512/1024, maskable 512, social image 1200x630.
- Hard-coded color audit: no raw colors remain in Doctor UI or shared UI component source; color values are confined to token and platform metadata files.
- Old brand/starter asset audit: no old Doctor app name or old logo/icon references remain in active Doctor app code.
- Contrast checks passed WCAG AA for all principal light and dark text/background pairs; accent buttons use ink, never white.
- Visual review completed at 375px, 1280px, and 812x375 landscape for the public shell, authentication, registration, and cart states.

## Screenshots

### Before

- `before/home-mobile.png`
- `before/home-desktop.png`
- `before/auth-mobile.png`

### After

- `after/home-mobile.png`
- `after/home-mobile-live-data.png`
- `after/home-desktop.png`
- `after/auth-mobile.png`
- `after/auth-desktop.png`
- `after/register-mobile.png`
- `after/cart-mobile.png`
- `after/auth-landscape.png`

## Values chosen outside the specification

- No new brand colors were introduced. Dark-theme error and info tokens reuse the supplied `error` and `info` primitives.
- The PWA cache key was advanced to `tawreed-brand-v3` and the persisted query cache buster to `tawreed-brand-v2`; these are implementation version identifiers, not visual values.
- The OG image uses an 8% white capsule pattern on emerald, matching the optional brand-book pattern guidance.

## Environment limitations

- The app currently declares light-only native UI (`userInterfaceStyle: light`), so the supplied dark semantic token map was added but the product was not switched to an unrequested dark-mode behavior.
- The first visual capture occurred while Docker/Supabase was stopped. The local stack was later restarted on the configured `54321` port, the auth health endpoint returned HTTP 200, and `after/home-mobile-live-data.png` confirms the populated home screen.
- Physical installation on Android Chrome and iOS Safari, OS-level splash observation, and Chrome DevTools' maskable preview require real devices/browser UI and were not available in this environment. The underlying manifest, service worker, icon purposes, dimensions, native Expo configuration, and splash colors were validated programmatically.
