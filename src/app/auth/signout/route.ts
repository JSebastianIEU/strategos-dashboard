/**
 * Sign the user out. POST-only so Next.js's Link prefetching can't
 * accidentally trigger it (which it WOULD for a GET route).
 *
 * Called from the sidebar's "Sign out" button via fetch('/auth/signout',
 * { method: 'POST' }).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true }, { status: 200 });
}

// Keep GET available but inert — returning 405 makes it obvious if something
// still links to /auth/signout via an <a> tag.
export function GET() {
    return NextResponse.json({ error: 'Use POST to sign out' }, { status: 405 });
}
