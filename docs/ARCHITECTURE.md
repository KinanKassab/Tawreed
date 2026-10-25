# Architecture

```text
Expo Router screen
  -> feature hook (TanStack Query / React Hook Form)
    -> domain repository interface
      -> Supabase repository adapter
        -> Supabase Auth / PostgREST / RPC
```

The universal app lives in `apps/doctor`. Shared workspace packages contain design tokens, reusable UI, domain models, repository contracts/adapters, validation, configuration, and generated database types. TanStack Query owns remote state. Zustand owns only local application state such as the cart and non-server UI preferences.

Platform adapters provide query persistence and connectivity without leaking native/browser APIs into feature code. Routes are typed. The root shell establishes RTL, safe-area behavior, font readiness, query/session providers, and normalized errors.

Dynamic product imagery is addressed by stable media IDs and resolved centrally based on provider plus object key/external URL. Components never build storage URLs.
