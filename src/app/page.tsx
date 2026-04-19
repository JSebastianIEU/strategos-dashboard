import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { Sidebar } from '@/components/blocks/Sidebar';
import { DemoBanner } from '@/components/blocks/DemoBanner';
import { PageHeader } from '@/components/blocks/PageHeader';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { isStrategosAdmin } from '@/lib/auth/rbac';
import Link from 'next/link';
import { Building2, ArrowRight } from 'lucide-react';
import { EmptyState } from '@/components/blocks/EmptyState';

export default async function HomePage() {
    const user = await getCurrentUser();
    if (!user) redirect('/login');

    const strategosAdmin = isStrategosAdmin(user);

    const clientMemberships = user.memberships.filter(
        (m) => m.organization.type === 'client',
    );

    if (!strategosAdmin && clientMemberships.length === 1) {
        redirect(`/c/${clientMemberships[0].organization.slug}`);
    }

    return (
        <div className="flex h-screen flex-col">
            <DemoBanner />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar user={user} />
                <main className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-5xl mx-auto">
                        <PageHeader
                            title={`Welcome back, ${user.display_name ?? user.email.split('@')[0]}`}
                            description={
                                strategosAdmin
                                    ? 'Strategos AI control plane. Pick a client to manage, or jump into the agency views.'
                                    : 'Pick a workspace to continue.'
                            }
                        />

                        {clientMemberships.length === 0 && !strategosAdmin && (
                            <EmptyState
                                icon={Building2}
                                title="No workspaces yet"
                                description="You haven't been invited to any client workspace. Reach out to your Strategos contact."
                            />
                        )}

                        {clientMemberships.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {clientMemberships.map((m) => (
                                    <Link
                                        key={m.id}
                                        href={`/c/${m.organization.slug}`}
                                        className="group"
                                    >
                                        <Card className="h-full transition-all group-hover:shadow-md group-hover:border-slate-300">
                                            <CardHeader>
                                                <div className="flex items-center gap-3">
                                                    {m.organization.theme.logo_url ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={m.organization.theme.logo_url}
                                                            alt=""
                                                            className="h-10 w-10 rounded-md object-cover"
                                                        />
                                                    ) : (
                                                        <div
                                                            className="flex h-10 w-10 items-center justify-center rounded-md font-bold text-white"
                                                            style={{
                                                                background:
                                                                    m.organization.theme.primary_color ??
                                                                    '#0d0d2b',
                                                            }}
                                                        >
                                                            {m.organization.name[0]}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <CardTitle>{m.organization.name}</CardTitle>
                                                        <CardDescription className="text-xs capitalize">
                                                            {m.role.replace(/_/g, ' ')}
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex items-center gap-1 text-sm text-slate-500 group-hover:text-slate-900">
                                                    Open workspace
                                                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
