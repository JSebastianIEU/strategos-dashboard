# Adding a new agent

This guide walks through plugging a brand-new agent into the Strategos
Dashboard. At the end you'll have:

- A new folder under `src/lib/agents/<slug>/`
- One or more **modules** that show up in the sidebar for any client that
  has the agent connected
- A row in the `agents` table in Supabase so clients can enable it

Example we'll use: **Molly** — an inbox triage agent. Replace "molly" with
your agent's slug throughout.

---

## 1. Pick a slug + plan capabilities

The **slug** is the unique identifier for the agent across the whole system.
Lowercase, hyphenated, stable: `molly`, `pixel`, `inbox-triage`, etc.

**Capabilities** are the features the agent exposes to dashboard users. They
drive the sidebar nav and URL structure. Common examples:

- `triage` — queue of incoming emails / messages
- `rules` — editable routing rules
- `analytics` — usage stats
- `settings` — tunable knobs

Capability names become URL segments: `/c/:client/a/molly/triage`.

---

## 2. Build the agent backend (separate repo)

The Strategos Dashboard is a *control plane* — the real work happens in
each agent's backend. Your agent needs to:

1. **Expose a JWT-protected admin API** at e.g. `https://molly.example.com/admin/api/*`
2. **Verify the Strategos JWT** using the shared `STRATEGOS_JWT_SECRET`. The
   JWT carries claims `{ email, org_slug, role }`.
3. **Scope all data by `org_slug`** — never return another client's data.

See Craig's implementation for reference:

- `Craig-Pricing/auth/jwt_auth.py` — JWT verification
- `Craig-Pricing/admin_api.py` — endpoint shape

Recommended endpoints per capability:

```
GET    /admin/api/orgs/:slug/<capability>             → list
GET    /admin/api/orgs/:slug/<capability>/:id         → detail
PATCH  /admin/api/orgs/:slug/<capability>/:id         → update
```

---

## 3. Register the agent in Supabase

Run this once:

```sql
insert into public.agents (slug, name, description, api_base_url, capabilities)
values (
    'molly',
    'Molly — Inbox Triage',
    'Auto-sorts incoming customer emails into categories and drafts replies.',
    'https://molly-prod-xxxxxx.run.app',
    '["triage","rules","analytics","settings"]'::jsonb
);
```

Then connect it to a client:

```sql
insert into public.agent_connections (organization_id, agent_id, enabled_capabilities)
values (
    (select id from public.organizations where slug = 'just-print'),
    (select id from public.agents where slug = 'molly'),
    '["triage","settings"]'::jsonb   -- partial enablement is fine
);
```

---

## 4. Create the agent folder

```
src/lib/agents/molly/
├── definition.ts
├── api.ts               ← TypeScript types for the agent's responses
└── modules/
    ├── TriageModule.tsx
    ├── RulesModule.tsx
    ├── AnalyticsModule.tsx
    └── SettingsModule.tsx
```

### `api.ts`

Define the response shapes your agent returns. Copy Craig's `api.ts`
as a starting template.

### `modules/TriageModule.tsx`

```tsx
'use client';
import { useEffect, useState } from 'react';
import type { AgentModuleProps } from '@/types/agent';
import { PageHeader } from '@/components/blocks/PageHeader';
import { DataTable } from '@/components/blocks/DataTable';

interface TriageItem { id: string; subject: string; category: string }

export function TriageModule({ organizationSlug, apiFetch }: AgentModuleProps) {
    const [items, setItems] = useState<TriageItem[] | null>(null);

    useEffect(() => {
        apiFetch<{ items: TriageItem[] }>(
            `/admin/api/orgs/${organizationSlug}/triage`,
        ).then((d) => setItems(d.items));
    }, [organizationSlug, apiFetch]);

    return (
        <div>
            <PageHeader
                title="Inbox Triage"
                description="Emails Molly has categorized and is waiting to route."
            />
            {items ? (
                <DataTable
                    columns={[
                        { header: 'Subject', accessorKey: 'subject' },
                        { header: 'Category', accessorKey: 'category' },
                    ]}
                    data={items}
                    emptyTitle="Inbox empty"
                    emptyDescription="Nothing to triage right now."
                />
            ) : (
                <div>Loading…</div>
            )}
        </div>
    );
}
```

The `apiFetch` function handed in by the runner:

- Automatically attaches a signed JWT
- Routes through `/api/agent-proxy` on the dashboard
- Throws on non-2xx responses
- Returns parsed JSON

You do **not** need to worry about auth, secrets, or CORS in module code.

### `definition.ts`

```ts
import { Inbox, List, BarChart, Settings } from 'lucide-react';
import type { AgentDefinition } from '@/types/agent';
import { TriageModule } from './modules/TriageModule';
import { RulesModule } from './modules/RulesModule';
import { AnalyticsModule } from './modules/AnalyticsModule';
import { SettingsModule } from './modules/SettingsModule';

export const mollyDefinition: AgentDefinition = {
    slug: 'molly',
    name: 'Molly',
    description: 'Inbox triage — categorizes and routes customer emails.',
    capabilities: ['triage', 'rules', 'analytics', 'settings'],
    modules: [
        {
            title: 'Triage',
            icon: Inbox,
            route: 'triage',
            Component: TriageModule,
            minRole: 'client_viewer',
        },
        {
            title: 'Rules',
            icon: List,
            route: 'rules',
            Component: RulesModule,
            minRole: 'client_member',
        },
        {
            title: 'Analytics',
            icon: BarChart,
            route: 'analytics',
            Component: AnalyticsModule,
            minRole: 'client_viewer',
        },
        {
            title: 'Settings',
            icon: Settings,
            route: 'settings',
            Component: SettingsModule,
            minRole: 'client_owner',
        },
    ],
};
```

---

## 5. Register in the frontend registry

`src/lib/agents/registry.ts`:

```ts
import { craigDefinition } from './craig/definition';
import { mollyDefinition } from './molly/definition';

export const AGENT_REGISTRY: Record<string, AgentDefinition> = {
    craig: craigDefinition,
    molly: mollyDefinition,  // ← one line
};
```

That's it. The dashboard will:

- Show "Molly" in the sidebar for any client with a matching `agent_connection`
- Route to `/c/:client/a/molly/:section`
- Enforce the `minRole` you set on each module

---

## 6. Test

Local dev: sign in as a client_owner, enter the client's workspace, and the
new agent should appear in the sidebar. Click through each module — requests
go through the proxy, your agent backend returns data, the module renders it.

If an agent row exists in Supabase but there's no corresponding definition
in the frontend registry, `/strategos/agents` shows it with a **Stub** badge
so you know what's dangling.

---

## Conventions

- One module = one capability = one URL segment
- Module `Component` is always a client component (`'use client'`)
- Module calls go through `apiFetch` — never `fetch` directly
- Use the generic blocks (`DataTable`, `StatCard`, `PageHeader`, `EmptyState`)
  unless you have a strong reason. Consistency beats cleverness.
- Role hierarchy: `client_viewer < client_member < client_owner < strategos_admin`
- Minimum supported role per module via `minRole` — enforced on both server
  (page guard) and UI (sidebar hides items the user can't access)
