import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { canAccessOrg } from '@/lib/auth/rbac';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/blocks/Sidebar';
import { ClientThemeProvider } from '@/components/blocks/ClientThemeProvider';
import { DemoBanner } from '@/components/blocks/DemoBanner';
import type { Organization } from '@/types/organization';
import type { AgentConnectionWithAgent } from '@/types/agent';
import {
    isDemoMode,
    demoAgentConnections,
    DEMO_JUST_PRINT_ORG,
    DEMO_MOLLY_CLIENT,
} from '@/lib/demo';

interface ClientLayoutProps {
    params: Promise<{ clientSlug: string }>;
    children: React.ReactNode;
}

export default async function ClientLayout({ params, children }: ClientLayoutProps) {
    const { clientSlug } = await params;

    const user = await getCurrentUser();
    if (!user) redirect('/login');

    let org: Organization | null = null;
    let clientAgents: AgentConnectionWithAgent[] = [];

    if (isDemoMode()) {
        if (clientSlug === 'just-print') org = DEMO_JUST_PRINT_ORG;
        else if (clientSlug === 'acme-inbox') org = DEMO_MOLLY_CLIENT;
        clientAgents = demoAgentConnections(clientSlug);
    } else {
        const supabase = await createClient();
        const { data } = await supabase
            .from('organizations')
            .select('*')
            .eq('slug', clientSlug)
            .eq('type', 'client')
            .maybeSingle();
        org = (data as Organization | null) ?? null;

        if (org) {
            const { data: connections } = await supabase
                .from('agent_connections')
                .select('*, agent:agents(*)')
                .eq('organization_id', org.id);
            clientAgents = (connections ?? []) as AgentConnectionWithAgent[];
        }
    }

    // Server-side org access guard — the main layer that keeps one client
    // from seeing another's data by URL-hacking. `notFound()` is used
    // deliberately instead of a 403 so the app doesn't leak that a given
    // slug even exists. `canAccessOrg` allows Strategos admins through
    // (they can inspect any client) and otherwise requires an explicit
    // membership on this org.
    //
    // This is layer 2 of 5 (middleware session refresh → this guard →
    // agent-proxy API check → server-action assertStrategosAdmin →
    // Supabase RLS). See src/lib/auth/README.md for the full defense
    // -in-depth picture.
    if (!org) notFound();
    if (!canAccessOrg(user, clientSlug)) notFound();

    return (
        <ClientThemeProvider theme={org.theme}>
            <div className="flex h-screen flex-col">
                <DemoBanner />
                <div className="flex flex-1 overflow-hidden">
                    <Sidebar
                        user={user}
                        clientOrg={{
                            slug: org.slug,
                            name: org.name,
                            logo_url: org.theme.logo_url,
                        }}
                        clientAgents={clientAgents}
                    />
                    <main className="flex-1 overflow-y-auto p-8">{children}</main>
                </div>
            </div>
        </ClientThemeProvider>
    );
}
