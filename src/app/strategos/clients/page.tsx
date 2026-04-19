import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/blocks/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Building2, ArrowRight, Plus, Settings } from 'lucide-react';
import type { Organization } from '@/types/organization';
import { EmptyState } from '@/components/blocks/EmptyState';
import { isDemoMode, demoListClientOrgs } from '@/lib/demo';

export default async function ClientsPage() {
    let clients: Organization[] = [];
    if (isDemoMode()) {
        clients = demoListClientOrgs();
    } else {
        const supabase = await createClient();
        const { data } = await supabase
            .from('organizations')
            .select('*')
            .eq('type', 'client')
            .order('name');
        clients = (data ?? []) as Organization[];
    }

    return (
        <div className="max-w-6xl mx-auto">
            <PageHeader
                title="Clients"
                description="All client workspaces under Strategos AI."
                actions={
                    <Button asChild size="sm">
                        <Link href="/strategos/clients/new">
                            <Plus className="h-3.5 w-3.5" />
                            New client
                        </Link>
                    </Button>
                }
            />
            {clients.length === 0 ? (
                <EmptyState
                    icon={Building2}
                    title="No clients yet"
                    description="Add clients by inserting into the organizations table in Supabase. CRUD UI coming in v2."
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clients.map((client) => (
                        <Card
                            key={client.id}
                            className="h-full transition-all hover:shadow-md hover:border-slate-300"
                        >
                            <CardHeader>
                                <div className="flex items-start justify-between gap-2">
                                    <Link href={`/c/${client.slug}`} className="flex items-center gap-3 min-w-0 flex-1">
                                        {client.theme.logo_url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={client.theme.logo_url}
                                                alt=""
                                                className="h-10 w-10 rounded-md object-cover"
                                            />
                                        ) : (
                                            <div
                                                className="flex h-10 w-10 items-center justify-center rounded-md font-bold text-white"
                                                style={{
                                                    background:
                                                        client.theme.primary_color ?? '#0d0d2b',
                                                }}
                                            >
                                                {client.name[0]}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <CardTitle>{client.name}</CardTitle>
                                            <CardDescription className="font-mono text-xs">
                                                /{client.slug}
                                            </CardDescription>
                                        </div>
                                    </Link>
                                    <Button asChild size="icon" variant="ghost">
                                        <Link
                                            href={`/strategos/clients/${client.slug}`}
                                            title="Configure"
                                        >
                                            <Settings className="h-3.5 w-3.5" />
                                        </Link>
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Link
                                    href={`/c/${client.slug}`}
                                    className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
                                >
                                    Enter workspace <ArrowRight className="h-3 w-3" />
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
