/**
 * One-off provisioning script — silently create accounts for Justin and
 * Roi without firing magic-link emails. Each call:
 *
 *   1. `admin.auth.admin.createUser({ email, email_confirm: true })`
 *      creates a confirmed Supabase auth user WITHOUT sending a
 *      confirmation email. If the user already exists (e.g. this script
 *      is re-run) the error is swallowed and we move on to step 2.
 *   2. The `on_auth_user_created` Postgres trigger (at
 *      `supabase/migrations/001_initial_schema.sql:41`) mirrors the row
 *      into `public.users`, so we don't need to insert that manually.
 *   3. Look up the target organization by slug, then upsert the
 *      membership row with the requested role.
 *
 * When the user is ready to actually log in, they hit the dashboard
 * login page, request a magic link, and Supabase dispatches the email
 * at THAT point. Until then the account sits dormant.
 *
 * Usage (from `strategos-dashboard/`):
 *
 *   # 1. Make sure .env.local has SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL
 *   # 2. Run:
 *   npx tsx scripts/provision_users.ts
 *
 * Idempotent — safe to re-run.
 */

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

// Pull .env.local so the same creds the app uses are available to this script.
loadEnv({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error(
        'Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.',
    );
    process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

type Target = {
    email: string;
    org_slug: string;
    role: 'strategos_admin' | 'client_owner' | 'client_member' | 'client_viewer';
    display_name?: string;
};

const TARGETS: Target[] = [
    {
        email: 'info@just-print.ie',
        org_slug: 'just-print',
        role: 'client_owner',
        display_name: 'Justin @ Just Print',
    },
    {
        email: 'roi@marketingavc.com',
        org_slug: 'strategos',
        role: 'strategos_admin',
        display_name: 'Roi',
    },
    // Preview account — logs into Just Print as a client_owner ONLY (no
    // admin membership), so the session is identical to what Justin will
    // see. Use this to QA the client-scoped UI without demoting the
    // real admin account. Receives a magic-link email when you request
    // one from /login — no email is sent at provisioning time.
    {
        email: 'jpenad.ieu2023@student.ie.edu',
        org_slug: 'just-print',
        role: 'client_owner',
        display_name: 'JS (Just Print preview)',
    },
];

async function findOrCreateUser(email: string, displayName?: string) {
    // First attempt to create. If it exists we fall through to listUsers.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: displayName ? { display_name: displayName } : undefined,
    });
    if (!createErr && created.user) {
        console.log(`  + created auth.users row for ${email} (id=${created.user.id})`);
        return created.user;
    }
    // 422 "User already registered" — look it up.
    const expectExists = /already|exists|registered/i.test(createErr?.message ?? '');
    if (!expectExists) {
        throw new Error(`createUser failed for ${email}: ${createErr?.message}`);
    }
    // Paginate through users. Supabase listUsers maxes out at ~1000 per page,
    // which is fine for our 2-user workspace but we'll play it safe.
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);
    const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!existing) {
        throw new Error(`Expected ${email} to already exist but not found via listUsers`);
    }
    console.log(`  · ${email} already exists (id=${existing.id})`);
    return existing;
}

async function resolveOrgId(slug: string): Promise<string> {
    const { data, error } = await admin
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
    if (error) throw new Error(`Lookup org ${slug} failed: ${error.message}`);
    if (!data) throw new Error(`Organization '${slug}' not found — seed it first`);
    return data.id as string;
}

async function upsertMembership(userId: string, orgId: string, role: Target['role']) {
    const { error } = await admin.from('memberships').upsert(
        {
            user_id: userId,
            organization_id: orgId,
            role,
        },
        { onConflict: 'user_id,organization_id' },
    );
    if (error) throw new Error(`Membership upsert failed: ${error.message}`);
}

async function main() {
    console.log('Provisioning Strategos / Just Print accounts (no emails dispatched)...');
    for (const t of TARGETS) {
        console.log(`\n→ ${t.email} → ${t.org_slug} (${t.role})`);
        const user = await findOrCreateUser(t.email, t.display_name);
        const orgId = await resolveOrgId(t.org_slug);
        await upsertMembership(user.id, orgId, t.role);
        console.log(`  ✓ membership synced`);
    }
    console.log('\nDone. Users will hit "Magic link" on the login page when they\'re ready to sign in.');
}

main().catch((e) => {
    console.error('\nFAILED:', e);
    process.exit(1);
});
