/**
 * Server-side proxy between the dashboard and an agent's backend.
 *
 *   - Verifies the caller is an authenticated Strategos user
 *   - Confirms membership in the target client org
 *   - Signs a short-lived JWT with { email, org_slug, role }
 *   - Forwards the request to the agent's api_base_url
 *
 * In DEMO mode, returns canned data instead of calling any real backend.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { canAccessOrg, isStrategosAdmin, membershipFor } from '@/lib/auth/rbac';
import { signAgentToken } from '@/lib/agents/jwt';
import { createClient } from '@/lib/supabase/server';
import type { Agent } from '@/types/agent';
import { isDemoMode, demoCraigResponse, DEMO_CRAIG_AGENT } from '@/lib/demo';

interface ProxyRequest {
    agentSlug: string;
    clientSlug: string;
    path: string;
    method?: string;
    body?: string | null;
    headers?: Record<string, string>;
}

export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return new NextResponse('Unauthenticated', { status: 401 });

    const body = (await request.json()) as ProxyRequest;

    if (!canAccessOrg(user, body.clientSlug)) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    // ---- Demo mode: short-circuit with mock data ----
    if (isDemoMode()) {
        if (body.agentSlug === 'craig') {
            const parsedBody = body.body ? JSON.parse(body.body) : null;
            const method = (body.method ?? 'GET') as
                | 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
            const data = demoCraigResponse(body.path, method, parsedBody);
            return NextResponse.json(data);
        }
        return NextResponse.json({});
    }

    // ---- Real mode: resolve agent, sign JWT, forward ----
    const supabase = await createClient();
    const { data: agent } = await supabase
        .from('agents')
        .select('*')
        .eq('slug', body.agentSlug)
        .maybeSingle();
    if (!agent) return new NextResponse('Agent not found', { status: 404 });

    // The role on the JWT reflects the CALLING user's effective role in the
    // target org. Strategos admins are impersonating a client so their token
    // says 'strategos_admin' (bypass policies). Everyone else gets whichever
    // membership they actually hold on this org — `client_viewer` if we
    // somehow got past canAccessOrg() without a membership (defensive
    // fallback; shouldn't fire).
    const role = isStrategosAdmin(user)
        ? 'strategos_admin'
        : membershipFor(user, body.clientSlug)?.role ?? 'client_viewer';

    // Short-lived JWT signed with STRATEGOS_JWT_SECRET (HS256). The same
    // secret is set on the agent backend's env — see
    // Craig-Pricing/admin_api.py::require_claims. The token carries the
    // (email, org_slug, role) triple the agent needs to scope queries and
    // enforce role gates. No refresh — every proxied call signs a new token.
    const token = await signAgentToken({
        email: user.email,
        org_slug: body.clientSlug,
        role,
    });

    const url = (agent as Agent).api_base_url.replace(/\/$/, '') + body.path;

    try {
        const res = await fetch(url, {
            method: body.method ?? 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                ...(body.headers ?? {}),
            },
            body: body.body ?? undefined,
            cache: 'no-store',
        });

        const text = await res.text();
        if (!res.ok) {
            return new NextResponse(text, { status: res.status });
        }

        return new NextResponse(text, {
            status: res.status,
            headers: {
                'content-type': res.headers.get('content-type') ?? 'application/json',
            },
        });
    } catch (e) {
        return new NextResponse(
            `Agent backend unreachable: ${e instanceof Error ? e.message : 'unknown'}`,
            { status: 502 },
        );
    }
}

// Suppress unused import warning when only the real path uses it
void DEMO_CRAIG_AGENT;
