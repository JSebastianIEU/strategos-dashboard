/**
 * Demo mode — auto-activates when Supabase credentials are placeholders.
 * Lets you navigate the entire dashboard with mock data.
 *
 * Mocks live in `src/lib/demo-store.ts` (mutable in-memory CRUD).
 */

import type { AppUser } from '@/types/user';
import type { MembershipWithOrg, Organization } from '@/types/organization';
import type { AgentConnectionWithAgent, Agent } from '@/types/agent';
import { demoStore, type DemoClientRecord } from './demo-store';

export function isDemoMode(): boolean {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    return (
        !url ||
        !key ||
        url.includes('placeholder') ||
        key.includes('placeholder')
    );
}

// ---------------------------------------------------------------------------
// Static entities
// ---------------------------------------------------------------------------

export const DEMO_STRATEGOS_ORG: Organization = {
    id: 'demo-strategos-id',
    slug: 'strategos',
    name: 'Strategos AI',
    type: 'agency',
    parent_id: null,
    theme: { primary_color: '#6366f1', font: 'Inter' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
};

export const DEMO_CRAIG_AGENT: Agent = {
    id: 'demo-craig-id',
    slug: 'craig',
    name: 'Craig',
    description:
        'AI quoting agent for any business — natural conversation + accurate, configurable pricing.',
    api_base_url: 'https://craig-pricing-277215252762.europe-west1.run.app',
    capabilities: ['overview', 'quotes', 'conversations', 'connections', 'catalog', 'settings'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Dynamic client list (read from the mutable store)
// ---------------------------------------------------------------------------

function clientToOrg(c: DemoClientRecord): Organization {
    return {
        id: `demo-${c.slug}-id`,
        slug: c.slug,
        name: c.name,
        type: 'client',
        parent_id: DEMO_STRATEGOS_ORG.id,
        theme: c.theme,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}

export function demoListClientOrgs(): Organization[] {
    return demoStore.listDemoClients().map(clientToOrg);
}

export function demoFindClientOrg(slug: string): Organization | null {
    const c = demoStore.getDemoClient(slug);
    return c ? clientToOrg(c) : null;
}

// Backwards-compatible exports
export const DEMO_JUST_PRINT_ORG: Organization =
    demoFindClientOrg('just-print') ?? clientToOrg(demoStore.listDemoClients()[0]);
export const DEMO_MOLLY_CLIENT: Organization =
    demoFindClientOrg('acme-inbox') ?? clientToOrg(demoStore.listDemoClients()[0]);

// ---------------------------------------------------------------------------
// User / memberships
// ---------------------------------------------------------------------------

export function demoUser(): AppUser {
    const strategosMembership: MembershipWithOrg = {
        id: 'demo-ms-strategos',
        user_id: 'demo-user-id',
        organization_id: DEMO_STRATEGOS_ORG.id,
        role: 'strategos_admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        organization: DEMO_STRATEGOS_ORG,
    };

    const clientMemberships: MembershipWithOrg[] = demoListClientOrgs().map((org) => ({
        id: `demo-ms-${org.slug}`,
        user_id: 'demo-user-id',
        organization_id: org.id,
        role: 'client_owner',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        organization: org,
    }));

    return {
        id: 'demo-user-id',
        email: 'demo@strategosai.example',
        display_name: 'Demo Admin',
        avatar_url: null,
        memberships: [strategosMembership, ...clientMemberships],
    };
}

// ---------------------------------------------------------------------------
// Agent connections per client (only shows Craig if enable_craig on that client)
// ---------------------------------------------------------------------------

export function demoAgentConnections(clientSlug: string): AgentConnectionWithAgent[] {
    const c = demoStore.getDemoClient(clientSlug);
    if (!c || !c.enable_craig) return [];
    return [
        {
            id: `demo-conn-${clientSlug}-craig`,
            organization_id: clientToOrg(c).id,
            agent_id: DEMO_CRAIG_AGENT.id,
            config: {},
            enabled_capabilities: DEMO_CRAIG_AGENT.capabilities,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            agent: DEMO_CRAIG_AGENT,
        },
    ];
}

// ---------------------------------------------------------------------------
// Craig admin API mock
// ---------------------------------------------------------------------------

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export function demoCraigResponse(
    path: string,
    method: Method = 'GET',
    body: unknown = null,
): unknown {
    return demoStore.handle(path, method, body);
}
