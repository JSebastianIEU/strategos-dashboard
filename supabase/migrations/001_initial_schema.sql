-- ============================================================================
-- Strategos AI Dashboard — initial schema
-- Run this in Supabase SQL Editor (or via supabase CLI) once.
-- ============================================================================

-- Enable UUID generation (built into Supabase)
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Organizations
-- Agency = Strategos AI itself. Clients = print shops, etc.
-- ----------------------------------------------------------------------------
create table public.organizations (
    id            uuid primary key default gen_random_uuid(),
    slug          text unique not null,
    name          text not null,
    type          text not null check (type in ('agency', 'client')),
    parent_id     uuid references public.organizations(id) on delete set null,
    theme         jsonb not null default '{}'::jsonb,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index organizations_parent_idx on public.organizations(parent_id);
create index organizations_type_idx on public.organizations(type);

-- ----------------------------------------------------------------------------
-- Users (mirror of auth.users for FK convenience + extra columns)
-- Kept in sync via trigger below.
-- ----------------------------------------------------------------------------
create table public.users (
    id            uuid primary key references auth.users(id) on delete cascade,
    email         text unique not null,
    display_name  text,
    avatar_url    text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- Auto-create public.users row when a Supabase auth user signs up
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into public.users (id, email, display_name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email))
    on conflict (id) do nothing;
    return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- Memberships: one user can belong to multiple orgs with different roles
-- ----------------------------------------------------------------------------
create table public.memberships (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null references public.users(id) on delete cascade,
    organization_id  uuid not null references public.organizations(id) on delete cascade,
    role             text not null check (role in ('strategos_admin', 'client_owner', 'client_member', 'client_viewer')),
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    unique (user_id, organization_id)
);

create index memberships_user_idx on public.memberships(user_id);
create index memberships_org_idx on public.memberships(organization_id);

-- ----------------------------------------------------------------------------
-- Agent registry: the types of agents Strategos supports
-- ----------------------------------------------------------------------------
create table public.agents (
    id             uuid primary key default gen_random_uuid(),
    slug           text unique not null,
    name           text not null,
    description    text,
    api_base_url   text not null,
    capabilities   jsonb not null default '[]'::jsonb,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Agent connections: which agents are enabled for which client
-- ----------------------------------------------------------------------------
create table public.agent_connections (
    id                     uuid primary key default gen_random_uuid(),
    organization_id        uuid not null references public.organizations(id) on delete cascade,
    agent_id               uuid not null references public.agents(id) on delete cascade,
    config                 jsonb not null default '{}'::jsonb,
    enabled_capabilities   jsonb not null default '[]'::jsonb,
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now(),
    unique (organization_id, agent_id)
);

create index agent_connections_org_idx on public.agent_connections(organization_id);

-- ----------------------------------------------------------------------------
-- Audit events (append-only)
-- ----------------------------------------------------------------------------
create table public.audit_events (
    id               bigint primary key generated always as identity,
    user_id          uuid references public.users(id) on delete set null,
    organization_id  uuid references public.organizations(id) on delete set null,
    action           text not null,
    entity_type      text,
    entity_id        text,
    metadata         jsonb not null default '{}'::jsonb,
    created_at       timestamptz not null default now()
);

create index audit_events_org_idx on public.audit_events(organization_id);
create index audit_events_user_idx on public.audit_events(user_id);
create index audit_events_created_idx on public.audit_events(created_at desc);

-- ----------------------------------------------------------------------------
-- Helper function: is the current auth user a strategos_admin?
-- ----------------------------------------------------------------------------
create or replace function public.is_strategos_admin()
returns boolean language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from public.memberships m
        join public.organizations o on o.id = m.organization_id
        where m.user_id = auth.uid()
          and o.type = 'agency'
          and m.role = 'strategos_admin'
    );
$$;

-- Helper: is the current user a member of the given org (by slug)?
create or replace function public.is_member_of(org_slug text)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from public.memberships m
        join public.organizations o on o.id = m.organization_id
        where m.user_id = auth.uid() and o.slug = org_slug
    );
$$;

-- ----------------------------------------------------------------------------
-- Row-Level Security
-- ----------------------------------------------------------------------------
alter table public.organizations      enable row level security;
alter table public.users              enable row level security;
alter table public.memberships        enable row level security;
alter table public.agents             enable row level security;
alter table public.agent_connections  enable row level security;
alter table public.audit_events       enable row level security;

-- Users can always see their own row
create policy users_self_read on public.users
    for select using (id = auth.uid());

create policy users_strategos_read on public.users
    for select using (public.is_strategos_admin());

-- Organizations: strategos admins see all, members see their own
create policy orgs_strategos_all on public.organizations
    for all using (public.is_strategos_admin());

create policy orgs_member_read on public.organizations
    for select using (
        exists (select 1 from public.memberships m
                where m.user_id = auth.uid() and m.organization_id = public.organizations.id)
    );

-- Memberships: users see their own. Strategos admins see all.
create policy memberships_self_read on public.memberships
    for select using (user_id = auth.uid());

create policy memberships_strategos_all on public.memberships
    for all using (public.is_strategos_admin());

-- Agents: everyone authenticated can read (it's a catalog)
create policy agents_read_all on public.agents
    for select using (auth.uid() is not null);

create policy agents_strategos_write on public.agents
    for all using (public.is_strategos_admin());

-- Agent connections: members of the org see theirs; strategos sees all
create policy agent_connections_member_read on public.agent_connections
    for select using (
        exists (select 1 from public.memberships m
                where m.user_id = auth.uid()
                  and m.organization_id = public.agent_connections.organization_id)
    );

create policy agent_connections_strategos_all on public.agent_connections
    for all using (public.is_strategos_admin());

-- Audit: members see their org's events; strategos sees all
create policy audit_member_read on public.audit_events
    for select using (
        organization_id is null
        or exists (select 1 from public.memberships m
                   where m.user_id = auth.uid()
                     and m.organization_id = public.audit_events.organization_id)
    );

create policy audit_strategos_all on public.audit_events
    for all using (public.is_strategos_admin());

-- Inserts allowed from authenticated users (server-side writes via service role bypass anyway)
create policy audit_insert on public.audit_events
    for insert with check (auth.uid() is not null);
