# Architecture

A working engineer's tour of the moving parts. For product / positioning, see the
top-level [`README.md`](../README.md).

## 1. Multi-tenancy model

```
┌────────────── auth.users ──────────────┐   Supabase-managed
└────────────────────┬──────────────────┘   (email, password_hash, etc.)
                     │  on_auth_user_created trigger
                     ▼
           ┌─ public.users ─┐            one mirror row per auth user
           └───────┬────────┘            (display_name, avatar_url, ...)
                   │
                   │ user_id FK
                   ▼
        ┌──── public.memberships ────┐   many-to-many user ↔ organization
        └────────────┬───────────────┘   + role (strategos_admin / client_owner /
                     │                    client_member / client_viewer)
                     │ organization_id FK
                     ▼
      ┌──── public.organizations ─────┐  type = 'agency' (Strategos) or
      └─────────────┬─────────────────┘  'client' (Just Print, ...)
                    │
                    │ organization_id FK
                    ▼
    ┌─ public.agent_connections ─┐    which agents are enabled
    └──────────┬─────────────────┘    per client + config JSON
               │
               │ agent_id FK
               ▼
       ┌─ public.agents ─┐            slug, name, api_base_url, capabilities
       └─────────────────┘            (Craig today; more later)
```

**RLS is on every table.** Row-level-security policies in
`supabase/migrations/001_initial_schema.sql` enforce that a user only
sees rows whose `organization_id` matches one of their memberships.
Strategos admins bypass via a policy that checks
`exists (select 1 from memberships where role='strategos_admin' and
user_id=auth.uid())`.

## 2. Authentication flow

```
/login  →  supabase.auth.signInWithOtp(email)  →  email with magic link
                                                          │
                                                          ▼
          /auth/callback?code=...  →  exchangeCodeForSession
                                                          │
                                                          ▼
                                           set-cookie: sb-access-token
                                                          │
                                                          ▼
                                                root page (/)
                                                          │
                                           ┌──────────────┴───────────────┐
                                           ▼                              ▼
                                 strategos_admin?              client_owner / member?
                                           │                              │
                                           ▼                              ▼
                                    /strategos                    /c/<theirClient>
```

Everything session-related lives in `src/lib/auth/`:

- `session.ts` — `getCurrentUser()` returns the session user + their
  memberships joined with organizations. This is the primary input to
  every route guard.
- `rbac.ts` — role hierarchy, `canAccessOrg(user, slug)`,
  `isStrategosAdmin(user)`, `hasMinRole(user, slug, 'client_owner')`.
- `middleware.ts` — refreshes Supabase cookies on every request (Next.js
  middleware).

## 3. Route guards

Layer | Where | What it does
---|---|---
Next.js middleware | `src/middleware.ts` | Refreshes Supabase auth cookies. Does NOT gate access — just keeps the session fresh.
Layout guards | `src/app/strategos/layout.tsx`, `src/app/c/[clientSlug]/layout.tsx` | Call `canAccessOrg()` / `isStrategosAdmin()` and `notFound()` if the check fails. This is the main access barrier.
API-route guard | `src/app/api/agent-proxy/route.ts` | Re-checks `canAccessOrg(user, clientSlug)` before calling the agent backend. Closes the "direct POST to /api/..." hole.
Supabase RLS | `supabase/migrations/001_initial_schema.sql` | Final backstop — even if all app-level checks were removed, the DB would refuse queries for orgs the user doesn't belong to.

## 4. How the dashboard talks to Craig

The dashboard never hits Craig's backend from the browser. Everything
flows through a Next.js API route that signs a short-lived JWT so Craig
can trust the caller.

```
component                       server                           Craig
───────                          ──────                           ─────
useApi()          ─────────►   /api/agent-proxy   ────────►   /admin/api/...
fetch('/admin/                                                (Bearer <jwt>)
       api/orgs/just-print/
       conversations')
                                1. canAccessOrg()
                                2. sign JWT with
                                   STRATEGOS_JWT_SECRET
                                   (iss=strategos,
                                    aud=craig,
                                    org=just-print,
                                    role=client_owner,
                                    email=... )
                                3. forward to
                                   {agent.api_base_url}/...
                                4. return response as-is
```

The JWT is the exact shape Craig's `admin_api.py::require_claims` expects.
Same `STRATEGOS_JWT_SECRET` env var is set on both sides.

Client components don't need to know the agent's base URL — they just
call a path shaped like `/admin/api/orgs/{slug}/...` via the
`AgentModuleRunner`'s injected `apiFetch`. The proxy resolves which
agent backend to hit from the URL shape and the `agent_connections`
table.

## 5. The agent plug-in system

Agents (Craig today) are self-contained folders under `src/lib/agents/<slug>/`:

```
src/lib/agents/craig/
├── definition.ts            # Exports `AgentDefinition` — slug, name, modules, capabilities
├── api.ts                   # TypeScript shapes matching Craig's JSON responses
└── modules/
    ├── OverviewModule.tsx
    ├── QuotesModule.tsx
    ├── ConversationsModule.tsx
    ├── CatalogModule.tsx
    ├── ConnectionsModule.tsx     # Widget tab + Missive tab + placeholders
    ├── SettingsModule.tsx
    └── connections/
        ├── WidgetTab.tsx
        ├── MissiveTab.tsx
        └── ComingSoonTab.tsx
```

`registry.ts` imports the definition. When a client's route
`/c/just-print/a/craig/quotes` is hit, the app:

1. Looks up the org + their `agent_connections`.
2. Finds the `craig` definition in `registry.ts`.
3. Renders `AgentModuleRunner` with the `QuotesModule` component,
   providing `organizationSlug`, `agentApiBaseUrl`, and `apiFetch`.

Each module is a standalone React component that uses `apiFetch` to hit
the agent's admin API. No agent-specific code outside this folder.

## 6. Demo mode

When `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
contain the string `placeholder` (or aren't set), `isDemoMode()` returns
`true` and the app:

- Fabricates a demo user with memberships to Strategos + a fake
  Just Print tenant
- Routes all agent API calls through `demo-store.ts`, which is a
  mutable in-memory CRUD store seeded with realistic data
- Works end-to-end (including writes) without ever touching Supabase
  or Craig

Useful for onboarding, screenshots, and demos without real credentials.
Source: `src/lib/demo.ts` + `src/lib/demo-store.ts`.

## 7. Themeing

Each `organizations.theme` JSONB field holds `{ primary_color, font }`
(extendable). The client layout reads it and exposes it as CSS custom
properties (`--color-primary`, `--font-sans`) that the whole route tree
picks up. See [`docs/theming-a-client.md`](./theming-a-client.md).

## 8. Technology choices (quick reference)

| Concern | Pick | Why |
|---|---|---|
| Framework | Next.js 16 App Router | Server components + RSC data fetching + route groups |
| Language | TypeScript strict mode | Catches shape mismatches with agent API responses early |
| Styling | Tailwind + shadcn/ui | Fast iteration, no CSS-in-JS runtime cost |
| Data fetching | `@tanstack/react-query` in client components; RSC fetch in server components | Auto-cached, stale-while-revalidate |
| Forms | `react-hook-form` + `zod` | Typed forms, single source of validation for client + server |
| Tables | `@tanstack/react-table` | Headless, easy to wrap with our own styling |
| Charts | Recharts | SVG, SSR-safe, tiny API |
| Auth + DB | Supabase | One provider for both, with RLS |
| Hosting | Vercel | First-class Next.js support |
| Payments | n/a yet | — |
