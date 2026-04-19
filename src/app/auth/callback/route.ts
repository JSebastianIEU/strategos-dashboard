/**
 * Supabase auth callback.
 *
 * Handles every magic-link redirect shape Supabase can send:
 *   1. PKCE flow:           /auth/callback?code=<pkce_code>
 *   2. token_hash flow:     /auth/callback?token_hash=<hash>&type=magiclink
 *   3. Error redirect:      /auth/callback?error=<x>&error_description=<y>
 *
 * Also handles Vercel's x-forwarded-host header so redirects land on the
 * canonical production domain instead of the internal preview URL.
 */
import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const tokenHash = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type') as EmailOtpType | null;
    const next = url.searchParams.get('next') ?? '/';
    const oauthError = url.searchParams.get('error');
    const oauthErrorDesc = url.searchParams.get('error_description');

    console.log('[auth/callback] hit', {
        hasCode: !!code,
        hasTokenHash: !!tokenHash,
        type,
        hasError: !!oauthError,
        allParams: Array.from(url.searchParams.keys()),
    });

    // Vercel puts the canonical host in x-forwarded-host; use that so cookies
    // set during exchangeCodeForSession match the browser's URL.
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
    const origin = forwardedHost
        ? `${forwardedProto}://${forwardedHost}`
        : url.origin;

    const redirectTo = (path: string) =>
        NextResponse.redirect(new URL(path, origin));

    // Supabase-origin error (e.g. link expired)
    if (oauthError) {
        console.error('[auth/callback] supabase redirect error:', oauthError, oauthErrorDesc);
        return redirectTo(
            `/login?error=${encodeURIComponent(oauthErrorDesc ?? oauthError)}`,
        );
    }

    const supabase = await createClient();

    // 1) PKCE flow — the default with @supabase/ssr
    if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
            console.error('[auth/callback] exchangeCodeForSession failed:', error);
            return redirectTo(`/login?error=${encodeURIComponent(error.message)}`);
        }
        return redirectTo(next);
    }

    // 2) token_hash flow — used by older Supabase email templates
    if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
        });
        if (error) {
            console.error('[auth/callback] verifyOtp failed:', error);
            return redirectTo(`/login?error=${encodeURIComponent(error.message)}`);
        }
        return redirectTo(next);
    }

    console.warn('[auth/callback] no code or token_hash present in URL');
    return redirectTo('/login?error=invalid_link');
}
