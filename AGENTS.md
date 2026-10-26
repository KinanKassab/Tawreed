# Tawreed Doctor engineering rules

## Scope

Build the universal Arabic Doctor application under `apps/doctor`, the responsive internal Owner/Admin/Operations Web application under `apps/operations`, and the shared Supabase backend. Doctor targets are Android APK and responsive Web with iOS compatibility. Do not create a supplier frontend.

## Source of truth

- `../Design & Assets/` is a read-only visual reference. Never edit or ship it as the app.
- Product rules in the implementation brief and `docs/DECISIONS.md` override assumptions.
- Visual contradictions or missing screens belong in `docs/OPEN_QUESTIONS.md`; do not silently redesign.
- Arabic UI is RTL and uses Segoe UI, with the platform system sans-serif as the native fallback when Segoe UI is unavailable.

## Architecture

- Expo + React Native + TypeScript strict + Expo Router + React Native Web.
- TanStack Query owns server state. Zustand is limited to local UI/cart state.
- React Hook Form + Zod own forms and validation.
- UI calls feature hooks, which call repositories, which call the Supabase adapter. Do not call Supabase from screens/components.
- Dynamic media resolves through provider-neutral media records.
- Offline is read-only cached catalog and order history. Never queue mutations or fake success.

## Security

- Every exposed user-data table must have RLS and explicit grants.
- Ownership policies must use `auth.uid()` predicates; `TO authenticated` alone is insufficient.
- Never authorize with user-editable metadata.
- Never expose service-role, Supabase secret, or Twilio credentials to the client.
- Order creation is server-authoritative, transactional, idempotent, and snapshots prices/currency/rates.
- Doctor clients must never access vendors, purchase orders, receipts, costs, or internal inventory operations.

## Required checks

Before claiming completion, run the applicable commands documented in `README.md`: format/lint, strict typecheck, unit/component/integration tests, RLS tests, Expo doctor, web export, Web E2E, Android E2E, and an APK build. Never claim a check passed unless it was run successfully.

## Session protocol

At the start of each session read `AGENTS.md`, `CLAUDE.md`, `docs/PROJECT_STATUS.md`, `docs/DECISIONS.md`, `docs/OPEN_QUESTIONS.md`, and `docs/HANDOFF.md`. Before stopping, update project status, append the worklog, update handoff, and record new decisions/questions/issues. Preserve unrelated user work.

## Forbidden shortcuts

No WebView wrapper, raw HTML app, broad `any`, disabled strictness/lint, hardcoded exchange rates or production catalog, client-authoritative totals, fake offline success, privileged client secrets, supplier marketplace logic, or unverified completion claims.
