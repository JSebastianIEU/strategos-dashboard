'use client';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/blocks/DataTable';
import { Badge } from '@/components/ui/badge';

export interface MembershipRow {
    id: string;
    role: string;
    created_at: string;
    user: { id: string; email: string; display_name: string | null };
    organization: { id: string; slug: string; name: string; type: string };
}

const columns: ColumnDef<MembershipRow>[] = [
    {
        header: 'User',
        cell: ({ row }) => (
            <div>
                <div className="font-medium">
                    {row.original.user.display_name ?? row.original.user.email.split('@')[0]}
                </div>
                <div className="text-xs text-slate-500">{row.original.user.email}</div>
            </div>
        ),
    },
    {
        header: 'Organization',
        cell: ({ row }) => (
            <div>
                <div className="font-medium">{row.original.organization.name}</div>
                <div className="text-xs text-slate-500 font-mono">
                    {row.original.organization.slug}
                </div>
            </div>
        ),
    },
    {
        header: 'Role',
        accessorKey: 'role',
        cell: ({ row }) => (
            <Badge variant="secondary" className="capitalize">
                {row.original.role.replace(/_/g, ' ')}
            </Badge>
        ),
    },
    {
        header: 'Joined',
        cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
    },
];

export function UsersTable({ memberships }: { memberships: MembershipRow[] }) {
    return (
        <DataTable
            columns={columns}
            data={memberships}
            emptyTitle="No users yet"
            emptyDescription="Users appear here as they accept magic-link invites."
        />
    );
}
