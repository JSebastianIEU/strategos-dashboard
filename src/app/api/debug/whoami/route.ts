/**
 * Debug endpoint — shows the server's view of the current auth state.
 * Safe to expose: returns email/role info, never service keys.
 * Remove once auth is stable.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import { isDemoMode } from '@/lib/demo';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user: supabaseUser },
        error: authError,
    } = await supabase.auth.getUser();

    const appUser = await getCurrentUser();

    const cookieNames = request.cookies
        .getAll()
        .map((c) => c.name)
        .filter((n) => n.startsWith('sb-') || n.startsWith('supabase'));

    return NextResponse.json(
        {
            demo_mode: isDemoMode(),
            host: request.headers.get('host'),
            x_forwarded_host: request.headers.get('x-forwarded-host'),
            supabase_user: supabaseUser
                ? { id: supabaseUser.id, email: supabaseUser.email }
                : null,
            supabase_auth_error: authError
                ? { message: authError.message, status: authError.status }
                : null,
            app_user: appUser
                ? {
                      id: appUser.id,
                      email: appUser.email,
                      memberships: appUser.memberships.map((m) => ({
                          role: m.role,
                          org: m.organization.slug,
                          type: m.organization.type,
                      })),
                  }
                : null,
            supabase_cookie_names: cookieNames,
        },
        { headers: { 'cache-control': 'no-store' } },
    );
}
