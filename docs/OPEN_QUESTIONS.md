# Open questions

## OQ-001 — Missing authentication visual designs

- Status: open
- Blocking: no for architecture; yes for claiming approved pixel fidelity on auth screens
- Question: should the production authentication screens use a conservative extension of the store visual language, or will dedicated approved frames be supplied?
- Reason: login, register, WhatsApp OTP, forgot password, and reset password are required but absent from the reference.
- Impact: visual fidelity of authentication only.
- Affected features: authentication and onboarding.
- Suggested options: (A) reuse the reference surfaces/fields/buttons/palette; (B) provide approved frames before final visual QA.
- Final answer: pending.

## OQ-002 — Safe email/phone account linking

- Status: open
- Blocking: yes for production enablement of WhatsApp as an independent sign-in path
- Question: which verified account-linking ceremony should Tawreed use when the same Doctor begins with email/password and later uses a phone/WhatsApp OTP (or the reverse)?
- Reason: separate Supabase email and phone sign-ups can create separate Auth users; silently merging on matching profile data is unsafe.
- Impact: duplicate profiles/orders and account takeover risk.
- Affected features: WhatsApp OTP, registration, profile, cached orders.
- Suggested option: require an authenticated user to add and verify the second identifier from account settings, then allow it as a sign-in identifier only after verified linking; keep independent phone signup disabled until this flow is verified end to end.
- Final answer: pending.

## OQ-003 — External service configuration

- Status: open
- Blocking: no for released Web; yes for WhatsApp and Android release verification
- Question: which Twilio Verify service and EAS project should receive the remaining production configuration?
- Reason: hosted Supabase and separate Doctor/Operations Vercel projects are configured and verified, while Twilio and EAS identifiers/credentials are still absent.
- Impact: WhatsApp delivery, APK cloud build, and Android release validation.
- Affected features: release validation.
- Final answer: Supabase and Vercel were resolved on 2026-10-26; Doctor and Operations have separate production projects using public client values only. Twilio and EAS configuration remain pending.

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
