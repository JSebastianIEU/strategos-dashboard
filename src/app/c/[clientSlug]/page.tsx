import { PageHeader } from '@/components/blocks/PageHeader';
import { StatCard } from '@/components/blocks/StatCard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Bot, FileText, MessageSquare, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAgentDefinition } from '@/lib/agents/registry';
import Link from 'next/link';
import type { AgentConnectionWithAgent } from '@/types/agent';
import type { Organization } from '@/types/organization';
import { isDemoMode, demoAgentConnections, DEMO_JUST_PRINT_ORG, DEMO_MOLLY_CLIENT } from '@/lib/demo';

interface PageProps {
    params: Promise<{ clientSlug: string }>;
}

export default async function ClientOverviewPage({ params }: PageProps) {
    const { clientSlug } = await params;

    let org: Organization | null = null;
    let agents: AgentConnectionWithAgent[] = [];

    if (isDemoMode()) {
        org = clientSlug === 'just-print' ? DEMO_JUST_PRINT_ORG : clientSlug === 'acme-inbox' ? DEMO_MOLLY_CLIENT : null;
        agents = demoAgentConnections(clientSlug);
    } else {
        const supabase = await createClient();
        const { data: o } = await supabase
            .from('organizations')
            .select('*')
            .eq('slug', clientSlug)
            .maybeSingle();
        org = (o as Organization | null) ?? null;
        if (org) {
            const { data: connections } = await supabase
                .from('agent_connections')
                .select('*, agent:agents(*)')
                .eq('organization_id', org.id);
            agents = (connections ?? []) as AgentConnectionWithAgent[];
        }
    }

    return (
        <div className="max-w-6xl mx-auto">
            <PageHeader
                title={org?.name ?? 'Client'}
                description="Overview of all agents, quotes, and activity for this workspace."
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <StatCard label="Active agents" value={agents.length} icon={Bot} />
                <StatCard label="Pending quotes" value={isDemoMode() ? 2 : '—'} icon={FileText} hint={isDemoMode() ? 'Waiting for your review' : 'Loads per agent'} />
                <StatCard label="Open conversations" value={isDemoMode() ? 2 : '—'} icon={MessageSquare} hint={isDemoMode() ? 'Recent customer chats' : 'Loads per agent'} />
            </div>

            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Agents
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map((conn) => {
                    const def = getAgentDefinition(conn.agent.slug);
                    const firstEnabled = def?.modules.find((m) =>
                        conn.enabled_capabilities.includes(m.route),
                    );
                    const href =
                        firstEnabled &&
                        `/c/${clientSlug}/a/${conn.agent.slug}/${firstEnabled.route}`;

                    return (
                        <Card key={conn.id}>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                                        <Bot className="h-5 w-5 text-slate-600" />
                                    </div>
                                    <div>
                                        <CardTitle>{conn.agent.name}</CardTitle>
                                        <CardDescription>
                                            {conn.agent.description}
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-3 flex flex-wrap gap-2 text-xs">
                                    {conn.enabled_capabilities.map((c) => (
                                        <span
                                            key={c}
                                            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700"
                                        >
                                            {c}
                                        </span>
                                    ))}
                                </div>
                                {href && (
                                    <Link
                                        href={href}
                                        className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary,#0d0d2b)] hover:underline"
                                    >
                                        Open {firstEnabled?.title ?? 'agent'}
                                        <ArrowRight className="h-3 w-3" />
                                    </Link>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
