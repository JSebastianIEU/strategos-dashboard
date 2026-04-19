'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/session';
import { isStrategosAdmin } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isDemoMode } from '@/lib/demo';
import {
    inviteUserSchema,
    updateMembershipSchema,
    type InviteUserValues,
    type UpdateMembershipValues,
} from '@/schemas/user';

async function assertStrategosAdmin() {
    const user = await requireUser();
    if (!isStrategosAdmin(user)) {
        throw new Error('Only Strategos admins can manage users');
    }
    return user;
}

export async function inviteUser(input: InviteUserValues): Promise<{ ok: true } | { error: string }> {
    try {
        await assertStrategosAdmin();
        const values = inviteUserSchema.parse(input);

        if (isDemoMode()) {
            // No-op in demo
            return { ok: true };
        }

        const supabase = await createClient();
        const admin = createAdminClient();

        // Resolve org id
        const { data: org } = await supabase
            .from('organizations')
            .select('id')
            .eq('slug', values.organization_slug)
            .maybeSingle();
        if (!org) return { error: `Workspace ${values.organization_slug} not found` };

        // Send magic link / invite. If the user already exists, the call still
        // succeeds and they'll just sign in to their existing account.
        const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(values.email);
        if (inviteErr) return { error: inviteErr.message };

        const userId = invited.user?.id;
        if (!userId) return { error: 'No user id returned from invite' };

        // Insert membership (upsert so re-invites are safe)
        const { error: msErr } = await admin
            .from('memberships')
            .upsert({
                user_id: userId,
                organization_id: org.id,
                role: values.role,
            }, { onConflict: 'user_id,organization_id' });
        if (msErr) return { error: msErr.message };

        revalidatePath('/strategos/users');
        return { ok: true };
    } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
    }
}

export async function updateMembershipRole(input: UpdateMembershipValues): Promise<{ ok: true } | { error: string }> {
    try {
        await assertStrategosAdmin();
        const values = updateMembershipSchema.parse(input);

        if (isDemoMode()) return { ok: true };

        const admin = createAdminClient();
        const { error } = await admin
            .from('memberships')
            .update({ role: values.role })
            .eq('id', values.membership_id);
        if (error) return { error: error.message };

        revalidatePath('/strategos/users');
        return { ok: true };
    } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
    }
}

export async function removeMembership(membershipId: string): Promise<{ ok: true } | { error: string }> {
    try {
        await assertStrategosAdmin();
        if (isDemoMode()) return { ok: true };

        const admin = createAdminClient();
        const { error } = await admin
            .from('memberships')
            .delete()
            .eq('id', membershipId);
        if (error) return { error: error.message };

        revalidatePath('/strategos/users');
        return { ok: true };
    } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
    }
}
