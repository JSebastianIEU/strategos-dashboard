'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/session';
import { isStrategosAdmin } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { isDemoMode } from '@/lib/demo';
import { demoStore } from '@/lib/demo-store';
import {
    createClientSchema,
    updateClientSchema,
    type CreateClientValues,
    type UpdateClientValues,
} from '@/schemas/client';

async function assertStrategosAdmin() {
    const user = await requireUser();
    if (!isStrategosAdmin(user)) throw new Error('Only Strategos admins can manage clients');
    return user;
}

export async function createNewClient(
    input: CreateClientValues,
): Promise<{ ok: true; slug: string } | { error: string }> {
    try {
        await assertStrategosAdmin();
        const values = createClientSchema.parse(input);

        if (isDemoMode()) {
            demoStore.addDemoClient({
                slug: values.slug,
                name: values.name,
                theme: {
                    ...(values.theme.primary_color ? { primary_color: values.theme.primary_color } : {}),
                    ...(values.theme.logo_url ? { logo_url: values.theme.logo_url } : {}),
                    ...(values.theme.font ? { font: values.theme.font } : {}),
                },
                enableCraig: values.enable_craig,
            });
            revalidatePath('/strategos/clients');
            revalidatePath('/');
            return { ok: true, slug: values.slug };
        }

        const admin = createAdminClient();
        const supabase = await createServerSupabase();

        // Resolve the Strategos (agency) parent row
        const { data: parent } = await supabase
            .from('organizations')
            .select('id')
            .eq('slug', 'strategos')
            .maybeSingle();

        const { data: org, error: orgErr } = await admin
            .from('organizations')
            .insert({
                slug: values.slug,
                name: values.name,
                type: 'client',
                parent_id: parent?.id ?? null,
                theme: {
                    ...(values.theme.primary_color ? { primary_color: values.theme.primary_color } : {}),
                    ...(values.theme.logo_url ? { logo_url: values.theme.logo_url } : {}),
                    ...(values.theme.font ? { font: values.theme.font } : {}),
                },
            })
            .select('id, slug')
            .single();
        if (orgErr) return { error: orgErr.message };

        if (values.enable_craig) {
            const { data: craig } = await admin
                .from('agents')
                .select('id, capabilities')
                .eq('slug', 'craig')
                .maybeSingle();
            if (craig) {
                await admin.from('agent_connections').insert({
                    organization_id: org.id,
                    agent_id: craig.id,
                    enabled_capabilities: craig.capabilities,
                });
            }
        }

        revalidatePath('/strategos/clients');
        return { ok: true, slug: org.slug };
    } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
    }
}

export async function updateClient(
    slug: string,
    input: UpdateClientValues,
): Promise<{ ok: true } | { error: string }> {
    try {
        await assertStrategosAdmin();
        const values = updateClientSchema.parse(input);

        if (isDemoMode()) {
            demoStore.updateDemoClient(slug, values);
            revalidatePath(`/strategos/clients`);
            revalidatePath(`/c/${slug}`);
            return { ok: true };
        }

        const admin = createAdminClient();
        const patch: Record<string, unknown> = {};
        if (values.name !== undefined) patch.name = values.name;
        if (values.theme !== undefined) patch.theme = values.theme;

        const { error } = await admin
            .from('organizations')
            .update(patch)
            .eq('slug', slug);
        if (error) return { error: error.message };

        revalidatePath(`/strategos/clients`);
        revalidatePath(`/c/${slug}`);
        return { ok: true };
    } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
    }
}

export async function toggleAgentForClient(
    clientSlug: string,
    agentSlug: string,
    enable: boolean,
): Promise<{ ok: true } | { error: string }> {
    try {
        await assertStrategosAdmin();

        if (isDemoMode()) {
            demoStore.toggleDemoClientAgent(clientSlug, agentSlug, enable);
            revalidatePath(`/c/${clientSlug}`);
            return { ok: true };
        }

        const admin = createAdminClient();
        const { data: org } = await admin
            .from('organizations')
            .select('id')
            .eq('slug', clientSlug)
            .maybeSingle();
        if (!org) return { error: 'Client not found' };
        const { data: agent } = await admin
            .from('agents')
            .select('id, capabilities')
            .eq('slug', agentSlug)
            .maybeSingle();
        if (!agent) return { error: 'Agent not found' };

        if (enable) {
            const { error } = await admin
                .from('agent_connections')
                .upsert(
                    {
                        organization_id: org.id,
                        agent_id: agent.id,
                        enabled_capabilities: agent.capabilities,
                    },
                    { onConflict: 'organization_id,agent_id' },
                );
            if (error) return { error: error.message };
        } else {
            const { error } = await admin
                .from('agent_connections')
                .delete()
                .eq('organization_id', org.id)
                .eq('agent_id', agent.id);
            if (error) return { error: error.message };
        }
        revalidatePath(`/c/${clientSlug}`);
        revalidatePath(`/strategos/clients/${clientSlug}`);
        return { ok: true };
    } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
    }
}
