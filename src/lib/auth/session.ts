/**
 * Server-side helpers for reading the current user + their memberships.
 * Call these from Server Components and Route Handlers.
 *
 * In DEMO mode, returns a mock user so the UI is fully navigable without
 * Supabase credentials.
 */
import { createClient } from '@/lib/supabase/server';
import type { AppUser } from '@/types/user';
import type { MembershipWithOrg } from '@/types/organization';
import { isDemoMode, demoUser } from '@/lib/demo';

export async function getCurrentUser(): Promise<AppUser | null> {
    if (isDemoMode()) return demoUser();

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: memberships } = await supabase
        .from('memberships')
        .select('*, organization:organizations(*)')
        .eq('user_id', user.id);

    const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

    return {
        id: user.id,
        email: user.email ?? profile?.email ?? '',
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        memberships: (memberships ?? []) as MembershipWithOrg[],
    };
}

export async function requireUser(): Promise<AppUser> {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    return user;
}
