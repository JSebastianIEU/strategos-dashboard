'use client';
/**
 * Renders the appropriate AgentModule.Component and hands it
 * a ready-to-use apiFetch function that proxies through /api/agent-proxy
 * (which signs + forwards requests to the agent's backend).
 */
import { useMemo } from 'react';
import { getAgentDefinition } from '@/lib/agents/registry';
import { notFound } from 'next/navigation';

interface Props {
    clientSlug: string;
    agentSlug: string;
    section: string;
    userEmail: string;
    userRole: string;
    organizationId: string;
    agentApiBaseUrl: string;
}

export function AgentModuleRunner(props: Props) {
    const def = getAgentDefinition(props.agentSlug);
    const module_ = def?.modules.find((m) => m.route === props.section);
    if (!def || !module_) return notFound();

    const Component = module_.Component;

    // Build the apiFetch helper. Routes through our own Next.js API route
    // which holds STRATEGOS_JWT_SECRET and signs the JWT server-side.
    const apiFetch = useMemo(
        () =>
            async function apiFetch<T = unknown>(
                path: string,
                init?: RequestInit,
            ): Promise<T> {
                const res = await fetch('/api/agent-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agentSlug: props.agentSlug,
                        clientSlug: props.clientSlug,
                        path,
                        method: init?.method ?? 'GET',
                        body: init?.body,
                        headers: init?.headers,
                    }),
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`${res.status} ${res.statusText}: ${text}`);
                }
                return res.json();
            },
        [props.agentSlug, props.clientSlug],
    );

    return (
        <Component
            organizationId={props.organizationId}
            organizationSlug={props.clientSlug}
            agentApiBaseUrl={props.agentApiBaseUrl}
            apiFetch={apiFetch}
        />
    );
}
