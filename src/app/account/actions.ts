'use server';
/**
 * Server actions for the /account page.
 *
 * Two operations:
 *   - updateDisplayName: writes the new value to the public.users table
 *     for the authenticated user. RLS policy enforces that a user can
 *     only update their own row (id = auth.uid()).
 *   - requestEmailChange: sends a magic link to the new address. Once
 *     the user clicks it, Supabase swaps the email on the auth.users
 *     row. We never touch auth.users from the app.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface ActionResult {
    ok: boolean;
    message?: string;
}

export async function updateDisplayName(formData: FormData): Promise<ActionResult> {
    const display_name = String(formData.get('display_name') ?? '').trim();
    if (display_name.length === 0) {
        return { ok: false, message: 'Display name cannot be empty.' };
    }
    if (display_name.length > 80) {
        return { ok: false, message: 'Display name must be 80 characters or fewer.' };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { ok: false, message: 'Not signed in.' };
    }

    // Upsert in case the public.users row doesn't exist yet (it should,
    // but if a user was created before the trigger was wired we make
    // ourselves resilient).
    const { error } = await supabase
        .from('users')
        .upsert(
            { id: user.id, email: user.email, display_name },
            { onConflict: 'id' },
        );

    if (error) {
        return { ok: false, message: error.message };
    }

    // Refresh the sidebar (which reads display_name)
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Display name updated.' };
}

export async function requestEmailChange(formData: FormData): Promise<ActionResult> {
    const new_email = String(formData.get('new_email') ?? '').trim().toLowerCase();
    if (!new_email || !new_email.includes('@')) {
        return { ok: false, message: 'Enter a valid email address.' };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { ok: false, message: 'Not signed in.' };
    }
    if (new_email === user.email?.toLowerCase()) {
        return { ok: false, message: 'New email is the same as the current one.' };
    }

    // Supabase's updateUser() with `email` triggers a confirmation email
    // to the NEW address. Until the user clicks it, the change is staged
    // (auth.users.email_change holds the pending value). Old email keeps
    // working until confirmation.
    const { error } = await supabase.auth.updateUser({ email: new_email });
    if (error) {
        return { ok: false, message: error.message };
    }

    return {
        ok: true,
        message: `Confirmation email sent to ${new_email}. Click the link there to finish the change.`,
    };
}
