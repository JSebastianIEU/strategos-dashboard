import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/blocks/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot } from 'lucide-react';
import { EmptyState } from '@/components/blocks/EmptyState';
import type { Agent, AgentCapability } from '@/types/agent';
import { getAgentDefinition } from '@/lib/agents/registry';
import { isDemoMode, DEMO_CRAIG_AGENT } from '@/lib/demo';

export default async function AgentsPage() {
    let agents: Agent[] = [];
    if (isDemoMode()) {
        agents = [DEMO_CRAIG_AGENT];
    } else {
        const supabase = await createClient();
        const { data } = await supabase.from('agents').select('*').order('name');
        agents = (data ?? []) as Agent[];
    }

    return (
        <div className="max-w-5xl mx-auto">
            <PageHeader
                title="Agent Registry"
                description="Agents Strategos knows how to render. Each agent has a definition file in the dashboard codebase."
            />
            {agents.length === 0 ? (
                <EmptyState
                    icon={Bot}
                    title="No agents registered"
                    description="Register a new agent by inserting into the agents table."
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {agents.map((agent) => {
                        const def = getAgentDefinition(agent.slug);
                        const hasCode = !!def;

                        return (
                            <Card key={agent.id}>
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                                                <Bot className="h-5 w-5 text-slate-600" />
                                            </div>
                                            <div>
                                                <CardTitle>{agent.name}</CardTitle>
                                                <CardDescription className="font-mono text-xs">
                                                    {agent.slug}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        {hasCode ? (
                                            <Badge variant="success">Implemented</Badge>
                                        ) : (
                                            <Badge variant="warning">Stub</Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-slate-600 mb-3">
                                        {agent.description}
                                    </p>
                                    <div className="mb-3">
                                        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                                            Capabilities
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(agent.capabilities as AgentCapability[]).map((c) => (
                                                <Badge key={c} variant="secondary">
                                                    {c}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500 font-mono truncate">
                                        {agent.api_base_url}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
