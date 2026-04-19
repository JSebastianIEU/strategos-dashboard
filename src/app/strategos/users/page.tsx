import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/blocks/PageHeader';
import { Button } from '@/components/ui/button';
import { isDemoMode, DEMO_JUST_PRINT_ORG, DEMO_STRATEGOS_ORG } from '@/lib/demo';
import { UsersTable, type MembershipRow } from './UsersTable';

export default async function UsersPage() {
    let memberships: MembershipRow[] = [];

    if (isDemoMode()) {
        memberships = [
            {
                id: 'demo-m-1',
                role: 'strategos_admin',
                created_at: new Date().toISOString(),
                user: {
                    id: 'demo-user-id',
                    email: 'demo@strategosai.example',
                    display_name: 'Demo Admin',
                },
                organization: {
                    id: DEMO_STRATEGOS_ORG.id,
                    slug: 'strategos',
                    name: 'Strategos AI',
                    type: 'agency',
                },
            },
            {
                id: 'demo-m-2',
                role: 'client_owner',
                created_at: new Date().toISOString(),
                user: {
                    id: 'demo-justin-id',
                    email: 'justin@just-print.ie',
                    display_name: 'Justin Byrne',
                },
                organization: {
                    id: DEMO_JUST_PRINT_ORG.id,
                    slug: 'just-print',
                    name: 'Just Print',
                    type: 'client',
                },
            },
        ];
    } else {
        const supabase = await createClient();
        const { data } = await supabase
            .from('memberships')
            .select('*, user:users(id,email,display_name), organization:organizations(id,slug,name,type)')
            .order('created_at', { ascending: false });

        memberships = (data ?? []) as MembershipRow[];
    }

    return (
        <div className="max-w-6xl mx-auto">
            <PageHeader
                title="Users & Memberships"
                description="Everyone with access to a Strategos workspace."
                actions={
                    <Button asChild size="sm">
                        <Link href="/strategos/users/new">
                            <Plus className="h-3.5 w-3.5" />
                            Invite user
                        </Link>
                    </Button>
                }
            />
            <UsersTable memberships={memberships} />
        </div>
    );
}
