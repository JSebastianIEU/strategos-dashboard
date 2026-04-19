import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { isStrategosAdmin } from '@/lib/auth/rbac';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { PageHeader } from '@/components/blocks/PageHeader';
import { isDemoMode, demoFindClientOrg, demoAgentConnections, DEMO_CRAIG_AGENT } from '@/lib/demo';
import type { Organization } from '@/types/organization';
import type { AgentConnectionWithAgent } from '@/types/agent';
import { ClientConfigForm } from './ClientConfigForm';

interface PageProps {
    params: Promise<{ slug: string }>;
}

export default async function ClientConfigPage({ params }: PageProps) {
    const { slug } = await params;
    const user = await getCurrentUser();
    if (!user) redirect('/login');
    if (!isStrategosAdmin(user)) notFound();

    let org: Organization | null = null;
    let connections: AgentConnectionWithAgent[] = [];

    if (isDemoMode()) {
        org = demoFindClientOrg(slug);
        connections = demoAgentConnections(slug);
    } else {
        const supabase = await createServerSupabase();
        const { data: o } = await supabase
            .from('organizations')
            .select('*')
            .eq('slug', slug)
            .eq('type', 'client')
            .maybeSingle();
        org = (o as Organization | null) ?? null;
        if (org) {
            const { data: c } = await supabase
                .from('agent_connections')
                .select('*, agent:agents(*)')
                .eq('organization_id', org.id);
            connections = (c ?? []) as AgentConnectionWithAgent[];
        }
    }

    if (!org) notFound();

    const craigEnabled = connections.some((c) => c.agent.slug === 'craig');

    return (
        <div className="max-w-2xl mx-auto">
            <PageHeader
                title={org.name}
                description={`Configuring /${org.slug}`}
            />
            <ClientConfigForm
                org={org}
                craigEnabled={craigEnabled}
                availableAgents={
                    isDemoMode()
                        ? [{ slug: DEMO_CRAIG_AGENT.slug, name: DEMO_CRAIG_AGENT.name }]
                        : connections.length
                          ? connections.map((c) => ({ slug: c.agent.slug, name: c.agent.name }))
                          : [{ slug: 'craig', name: 'Craig' }]
                }
            />
        </div>
    );
}
