import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { isStrategosAdmin } from '@/lib/auth/rbac';
import { createClient } from '@/lib/supabase/server';
import { isDemoMode, DEMO_JUST_PRINT_ORG, DEMO_MOLLY_CLIENT, DEMO_STRATEGOS_ORG } from '@/lib/demo';
import type { Organization } from '@/types/organization';
import { InviteUserForm } from './InviteUserForm';
import { PageHeader } from '@/components/blocks/PageHeader';

export default async function NewUserPage() {
    const user = await getCurrentUser();
    if (!user) redirect('/login');
    if (!isStrategosAdmin(user)) notFound();

    let orgs: Organization[] = [];
    if (isDemoMode()) {
        orgs = [DEMO_STRATEGOS_ORG, DEMO_JUST_PRINT_ORG, DEMO_MOLLY_CLIENT];
    } else {
        const supabase = await createClient();
        const { data } = await supabase.from('organizations').select('*').order('name');
        orgs = (data ?? []) as Organization[];
    }

    return (
        <div className="max-w-xl mx-auto">
            <PageHeader
                title="Invite user"
                description="Send a magic-link invite. If the user already exists, they'll just be added to the workspace."
            />
            <InviteUserForm orgs={orgs.map((o) => ({ slug: o.slug, name: o.name, type: o.type }))} />
        </div>
    );
}
