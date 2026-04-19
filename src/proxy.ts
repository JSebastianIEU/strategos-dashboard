import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Runs on every request (Next.js 16+ "proxy" convention, formerly "middleware").
 * Refreshes the Supabase session cookie and guards protected routes.
 */
export async function proxy(request: NextRequest) {
    return updateSession(request);
}

export const config = {
    matcher: [
        // Everything except static/images/api/_next
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
