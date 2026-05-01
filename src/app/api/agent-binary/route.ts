/**
 * Server-side binary proxy between the dashboard and an agent's backend.
 *
 * Sister route to /api/agent-proxy. The proxy returns JSON (text); this
 * route streams binary data (images, PDFs, downloads). Used by Phase G
 * for the artwork file proxy — Justin clicks "Open" on an uploaded
 * artwork in the QuotesModule sidebar and the browser opens the file
 * in a new tab without ever exposing the JWT to the client.
 *
 *   - Verifies the caller is an authenticated Strategos user
 *   - Confirms membership in the target client org
 *   - Signs a short-lived JWT with { email, org_slug, role }
 *   - Forwards the GET request to the agent's api_base_url with
 *     a wildcard Accept header and streams the response body back
 *     unchanged (preserves Content-Type, Content-Disposition, etc.)
 *
 * Query params:
 *   ?agent=<slug>&client=<slug>&path=<absolute path on agent backend>
 *
 * Example:
 *   /api/agent-binary?agent=craig&client=just-print
 *     &path=/admin/api/orgs/just-print/quotes/123/artwork/0/file
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { canAccessOrg, isStrategosAdmin, membershipFor } from '@/lib/auth/rbac';
import { signAgentToken } from '@/lib/agents/jwt';
import { createClient } from '@/lib/supabase/server';
import type { Agent } from '@/types/agent';

export async function GET(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) return new NextResponse('Unauthenticated', { status: 401 });

    const url = new URL(request.url);
    const clientSlug = url.searchParams.get('client') ?? '';
    const agentSlug = url.searchParams.get('agent') ?? '';
    const path = url.searchParams.get('path') ?? '';

    if (!clientSlug || !agentSlug || !path) {
        return new NextResponse('Missing required query params: agent, client, path', { status: 400 });
    }
    if (!canAccessOrg(user, clientSlug)) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    const supabase = await createClient();
    const { data: agent } = await supabase
        .from('agents')
        .select('*')
        .eq('slug', agentSlug)
        .maybeSingle();
    if (!agent) return new NextResponse('Agent not found', { status: 404 });

    const role = isStrategosAdmin(user)
        ? 'strategos_admin'
        : membershipFor(user, clientSlug)?.role ?? 'client_viewer';

    const token = await signAgentToken({
        email: user.email,
        org_slug: clientSlug,
        role,
    });

    const targetUrl = (agent as Agent).api_base_url.replace(/\/$/, '') + path;

    try {
        const res = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: '*/*',
            },
            cache: 'no-store',
        });

        if (!res.ok) {
            const text = await res.text();
            return new NextResponse(text, { status: res.status });
        }

        // Stream the binary body back unchanged. Preserves
        // Content-Type, Content-Disposition, Content-Length so the
        // browser renders/downloads correctly.
        const headers: Record<string, string> = {};
        const ct = res.headers.get('content-type');
        if (ct) headers['content-type'] = ct;
        const cd = res.headers.get('content-disposition');
        if (cd) headers['content-disposition'] = cd;
        const cl = res.headers.get('content-length');
        if (cl) headers['content-length'] = cl;
        // Conservative cache — Justin might re-upload, want the latest.
        headers['cache-control'] = 'private, max-age=60';

        return new NextResponse(res.body, {
            status: 200,
            headers,
        });
    } catch (e) {
        return new NextResponse(
            `Agent backend unreachable: ${e instanceof Error ? e.message : 'unknown'}`,
            { status: 502 },
        );
    }
}
