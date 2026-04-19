/**
 * Agent types. Each registered agent (e.g. Craig) exposes a set of capabilities,
 * and the dashboard renders a corresponding Module for each capability.
 */

import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';

/** Canonical capability names. Agents may declare custom ones too. */
export type AgentCapability =
    | 'quotes'
    | 'conversations'
    | 'products'
    | 'settings'
    | (string & {});

/** Row from the `public.agents` table. */
export interface Agent {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    api_base_url: string;
    capabilities: AgentCapability[];
    created_at: string;
    updated_at: string;
}

/** Row from `public.agent_connections` — agent X connected to client Y. */
export interface AgentConnection {
    id: string;
    organization_id: string;
    agent_id: string;
    config: Record<string, unknown>;
    enabled_capabilities: AgentCapability[];
    created_at: string;
    updated_at: string;
}

/** Joined agent + connection, used by the sidebar + module loader. */
export interface AgentConnectionWithAgent extends AgentConnection {
    agent: Agent;
}

// ---------------------------------------------------------------------------
// Front-end plug-in types
// ---------------------------------------------------------------------------

/** Props every agent module receives at render time. */
export interface AgentModuleProps {
    organizationId: string;
    organizationSlug: string;
    agentApiBaseUrl: string;
    /**
     * Ready-to-use fetch helper. Attaches a short-lived Strategos-signed JWT
     * and deserializes the JSON response. Throws on non-2xx.
     */
    apiFetch: <T = unknown>(
        path: string,
        init?: RequestInit,
    ) => Promise<T>;
}

export interface AgentModule {
    /** Human-readable title shown in nav + page headers. */
    title: string;
    /** Short blurb under the title. */
    description?: string;
    icon: LucideIcon;
    /** URL segment — e.g. "quotes" → /c/:org/a/:agent/quotes */
    route: AgentCapability;
    Component: ComponentType<AgentModuleProps>;
    /** Minimum role required to access this module. */
    minRole?: 'client_viewer' | 'client_member' | 'client_owner' | 'strategos_admin';
}

/** A registered agent definition — everything the dashboard needs to render it. */
export interface AgentDefinition {
    slug: string;
    name: string;
    description: string;
    capabilities: AgentCapability[];
    /** Ordered list of modules. Order drives the sidebar nav order. */
    modules: AgentModule[];
}
