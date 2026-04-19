# `src/lib/auth` — session, RBAC, and middleware

Three tiny files that together enforce who sees what across the app.
For the bigger picture see [`../../docs/architecture.md`](../../../docs/architecture.md).

## `session.ts`

`getCurrentUser()` is the one call every server component makes to find
out who's logged in. It:

1. Reads the Supabase session from cookies (via `createClient()`
   which wraps `@supabase/ssr`).
2. Returns `null` if no session.
3. Otherwise joins `public.users` → `memberships` → `organizations`
   and returns an `AppUser` with `memberships: MembershipWithOrg[]`.

`requireUser()` is the same thing but throws (redirects to `/login`) if
no session. Use it in any layout that requires auth.

## `rbac.ts`

Pure helper functions — no Supabase calls. Given an `AppUser`:

- `isStrategosAdmin(user)` — true if the user has a membership with
  `role='strategos_admin'` on an organization of `type='agency'`.
- `canAccessOrg(user, orgSlug)` — true if they're a Strategos admin OR
  they have any membership on that org.
- `hasMinRole(user, orgSlug, minRole)` — checks against the role
  hierarchy: `client_viewer (1) < client_member (2) < client_owner (3)
  < strategos_admin (4)`.

Use `canAccessOrg` in every layout / API route that reads
client-scoped data. Use `hasMinRole` on write actions that require
elevated permissions (settings edits, catalog writes, user management).

## `middleware.ts`

The Next.js middleware (`src/middleware.ts`) imports the
`supabase/middleware.ts` client to refresh Supabase auth cookies on
every request. This is how the session stays valid across navigations.

Does **not** gate access — that's the layouts' job. Don't add role
checks here; the auth cookie refresh needs to run on every request,
including /login and /auth/callback.

## Where the real guards run

| Location | What it checks | What it returns on fail |
|---|---|---|
| `src/app/strategos/layout.tsx` | `isStrategosAdmin` | `notFound()` — 404 (not 403; we don't leak that `/strategos` exists) |
| `src/app/c/[clientSlug]/layout.tsx` | `canAccessOrg(user, clientSlug)` | `notFound()` |
| `src/app/api/agent-proxy/route.ts` | `canAccessOrg(user, body.clientSlug)` | 403 Forbidden |
| Server actions (e.g. `src/app/strategos/users/actions.ts`) | `assertStrategosAdmin()` | throw Error |
| Supabase RLS policies | `auth.uid()` vs `memberships` | row not returned / write denied |

Five redundant layers, and that's on purpose — any one of them failing
open doesn't expose another tenant's data.
