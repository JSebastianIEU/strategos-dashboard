# Onboarding a new client

End-to-end recipe for spinning up a second (or Nth) Craig tenant on the
platform. Goes from "blank Supabase row" to "working widget on the
client's website" in maybe 20 minutes.

Most of the work is per-client configuration — products, tax rates,
surcharges, widget branding — and is done via the dashboard UI once the
foundational rows exist.

## Step 1 — Create the client organization

Supabase SQL editor:

```sql
insert into public.organizations (slug, name, type, parent_id, theme)
values (
    'acme-print',
    'Acme Print',
    'client',
    (select id from public.organizations where slug = 'strategos'),
    '{"primary_color": "#c0392b", "font": "Inter"}'::jsonb
);
```

`slug` is the URL identifier (lowercase, hyphen-separated, used in
`/c/<slug>/` routes and on every Craig DB row). `theme` drives the
client workspace's CSS custom properties.

## Step 2 — Connect Craig to the client

```sql
insert into public.agent_connections (organization_id, agent_id, config, enabled_capabilities)
values (
    (select id from public.organizations where slug = 'acme-print'),
    (select id from public.agents where slug = 'craig'),
    '{}'::jsonb,
    '["overview","quotes","conversations","connections","catalog","settings"]'::jsonb
);
```

`enabled_capabilities` controls which Craig modules show up in the new
client's sidebar. Trim it if the client doesn't need (say) the Missive
connection.

## Step 3 — Seed Craig's tenant rows

Craig's backend stores every catalog row, setting, quote, and
conversation scoped by `organization_slug`. New tenants need initial
pricing + settings. Three options:

### 3a. Dashboard UI (recommended for small catalogs)

Log in as a Strategos admin, hit
`/c/acme-print/a/craig/catalog`, and add products / tiers / surcharges
manually via the form UI.

### 3b. Seeded from JSON (recommended for migrating an existing sheet)

In the Craig repo, drop the client's pricing into
`data/<client>_small_format.json` etc., then write a per-client
migration script (modelled on `scripts/migrate_json_to_db.py`) that
inserts everything with the new `organization_slug`.

### 3c. SQL copy from a known-good tenant

```sql
-- Run against Craig's Cloud SQL DB (NOT Supabase).
insert into products (organization_slug, key, name, category, ...)
select 'acme-print', key, name, category, ...
from products where organization_slug = 'just-print';
-- Similarly for price_tiers, surcharge_rules, settings.
```

Then edit prices via the dashboard to match the new client's sheet.

## Step 4 — Seed tenant settings

Craig looks up these per-tenant settings on every turn:

| Key | Purpose | Set via |
|---|---|---|
| `system_prompt` | The client's Craig personality | Dashboard → Settings |
| `business_rules` | Override rules (JSON array of strings) | Dashboard → Settings → Business rules |
| `widget_primary_color`, `widget_logo_url`, `widget_greeting`, `widget_font`, `widget_accents`, `widget_stripe_mode` | Widget branding | Dashboard → Connections → Widget |
| `artwork_rate_eur`, `standard_turnaround`, `vat_rate` | Pricing engine defaults | Dashboard → Settings |
| `missive_enabled`, `missive_api_token`, `missive_webhook_secret`, `missive_from_address`, `missive_from_name` | Missive integration (optional) | Dashboard → Connections → Missive |

V4–V9 migrations auto-seed reasonable defaults for every tenant with a
`system_prompt` row, so if you create the system_prompt row first (via
the dashboard Settings tab) the rest of the defaults will be materialized
on Craig's next boot.

## Step 5 — Invite the client's users

If you're okay with magic-link emails going out right now, use the UI:
`/strategos/users/new` → enter the user's email + pick their workspace
+ role. The dashboard calls
`admin.auth.admin.inviteUserByEmail()` which dispatches the email.

If you want accounts created silently (no emails), run:

```bash
# 1. Edit strategos-dashboard/scripts/provision_users.ts — add the
#    client's users to TARGETS.
# 2. Run
cd strategos-dashboard
npx tsx scripts/provision_users.ts
```

Accounts sit dormant with `email_confirmed_at` set until the user clicks
"Magic link" on the login page.

## Step 6 — Give the client their widget snippet

Dashboard → Connections → Widget tab shows the embed snippet
pre-filled with the client's slug:

```html
<script src="https://craig-pricing-277215252762.europe-west1.run.app/widget.js"
        data-client="acme-print" defer></script>
```

Paste it just before `</body>` on the client's website. WordPress: use
the Header Footer Code Manager plugin or add it via Elementor's Custom
HTML widget.

## Step 7 — (If using Missive) wire up the inbox

Follow [Craig's `docs/missive-integration.md`](../../Craig-Pricing/docs/missive-integration.md).
Summary:

1. Paste the Missive API token into the dashboard's Missive tab.
2. Copy the webhook URL + auto-generated secret shown in Step 2 of the tab.
3. In Missive: Settings → Rules → New rule. Trigger: incoming email to
   the watched inbox. Action: Webhook with the URL + secret from step 2.
4. Flip the "Enabled" toggle in the dashboard.
5. Send a test email — within 15 seconds a draft reply with the quote
   PDF attached should appear in the Missive thread, and a new row
   should appear in the dashboard's Conversations tab with
   `channel=missive`.

## Verification checklist

- [ ] `/c/<new-slug>` resolves without 404 when logged in as a Strategos admin.
- [ ] Sidebar shows all six Craig modules (Overview, Quotes, Conversations, Connections, Catalog, Settings).
- [ ] Catalog tab lists at least one product.
- [ ] Settings tab shows a non-empty `system_prompt` textarea.
- [ ] Widget tab shows the tenant slug in the embed snippet.
- [ ] Sending a test message through the widget produces a reply + saved Conversation row.
- [ ] (If Missive configured) a test email produces a draft in Missive + a Conversation row with channel=missive.
