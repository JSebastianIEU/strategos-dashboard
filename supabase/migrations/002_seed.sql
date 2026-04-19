-- ============================================================================
-- Seed: Strategos AI agency + Just Print client + Craig agent
-- Safe to re-run (uses ON CONFLICT DO NOTHING / UPDATE where appropriate).
-- ============================================================================

-- Strategos AI (agency)
insert into public.organizations (slug, name, type, theme)
values ('strategos', 'Strategos AI', 'agency',
    jsonb_build_object(
        'primary_color', '#6366f1',
        'logo_url', null,
        'font', 'Inter'
    ))
on conflict (slug) do nothing;

-- Just Print (client, managed by Strategos)
insert into public.organizations (slug, name, type, parent_id, theme)
select 'just-print', 'Just Print', 'client',
       (select id from public.organizations where slug = 'strategos'),
       jsonb_build_object(
           'primary_color', '#040f2a',
           'accent_colors', jsonb_build_array('#e30686', '#feea03', '#3e8fcd', '#c4cf00'),
           'logo_url', 'https://just-print.ie/wp-content/themes/just-print/assets/img/tiger_760.png',
           'font', 'Poppins'
       )
on conflict (slug) do nothing;

-- Register Craig (V2 modules: overview, quotes, conversations, catalog, settings)
insert into public.agents (slug, name, description, api_base_url, capabilities)
values (
    'craig',
    'Craig',
    'AI quoting agent — generic pricing engine + customer-facing chat for any business.',
    'https://craig-pricing-277215252762.europe-west1.run.app',
    '["overview","quotes","conversations","connections","catalog","settings"]'::jsonb
)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    api_base_url = excluded.api_base_url,
    capabilities = excluded.capabilities,
    updated_at = now();

-- Connect Craig to Just Print
insert into public.agent_connections (organization_id, agent_id, enabled_capabilities)
select
    (select id from public.organizations where slug = 'just-print'),
    (select id from public.agents where slug = 'craig'),
    '["overview","quotes","conversations","connections","catalog","settings"]'::jsonb
on conflict (organization_id, agent_id) do update
set enabled_capabilities = excluded.enabled_capabilities,
    updated_at = now();
