# Open questions

## OQ-001 — Missing authentication visual designs

- Status: open
- Blocking: no for architecture; yes for claiming approved pixel fidelity on auth screens
- Question: should the production authentication screens use a conservative extension of the store visual language, or will dedicated approved frames be supplied?
- Reason: login, register, forgot-password, and reset-password screens are required but absent from the reference.
- Impact: visual fidelity of authentication only.
- Affected features: authentication and onboarding.
- Suggested options: (A) reuse the reference surfaces/fields/buttons/palette; (B) provide approved frames before final visual QA.
- Final answer: pending.

## OQ-002 — Account identifiers

- Status: resolved
- Blocking: no
- Question: should Tawreed support phone/WhatsApp as an independent sign-in path?
- Final answer: no. Email/password is the only sign-in and account-creation path. Phone remains contact and delivery data only.

## OQ-003 — External service configuration

- Status: open
- Blocking: no for released Web; yes for Android release verification
- Question: which EAS project and three platform-restricted Google Maps keys should receive the remaining production configuration?
- Reason: hosted Supabase and separate Doctor/Operations Vercel projects are configured and verified, while the Doctor app is not linked to an EAS project and `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY`, `GOOGLE_MAPS_ANDROID_API_KEY`, and `GOOGLE_MAPS_IOS_API_KEY` are absent.
- Impact: interactive Google map selection, APK cloud build, and Android release validation.
- Affected features: release validation.
- Final answer: Supabase and Vercel were resolved on 2026-10-26; Doctor and Operations have separate production projects using public client values only. EAS project linking and the three restricted Google Maps keys remain pending. Without the matching key, current-location capture, manual address entry, and a Google Maps preview link remain available, but in-app Google map selection is not enabled.

## OQ-004 — Privileged Operations approval boundaries

- Status: resolved
- Blocking: no
- Question: may an Operations Manager directly change selling prices and exchange rates, or must one or both actions require Owner/Admin approval?
- Reason: Operations visibility into purchase costs and margins was confirmed, but the answer did not distinguish direct mutation from approval-gated mutation.
- Impact: role capabilities, approval records, audit events, and financial-control RPCs.
- Affected features: catalog pricing, exchange rates, staff authorization, and audit history.
- Suggested option: Operations may propose and schedule selling-price changes; Owner/Admin approves them. Exchange-rate changes remain Owner/Admin-only.
- Final answer: Operations Manager may directly change both selling prices and exchange rates. Admin and Owner inherit these capabilities. All changes require immutable old/new-value audit events, but no approval workflow is required in the initial phase.

## OQ-005 — Owner and Admin account authority

- Status: resolved
- Blocking: no
- Question: how should Owner, Admin, and Operations Manager permissions relate during the owner-operated launch phase?
- Reason: the owners will run operations initially, and a protected top-level authority avoids an Admin accidentally or maliciously removing owner access.
- Impact: role hierarchy, account recovery, invitations, and audit history.
- Affected features: internal authentication, staff management, and every privileged internal feature.
- Final answer: permissions are cumulative by rank for now: Owner includes Admin and Operations Manager; Admin includes Operations Manager. Capabilities will remain individually modeled so they can be separated later. Admin provisions staff accounts, and Owner inherits that authority.

## OQ-006 — Missing Operations visual designs

- Status: open
- Blocking: no for implementation; yes for claiming approved pixel fidelity
- Question: will dedicated approved frames be supplied for the internal Owner/Admin/Operations Web application?
- Reason: the supplied visual reference covers the Doctor storefront, not the internal dashboard.
- Impact: final visual density, responsive navigation, tables/editors, and approval of the internal visual language.
- Affected features: the entire Operations Web application.
- Current implementation: conservative Arabic RTL extension of Tawreed's approved palette, Segoe UI typography, spacing, surfaces, and accessibility behavior.
- Final answer: pending.

## OQ-007 — Production email sender configuration

- Status: resolved
- Blocking: no
- Question: which inbox should receive support reports?
- Current implementation: `auth.tawreed.app` is verified in Resend, a domain-restricted sending key exists, hosted Supabase SMTP is enabled with `Tawreed <no-reply@auth.tawreed.app>`, and the JWT-protected `send-support-email` function is deployed with server-only secrets.
- Final answer: support reports are sent to `problem@tawreed.app`; the function sends from `Tawreed Support <support@auth.tawreed.app>`. Secrets are stored only in Supabase and are not exposed through `EXPO_PUBLIC_*` values.
