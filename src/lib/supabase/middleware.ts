/**
 * Edge-runtime Supabase helper used by proxy.ts to refresh sessions.
 *
 *  - In demo mode (no real creds): every request passes through, no redirects.
 *  - Otherwise: refresh the Supabase session cookie, then gate access:
 *      * not signed in + non-auth route  → redirect to /login
 *      * signed in  + on /login         → redirect to /
 *
 * Skips /auth/callback explicitly so the PKCE exchange can run and set cookies
 * without interference.
 */
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demo';

export async function updateSession(request: NextRequest) {
    if (isDemoMode()) {
        return NextResponse.next({ request });
    }

    // If Supabase redirects the magic link to the root (or anywhere else)
    // instead of /auth/callback, hand the auth params to the callback so the
    // PKCE / token_hash exchange can run.
    const incomingUrl = request.nextUrl;
    const hasAuthParams =
        incomingUrl.searchParams.has('code') ||
        incomingUrl.searchParams.has('token_hash') ||
        incomingUrl.searchParams.has('error');
    if (hasAuthParams && !incomingUrl.pathname.startsWith('/auth/')) {
        const rerouted = incomingUrl.clone();
        rerouted.pathname = '/auth/callback';
        return NextResponse.redirect(rerouted);
    }

    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value),
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options),
                    );
                },
            },
        },
    );

    // IMPORTANT: refresh the session (sets any new cookies via setAll above)
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const url = request.nextUrl.clone();
    const pathname = url.pathname;

    // Routes that should never bounce back to /login
    const isAuthRoute =
        pathname.startsWith('/login') ||
        pathname.startsWith('/auth/');

    // Public API endpoints are the caller's concern, not the middleware's.
    // /api/agent-proxy does its own auth check inside the handler.
    const isPublicApi = pathname.startsWith('/api/');

    if (!user && !isAuthRoute && !isPublicApi) {
        url.pathname = '/login';
        url.searchParams.set('next', pathname + (url.search ? url.search : ''));
        return NextResponse.redirect(url);
    }

    if (user && pathname === '/login') {
        url.pathname = '/';
        url.searchParams.delete('next');
        url.searchParams.delete('error');
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}
