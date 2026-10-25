# Design audit

Date: 2026-10-24

## Reference inspected

The supplied visual reference is `../Design & Assets/`, not `Design/` plus `assets/` as described by the brief. It contains `index.html`, `styles.css`, `app.js`, 59 SVG assets, and two small PNG product placeholders. The production app will not modify this folder.

## Doctor surfaces found

- Store home with greeting, search, category shortcuts, featured products, header navigation, and mobile bottom navigation.
- Catalog with query search, category/availability/manufacturer filters, sort, result count, and empty state.
- Product detail with image, availability, manufacturer, package, price, quantity, description, storage guidance, and package specifications.
- Cart with quantity controls, removal, commercial summary, delivery fee, tax, total, and empty state.
- Checkout with default address, recipient data, delivery notes, cash on delivery, terms, and order summary.
- Order success appears after checkout in a dialog-style surface.
- Orders with current/previous tabs, order cards, details, and a tracking timeline.
- Account/clinic profile with recipient, phone, and default delivery address.
- Notifications is a dialog-only empty-state surface.
- Corporate marketing pages also exist, but the requested production scope is the Doctor application, not the public marketing site.

## Reusable visual patterns

App header, desktop store navigation, mobile bottom navigation, search field, product/category/order cards, availability badge, quantity stepper, primary/secondary buttons, form field, white surface card, summary rows, empty state, modal/dialog, tracking step, and offline/loading/error variants to be added in the same visual language.

## Tokens extracted

| Role | Reference value |
| --- | --- |
| Ink | `#173F43` |
| Deep | `#0D3238` |
| Green | `#4E9D8D` |
| Mint | `#7FC8B9` |
| Pale | `#EEF6F4` |
| Soft background | `#F7FAF9` |
| Border | `#E3ECEB` |
| Muted text | `#60787B` / `#6E8587` |
| Warning surface/text | `#FBF3E1` / `#97661A` |
| Card radius | 12px |
| Major radius | 16–20px |
| Main desktop content | 1200px max |
| Minimum controls | 44–52px |

The original brief selected IBM Plex Sans Arabic, but the product owner changed the production font to Segoe UI on 2026-10-25. Web uses Segoe UI with standard fallbacks; native platforms use the system sans-serif where Segoe UI is unavailable. The reference CSS asks for Cairo/Readex font files that are not present, so those declarations are not treated as reliable assets.

## Responsive behavior

- Desktop: content max 1200px; three-column catalog; two-column detail/cart/checkout; desktop header navigation.
- Tablet around 900px: two-column catalog, narrower summaries, single-column profile.
- Mobile at 680px and below: 16px outer gutter in store, two-column product grid, hidden filter panel with toggle, single-column cart/checkout/details/orders, fixed four-item bottom navigation.
- Very narrow below 375px: single-column catalog/product grid.
- Large desktop at 1441px+: bounded content remains centered rather than stretching.

Validation targets: 360, 375, 390, 430, 768, 1024, 1280, 1440, and 1920 pixels.

## States found

Available/limited/unavailable stock; disabled unavailable purchase; cart empty; catalog empty; previous orders empty; notifications empty; order states; product-not-found; page-not-found; toast feedback; modal details. Loading, network error, session expiry, and explicit offline states are missing and will be implemented using the same visual system.

## Contradictions and missing designs

1. Authentication screens (login, register, OTP, forgot/reset password) are required but absent. This is recorded as an open visual question. A conservative implementation can reuse the existing surfaces, field geometry, palette, spacing, and buttons without inventing a new visual style.
2. The reference uses USD only and hardcodes a delivery fee/tax; production values must be server-controlled and support USD plus `NEW_SYP`.
3. The tracking label `خرج للتوصيل` differs from the approved `قيد التوصيل`; production uses the approved lifecycle.
4. The reference is explicitly a local demo using browser storage and mock product/order data. None of that logic is trusted or carried over.
5. The reference includes public marketing pages that are outside the Doctor app scope.
6. The supplied font declarations reference missing files; the later user-approved Segoe UI decision is recorded in ADR-008.

## Fidelity policy

The production UI preserves the reference hierarchy, palette, radii, card density, RTL layout, responsive column changes, and navigation structure. Accessibility, safe-area, keyboard, loading/error/offline, and authentication additions will use the same tokens and patterns. Any visible departure not required for platform safety remains subject to `OPEN_QUESTIONS.md`.
