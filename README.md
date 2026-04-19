# Strategos AI Dashboard

Central control plane for Strategos AI. Every client workspace, every agent,
every user — managed from one place.

**Live stack**

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres + Auth) for the control plane
- Vercel for hosting
- JWT-signed requests to each agent backend (e.g. Craig at Cloud Run)

---

## What this is

A multi-tenant dashboard where:

- **Strategos admins** (JS + Roi) see every client, every agent, every user
- **Client owners** (e.g. Justin at Just Print) manage their own workspace
- **Agents** (Craig for now, more later) plug in as modules that render
  inside any client workspace that has them connected

This app holds **no** client data — it talks to each agent's own backend over
HTTPS, signing short-lived JWTs so the agents can trust the caller.

```
Browser ──► Strategos Dashboard ──► Craig backend (Cloud Run)
                (Vercel)              (owns the quote/conversation data)
```

---

## Getting started

### 1. Prerequisites

- Node.js 20+ and npm
- A Supabase project (free tier is fine — create at https://supabase.com)

### 2. Install

```bash
git clone <this repo>
cd strategos-dashboard
npm install
```

### 3. Configure

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase Settings → API>
STRATEGOS_JWT_SECRET=<32 bytes hex — openssl rand -hex 32>
```

The **same** `STRATEGOS_JWT_SECRET` must be set on each agent backend that
trusts this dashboard (e.g. Craig's Cloud Run service).

### 4. Initialize the database

In the Supabase SQL editor, run the files in order:

1. `supabase/migrations/001_initial_schema.sql` — tables + RLS policies
2. `supabase/migrations/002_seed.sql` — Strategos agency + Just Print client + Craig agent

### 5. Seed yourself as a Strategos admin

Sign in once (see step 6) so Supabase creates your auth user, then run in
SQL editor:

```sql
insert into public.memberships (user_id, organization_id, role)
values (
    (select id from public.users where email = 'YOUR@EMAIL.com'),
    (select id from public.organizations where slug = 'strategos'),
    'strategos_admin'
);
```

### 6. Run locally

```bash
npm run dev
```

Open http://localhost:3000, enter your email, click the magic link. You'll
land on the home screen with the client picker.

---

## Project layout

```
strategos-dashboard/
├── supabase/migrations/       # SQL for schema + seed
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── login/             # Magic-link sign-in
│   │   ├── auth/              # OAuth callback + signout
│   │   ├── api/agent-proxy/   # Server-side proxy → agent backends
│   │   ├── c/[clientSlug]/    # Client-scoped routes (per workspace)
│   │   │   └── a/[agentSlug]/ # Agent-scoped routes (per connected agent)
│   │   └── strategos/         # Agency-only admin routes
│   ├── lib/
│   │   ├── supabase/          # Browser + server + middleware clients
│   │   ├── auth/              # Session + RBAC helpers
│   │   ├── agents/            # Agent plug-in system
│   │   │   ├── registry.ts    # Master list of known agents
│   │   │   ├── jwt.ts         # Signs JWTs for agent backend calls
│   │   │   └── craig/         # Craig-specific modules + types
│   │   └── theme/
│   ├── components/
│   │   ├── ui/                # Primitives (Button, Card, Input, Badge, Label)
│   │   └── blocks/            # Composed blocks (DataTable, StatCard, Sidebar...)
│   └── types/                 # Domain types
└── docs/
    ├── adding-an-agent.md
    └── theming-a-client.md
```

---

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — multi-tenancy, auth flow,
  route guards, agent proxy, demo mode, technology picks.
- [`docs/onboarding-new-clients.md`](docs/onboarding-new-clients.md) —
  step-by-step recipe for spinning up a new Craig tenant.
- [`docs/adding-an-agent.md`](docs/adding-an-agent.md) — how to plug a
  new agent (beyond Craig) into the dashboard.
- [`docs/theming-a-client.md`](docs/theming-a-client.md) — per-client
  colors and font via the `organizations.theme` JSONB.
- [`src/lib/auth/README.md`](src/lib/auth/README.md) — session helpers,
  RBAC, middleware.

For the Craig backend (API, webhook, PDF, migrations), see the
[Craig-Pricing README](../Craig-Pricing/README.md) and
[Missive integration guide](../Craig-Pricing/docs/missive-integration.md).

## How agents plug in

Short version: a new agent is a folder under `src/lib/agents/<slug>/` + a
row in the `agents` table + one line in `registry.ts`. Full walkthrough in
[`docs/adding-an-agent.md`](docs/adding-an-agent.md).

## Per-client branding

Each row in `organizations` has a `theme` JSONB. Edit it — the client's
route tree picks up the colors and font instantly. See
[`docs/theming-a-client.md`](docs/theming-a-client.md).

---

## Roles

| Role | Sees | Can edit |
|------|------|----------|
| `strategos_admin` | All clients, all agents, all users | Everything |
| `client_owner` | Their client's data | Products, settings, members |
| `client_member` | Their client's data | Approve quotes |
| `client_viewer` | Their client's data | Nothing (read-only) |

## Deploying to Vercel

1. Push this repo to GitHub
2. Import in Vercel → Add environment variables (same keys as `.env.local`)
3. Deploy — Vercel auto-detects Next.js

Each push to `main` deploys to production. PR branches get preview URLs.

## Silent user provisioning

If you need to create accounts **without** triggering magic-link emails
(e.g. pre-provisioning a client before their launch day), use
`scripts/provision_users.ts`:

```bash
# 1. Edit the TARGETS array in scripts/provision_users.ts
# 2. Run (uses env from .env.local)
npx tsx scripts/provision_users.ts
```

Each account is created via `admin.auth.admin.createUser({ email_confirm: true })`
which pre-confirms the address so no email is dispatched. When the user
is ready to log in, they hit the login page, request a magic link, and
Supabase sends the email at that point.

## Future roadmap

- Agent editor (tone, surcharges, price sheet) — ✅ shipped (Catalog + Settings tabs)
- Analytics charts via Recharts — ✅ shipped (Overview module)
- Invitation email flow — ✅ shipped (`/strategos/users/new`)
- Silent user provisioning (no email) — ✅ shipped (`scripts/provision_users.ts`)
- Missive email channel — ✅ shipped (Connections → Missive tab)
- WhatsApp + SMTP channels — still placeholders
- Audit log UI (data is captured, no screen yet)
- White-label custom domains per client
- Self-service `/strategos/clients/new` form (today: Supabase SQL, see onboarding doc)

---

## License

Proprietary — Strategos AI.
