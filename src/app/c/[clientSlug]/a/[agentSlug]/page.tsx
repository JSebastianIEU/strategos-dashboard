import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAgentDefinition } from '@/lib/agents/registry';
import type { AgentConnection } from '@/types/agent';
import type { Organization } from '@/types/organization';
import { isDemoMode, demoAgentConnections, DEMO_JUST_PRINT_ORG } from '@/lib/demo';

interface PageProps {
    params: Promise<{ clientSlug: string; agentSlug: string }>;
}

export default async function AgentLandingPage({ params }: PageProps) {
    const { clientSlug, agentSlug } = await params;

    let enabled: string[] = [];

    if (isDemoMode()) {
        if (clientSlug !== 'just-print') notFound();
        const conns = demoAgentConnections(clientSlug);
        const c = conns.find((x) => x.agent.slug === agentSlug);
        if (!c) notFound();
        enabled = c.enabled_capabilities;
    } else {
        const supabase = await createClient();
        const { data: org } = await supabase
            .from('organizations')
            .select('*')
            .eq('slug', clientSlug)
            .maybeSingle();
        if (!org) notFound();

        const { data: agent } = await supabase
            .from('agents')
            .select('*')
            .eq('slug', agentSlug)
            .maybeSingle();
        if (!agent) notFound();

        const { data: connection } = await supabase
            .from('agent_connections')
            .select('*')
            .eq('organization_id', (org as Organization).id)
            .eq('agent_id', (agent as { id: string }).id)
            .maybeSingle();
        if (!connection) notFound();
        enabled = (connection as AgentConnection).enabled_capabilities;
    }

    const def = getAgentDefinition(agentSlug);
    if (!def) notFound();

    const firstModule = def.modules.find((m) => enabled.includes(m.route));
    if (!firstModule) notFound();

    redirect(`/c/${clientSlug}/a/${agentSlug}/${firstModule.route}`);
}
