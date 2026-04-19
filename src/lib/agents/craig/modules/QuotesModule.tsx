'use client';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import type { AgentModuleProps } from '@/types/agent';
import type { CraigQuote, QuoteStatus } from '../api';
import { DataTable } from '@/components/blocks/DataTable';
import { PageHeader } from '@/components/blocks/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/blocks/ErrorState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PdfDrawer } from '@/components/blocks/PdfDrawer';

const STATUS_VARIANT: Record<QuoteStatus, 'warning' | 'success' | 'secondary' | 'destructive'> = {
    pending_approval: 'warning',
    approved: 'success',
    sent: 'success',
    accepted: 'success',
    rejected: 'destructive',
};

const STATUS_LABELS: Array<{ value: QuoteStatus | 'all'; label: string }> = [
    { value: 'pending_approval', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'sent', label: 'Sent' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All' },
];

const CHANNELS: Array<{ value: string | 'all'; label: string }> = [
    { value: 'all', label: 'All channels' },
    { value: 'web', label: 'Web' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'email', label: 'Email' },
    { value: 'missive', label: 'Missive' },
    { value: 'phone', label: 'Phone' },
];

export function QuotesModule({ organizationSlug, agentApiBaseUrl, apiFetch }: AgentModuleProps) {
    const [quotes, setQuotes] = useState<CraigQuote[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<QuoteStatus | 'all'>('pending_approval');
    const [channel, setChannel] = useState<string | 'all'>('all');
    const [search, setSearch] = useState('');
    const [pdfQuote, setPdfQuote] = useState<CraigQuote | null>(null);

    useEffect(() => {
        let cancelled = false;
        setQuotes(null);
        setError(null);
        const params = new URLSearchParams();
        if (status !== 'all') params.set('status', status);
        if (channel !== 'all') params.set('channel', channel);
        const qs = params.toString() ? `?${params}` : '';
        apiFetch<{ quotes: CraigQuote[] }>(`/admin/api/orgs/${organizationSlug}/quotes${qs}`)
            .then((d) => !cancelled && setQuotes(d.quotes))
            .catch((e) => !cancelled && setError(String(e)));
        return () => {
            cancelled = true;
        };
    }, [organizationSlug, apiFetch, status, channel]);

    const filtered = useMemo(() => {
        if (!quotes) return [];
        if (!search.trim()) return quotes;
        const q = search.toLowerCase();
        return quotes.filter(
            (row) =>
                row.product_key.toLowerCase().includes(q) ||
                String(row.id).includes(q),
        );
    }, [quotes, search]);

    async function updateStatus(id: number, newStatus: QuoteStatus) {
        try {
            const { quote } = await apiFetch<{ quote: CraigQuote }>(
                `/admin/api/orgs/${organizationSlug}/quotes/${id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus }),
                },
            );
            setQuotes((q) => q?.map((row) => (row.id === id ? quote : row)) ?? null);
            toast.success(`Quote JP-${String(id).padStart(4, '0')} → ${newStatus}`);
        } catch (e) {
            toast.error('Failed to update: ' + e);
        }
    }

    const columns: ColumnDef<CraigQuote>[] = [
        {
            header: 'Ref',
            accessorKey: 'id',
            cell: ({ row }) => (
                <span className="font-mono text-xs">JP-{String(row.original.id).padStart(4, '0')}</span>
            ),
        },
        {
            header: 'Product',
            accessorKey: 'product_key',
            cell: ({ row }) => (
                <span className="font-medium">{row.original.product_key?.replace(/_/g, ' ')}</span>
            ),
        },
        {
            header: 'Qty',
            accessorFn: (r) => (r.specs as Record<string, unknown>).quantity,
            cell: ({ getValue }) => String(getValue() ?? ''),
        },
        {
            header: 'Total',
            accessorKey: 'total',
            cell: ({ row }) => (
                <span className="font-semibold tabular-nums">€{row.original.total.toFixed(2)}</span>
            ),
        },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: ({ row }) => (
                <Badge variant={STATUS_VARIANT[row.original.status] ?? 'secondary'}>
                    {row.original.status.replace(/_/g, ' ')}
                </Badge>
            ),
        },
        {
            header: 'Created',
            cell: ({ row }) =>
                row.original.created_at
                    ? new Date(row.original.created_at).toLocaleString('en-IE', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                      })
                    : '—',
        },
        {
            header: '',
            id: 'actions',
            cell: ({ row }) => (
                <div className="flex items-center gap-1.5">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                            e.stopPropagation();
                            setPdfQuote(row.original);
                        }}
                    >
                        <Eye className="h-3 w-3" /> PDF
                    </Button>
                    {row.original.status === 'pending_approval' && (
                        <>
                            <Button
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    updateStatus(row.original.id, 'approved');
                                }}
                            >
                                <CheckCircle2 className="h-3 w-3" /> Approve
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    updateStatus(row.original.id, 'rejected');
                                }}
                            >
                                <XCircle className="h-3 w-3" /> Reject
                            </Button>
                        </>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div>
            <PageHeader
                title="Quote Queue"
                description="Review, approve, reject, and download quotes Craig has generated."
            />

            {/* Filters */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                    {STATUS_LABELS.map((s) => (
                        <FilterChip
                            key={s.value}
                            label={s.label}
                            active={status === s.value}
                            onClick={() => setStatus(s.value)}
                        />
                    ))}
                </div>
                <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as string | 'all')}
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"
                >
                    {CHANNELS.map((c) => (
                        <option key={c.value} value={c.value}>
                            {c.label}
                        </option>
                    ))}
                </select>
                <Input
                    placeholder="Search by product or ref…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 w-56"
                />
            </div>

            {error && <ErrorState description={error} className="mb-4" />}

            {quotes === null ? (
                <Skeleton className="h-64" />
            ) : (
                <DataTable
                    columns={columns}
                    data={filtered}
                    emptyTitle="No quotes match"
                    emptyDescription="Adjust your filters or wait for Craig to produce a new quote."
                />
            )}

            <PdfDrawer
                open={!!pdfQuote}
                onClose={() => setPdfQuote(null)}
                title={pdfQuote ? `Quote JP-${String(pdfQuote.id).padStart(4, '0')}` : ''}
                url={pdfQuote ? `${agentApiBaseUrl}/quotes/${pdfQuote.id}/pdf` : ''}
            />
        </div>
    );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                (active
                    ? 'bg-[var(--color-primary,#0d0d2b)] text-white border-transparent'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
            }
        >
            {label}
        </button>
    );
}

