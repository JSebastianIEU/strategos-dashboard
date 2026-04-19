import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import { canAccessOrg, membershipFor, isStrategosAdmin } from '@/lib/auth/rbac';
import { getAgentDefinition } from '@/lib/agents/registry';
import { AgentModuleRunner } from './AgentModuleRunner';
import type { Organization } from '@/types/organization';
import type { Agent } from '@/types/agent';
import { isDemoMode, DEMO_CRAIG_AGENT, DEMO_JUST_PRINT_ORG } from '@/lib/demo';

interface PageProps {
    params: Promise<{
        clientSlug: string;
        agentSlug: string;
        section: string;
    }>;
}

export default async function AgentSectionPage({ params }: PageProps) {
    const { clientSlug, agentSlug, section } = await params;
    const user = await getCurrentUser();
    if (!user) redirect('/login');
    if (!canAccessOrg(user, clientSlug)) notFound();

    let orgId = '';
    let agentApiBaseUrl = '';

    if (isDemoMode()) {
        if (clientSlug !== 'just-print' || agentSlug !== 'craig') notFound();
        orgId = DEMO_JUST_PRINT_ORG.id;
        agentApiBaseUrl = DEMO_CRAIG_AGENT.api_base_url;
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

        orgId = (org as Organization).id;
        agentApiBaseUrl = (agent as Agent).api_base_url;
    }

    const definition = getAgentDefinition(agentSlug);
    if (!definition) notFound();

    const module_ = definition.modules.find((m) => m.route === section);
    if (!module_) notFound();

    if (module_.minRole && !isStrategosAdmin(user)) {
        const m = membershipFor(user, clientSlug);
        if (!m) notFound();
        const rank = { client_viewer: 1, client_member: 2, client_owner: 3, strategos_admin: 4 };
        if (rank[m.role] < rank[module_.minRole]) {
            notFound();
        }
    }

    const membership = membershipFor(user, clientSlug);
    const role = membership?.role ?? (isStrategosAdmin(user) ? 'strategos_admin' : 'client_viewer');

    return (
        <AgentModuleRunner
            clientSlug={clientSlug}
            agentSlug={agentSlug}
            section={section}
            userEmail={user.email}
            userRole={role}
            organizationId={orgId}
            agentApiBaseUrl={agentApiBaseUrl}
        />
    );
}
