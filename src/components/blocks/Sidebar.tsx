'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Building2,
    LayoutDashboard,
    Bot,
    Users,
    LogOut,
    ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/types/user';
import type { AgentConnectionWithAgent } from '@/types/agent';
import { getAgentDefinition } from '@/lib/agents/registry';
import { isStrategosAdmin } from '@/lib/auth/rbac';

interface SidebarProps {
    user: AppUser;
    /** If set, we're inside a client org. Shows the client's agents + modules. */
    clientOrg?: {
        slug: string;
        name: string;
        logo_url?: string | null;
    };
    /** Agents enabled for the current client. */
    clientAgents?: AgentConnectionWithAgent[];
    /** Active agent slug, if the URL is /c/:slug/a/:agent/... */
    activeAgentSlug?: string;
    /** Active section within the agent, if URL is /c/:slug/a/:agent/:section */
    activeSection?: string;
}

export function Sidebar({
    user,
    clientOrg,
    clientAgents = [],
    activeAgentSlug,
    activeSection,
}: SidebarProps) {
    const pathname = usePathname();
    const strategosAdmin = isStrategosAdmin(user);

    return (
        <aside className="flex h-full w-60 shrink-0 flex-col border-r border-slate-200 bg-slate-50/70">
            {/* Brand */}
            <div className="border-b border-slate-200 px-4 py-4">
                <Link href="/" className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-primary,#0d0d2b)] text-xs font-bold text-white">
                        S
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">
                            Strategos AI
                        </div>
                    </div>
                </Link>
            </div>

            {/* Main nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-4">
                {/* Home */}
                <NavItem
                    href="/"
                    icon={LayoutDashboard}
                    active={pathname === '/'}
                >
                    Overview
                </NavItem>

                {/* Strategos-only section */}
                {strategosAdmin && (
                    <div className="mt-5">
                        <SectionLabel>Agency</SectionLabel>
                        <NavItem
                            href="/strategos/clients"
                            icon={Building2}
                            active={pathname.startsWith('/strategos/clients')}
                        >
                            Clients
                        </NavItem>
                        <NavItem
                            href="/strategos/agents"
                            icon={Bot}
                            active={pathname.startsWith('/strategos/agents')}
                        >
                            Agents
                        </NavItem>
                        <NavItem
                            href="/strategos/users"
                            icon={Users}
                            active={pathname.startsWith('/strategos/users')}
                        >
                            Users
                        </NavItem>
                    </div>
                )}

                {/* Client context */}
                {clientOrg && (
                    <div className="mt-5">
                        <SectionLabel>{clientOrg.name}</SectionLabel>
                        <NavItem
                            href={`/c/${clientOrg.slug}`}
                            icon={LayoutDashboard}
                            active={pathname === `/c/${clientOrg.slug}`}
                        >
                            Overview
                        </NavItem>
                        {clientAgents.map((conn) => {
                            const def = getAgentDefinition(conn.agent.slug);
                            if (!def) return null;
                            const agentPath = `/c/${clientOrg.slug}/a/${conn.agent.slug}`;
                            const isActive = activeAgentSlug === conn.agent.slug;

                            return (
                                <div key={conn.id} className="mt-2">
                                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        <Bot className="h-3 w-3" />
                                        {def.name}
                                    </div>
                                    {def.modules
                                        .filter((m) =>
                                            conn.enabled_capabilities.includes(m.route),
                                        )
                                        .map((mod) => {
                                            const href = `${agentPath}/${mod.route}`;
                                            const active =
                                                isActive && activeSection === mod.route;
                                            return (
                                                <NavItem
                                                    key={mod.route}
                                                    href={href}
                                                    icon={mod.icon}
                                                    active={active}
                                                    indent
                                                >
                                                    {mod.title}
                                                </NavItem>
                                            );
                                        })}
                                </div>
                            );
                        })}
                    </div>
                )}
            </nav>

            {/* User footer */}
            <div className="border-t border-slate-200 p-3">
                <SignOutButton user={user} />
            </div>
        </aside>
    );
}

/**
 * POST to /auth/signout (Link prefetches can't trigger POST, unlike GET).
 * Redirects to /login on success.
 */
function SignOutButton({ user }: { user: AppUser }) {
    async function handleClick() {
        try {
            await fetch('/auth/signout', { method: 'POST' });
        } finally {
            // Hard navigation to ensure cookies are re-read server-side.
            window.location.href = '/login';
        }
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-xs text-slate-600 hover:bg-slate-100 text-left"
        >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-medium text-slate-700">
                {user.email[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
                <div className="truncate text-xs font-medium text-slate-900">
                    {user.display_name ?? user.email.split('@')[0]}
                </div>
                <div className="truncate text-[10px] text-slate-500">
                    {user.email}
                </div>
            </div>
            <LogOut className="h-3 w-3 text-slate-400" />
        </button>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="mb-1 flex items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {children}
            <ChevronDown className="h-3 w-3 opacity-0" />
        </div>
    );
}

interface NavItemProps {
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    active?: boolean;
    indent?: boolean;
    children: React.ReactNode;
}

function NavItem({ href, icon: Icon, active, indent, children }: NavItemProps) {
    return (
        <Link
            href={href}
            className={cn(
                'group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                indent && 'ml-4',
                active
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900',
            )}
        >
            <Icon
                className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-[var(--color-primary,#0d0d2b)]' : 'text-slate-400',
                )}
            />
            <span className="truncate">{children}</span>
        </Link>
    );
}
