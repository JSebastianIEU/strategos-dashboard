'use client';
import { useEffect, useState } from 'react';
import { Mail, Printer, CreditCard } from 'lucide-react';
import type { IntegrationHealth, IntegrationsHealth } from '../../api';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
    organizationSlug: string;
    apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
}

const HEALTH_DOT: Record<IntegrationHealth['health'], string> = {
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500',
    red: 'bg-red-500',
    unknown: 'bg-slate-300',
};

const HEALTH_LABEL: Record<IntegrationHealth['health'], string> = {
    green: 'Healthy',
    yellow: 'Attention',
    red: 'Broken',
    unknown: 'Not configured',
};

function Row({
    icon: Icon,
    name,
    info,
}: {
    icon: typeof Mail;
    name: string;
    info: IntegrationHealth;
}) {
    return (
        <div className="flex items-center gap-3 rounded-md border p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="font-medium">{name}</span>
                    <span
                        className={`h-2 w-2 rounded-full ${HEALTH_DOT[info.health]}`}
                        aria-label={info.health}
                    />
                    <span className="text-xs text-slate-500">{HEALTH_LABEL[info.health]}</span>
                </div>
                <div className="text-xs text-slate-500 truncate">
                    {info.notes ??
                        (info.last_success_at
                            ? `Last success ${new Date(info.last_success_at).toLocaleString('en-IE')}`
                            : 'No recent activity')}
                </div>
            </div>
        </div>
    );
}

/**
 * Compact health summary card. Polls /integrations/status every 30s while
 * mounted. Sits at the top of the Overview module so the user can spot
 * "ah Stripe is yellow today" at a glance.
 */
export function IntegrationsHealthCard({ organizationSlug, apiFetch }: Props) {
    const [data, setData] = useState<IntegrationsHealth | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const d = await apiFetch<IntegrationsHealth>(
                    `/admin/api/orgs/${organizationSlug}/integrations/status`,
                );
                if (!cancelled) {
                    setData(d);
                    setError(null);
                }
            } catch (e) {
                if (!cancelled) setError(String(e));
            }
        }
        load();
        const t = setInterval(load, 30_000);
        return () => {
            cancelled = true;
            clearInterval(t);
        };
    }, [organizationSlug, apiFetch]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Integration health</CardTitle>
                <CardDescription>
                    Live status of the channels Craig depends on. Click into each tab
                    under Connections to configure.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {error && (
                    <p className="text-sm text-red-600">Health check failed: {error}</p>
                )}
                {!data && !error && (
                    <div className="space-y-2">
                        <Skeleton className="h-12" />
                        <Skeleton className="h-12" />
                        <Skeleton className="h-12" />
                    </div>
                )}
                {data && (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <Row icon={Mail} name="Missive" info={data.missive} />
                        <Row icon={Printer} name="PrintLogic" info={data.printlogic} />
                        <Row icon={CreditCard} name="Stripe" info={data.stripe} />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
