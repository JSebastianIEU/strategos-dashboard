/**
 * Supabase admin (service-role) client.
 *
 * !!!! SERVER-SIDE ONLY !!!!
 * Never import from a client component. The service role key bypasses RLS.
 *
 * Used for admin operations (creating auth users, sending invites, inserting
 * memberships) that need elevated privileges.
 */
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error(
            'SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set for admin actions',
        );
    }
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}
