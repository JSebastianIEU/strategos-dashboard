'use client';
import { useEffect, useState } from 'react';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import type { AgentModuleProps } from '@/types/agent';
import type { CraigMetrics } from '../api';
import { PageHeader } from '@/components/blocks/PageHeader';
import { StatCard } from '@/components/blocks/StatCard';
import { DonutChart } from '@/components/blocks/DonutChart';
import { LineChart } from '@/components/blocks/LineChart';
import { BarChart } from '@/components/blocks/BarChart';
import { DateRangePicker, type DateRangeValue } from '@/components/blocks/DateRangePicker';
import { ErrorState } from '@/components/blocks/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, MessageSquare, TrendingUp, CheckCircle2 } from 'lucide-react';
import { IntegrationsHealthCard } from './overview/IntegrationsHealthCard';

const eur = (v: number) => '€' + v.toLocaleString('en-IE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const pct = (v: number) => Math.round(v * 100) + '%';

export function OverviewModule({ organizationSlug, apiFetch }: AgentModuleProps) {
    const now = new Date();
    const [range, setRange] = useState<DateRangeValue>({
        from: startOfDay(subDays(now, 29)),
        to: endOfDay(now),
    });
    const [metrics, setMetrics] = useState<CraigMetrics | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        const qp = new URLSearchParams({
            from: range.from.toISOString(),
            to: range.to.toISOString(),
        });
        apiFetch<CraigMetrics>(`/admin/api/orgs/${organizationSlug}/metrics?${qp}`)
            .then((d) => {
                if (cancelled) return;
                setMetrics(d);
                setLoading(false);
            })
            .catch((e) => {
                if (cancelled) return;
                setError(String(e));
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [organizationSlug, apiFetch, range]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Overview"
                description="Snapshot of Craig's activity for the selected time range."
                actions={<DateRangePicker value={range} onChange={setRange} />}
            />

            {error && <ErrorState description={error} />}

            <IntegrationsHealthCard organizationSlug={organizationSlug} apiFetch={apiFetch} />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Quotes"
                    value={loading ? '…' : metrics?.totals.quotes_count ?? 0}
                    icon={FileText}
                    hint="Total in range"
                />
                <StatCard
                    label="Pipeline value"
                    value={loading ? '…' : eur(metrics?.totals.quotes_value ?? 0)}
                    icon={TrendingUp}
                    hint="Inc VAT, all statuses"
                />
                <StatCard
                    label="Approval rate"
                    value={loading ? '…' : pct(metrics?.totals.approval_rate ?? 0)}
                    icon={CheckCircle2}
                    hint="Approved / total"
                />
                <StatCard
                    label="Conversations"
                    value={loading ? '…' : metrics?.totals.conversations_count ?? 0}
                    icon={MessageSquare}
                    hint="Started in range"
                />
            </div>

            {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Skeleton className="h-[330px]" />
                    <Skeleton className="h-[330px]" />
                </div>
            ) : metrics ? (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <DonutChart
                            title="Quotes by channel"
                            description="Where customers reach Craig"
                            data={metrics.by_channel.map((c) => ({ label: c.channel, value: c.count }))}
                            valueLabel="quotes"
                        />
                        <LineChart
                            title="Quote volume"
                            description="Daily quote count"
                            data={metrics.by_day.map((d) => ({ x: d.date.slice(5), y: d.count }))}
                        />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <BarChart
                            title="Top products"
                            description="By number of quotes"
                            data={metrics.top_products.slice(0, 8).map((p) => ({
                                label: p.product_key.replace(/_/g, ' '),
                                value: p.count,
                            }))}
                        />
                        <BarChart
                            title="Quotes by status"
                            description="Pipeline breakdown"
                            data={metrics.by_status.map((s) => ({
                                label: s.status.replace(/_/g, ' '),
                                value: s.count,
                            }))}
                            color="#3e8fcd"
                        />
                    </div>
                </>
            ) : null}
        </div>
    );
}
