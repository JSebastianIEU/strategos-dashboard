/**
 * Agent registry — the single source of truth for which agents the dashboard
 * knows how to render. Adding a new agent = adding a folder under
 * `src/lib/agents/<slug>/` and registering its definition here.
 */
import type { AgentDefinition } from '@/types/agent';
import { craigDefinition } from './craig/definition';

export const AGENT_REGISTRY: Record<string, AgentDefinition> = {
    craig: craigDefinition,
    // Future agents plug in here:
    // molly: mollyDefinition,
};

export function getAgentDefinition(slug: string): AgentDefinition | undefined {
    return AGENT_REGISTRY[slug];
}
