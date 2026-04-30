'use client';
import { useEffect, useMemo, useState } from 'react';
import {
    CheckCircle2,
    XCircle,
    Eye,
    ExternalLink,
    Copy,
    Check,
    AlertTriangle,
    RotateCcw,
    Send,
    Loader2,
    CreditCard,
    Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import type { AgentModuleProps } from '@/types/agent';
import type { CraigQuote, CreatePaymentLinkResult, PushToPrintLogicResult, QuoteStatus } from '../api';
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
    /** Quote ids that are currently mid-push to PrintLogic (shows spinner). */
    const [pushingIds, setPushingIds] = useState<Set<number>>(new Set());
    /** Quote id whose PrintLogic order_id was last copied — drives the ✓ flash. */
    const [copiedId, setCopiedId] = useState<number | null>(null);
    /** Quote ids currently mid-Stripe operation (create / cancel link). */
    const [paymentBusyIds, setPaymentBusyIds] = useState<Set<number>>(new Set());
    /** Quote id whose Stripe payment URL was last copied — drives the ✓ flash. */
    const [copiedPaymentId, setCopiedPaymentId] = useState<number | null>(null);

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
            const response = await apiFetch<{
                quote: CraigQuote;
                integrations?: {
                    stripe?: { ok: boolean; url?: string | null; disabled: boolean; error?: string | null };
                    missive?: { ok: boolean; draft_id?: string | null; skipped: boolean; skip_reason?: string | null; error?: string | null };
                };
            }>(
                `/admin/api/orgs/${organizationSlug}/quotes/${id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus }),
                },
            );
            const { quote, integrations } = response;
            setQuotes((q) => q?.map((row) => (row.id === id ? quote : row)) ?? null);

            const ref = `JP-${String(id).padStart(4, '0')}`;

            // When Approve fires, the server auto-creates a Stripe Payment
            // Link + a Missive draft. Surface what happened so Justin gets
            // immediate feedback on whether the customer email is going out.
            if (newStatus === 'approved' && integrations) {
                const lines: string[] = [`${ref} approved`];
                if (integrations.stripe?.ok) {
                    lines.push(`✓ Stripe payment link created`);
                } else if (integrations.stripe?.disabled) {
                    lines.push(`· Stripe disabled (not connected)`);
                } else if (integrations.stripe?.error) {
                    lines.push(`✗ Stripe failed: ${integrations.stripe.error.slice(0, 80)}`);
                }
                if (integrations.missive?.ok) {
                    lines.push(`✓ Missive draft ready in your inbox`);
                } else if (integrations.missive?.skipped) {
                    const reason = integrations.missive.skip_reason ?? 'unknown';
                    lines.push(`· Missive skipped (${reason})`);
                } else if (integrations.missive?.error) {
                    lines.push(`✗ Missive failed: ${integrations.missive.error.slice(0, 80)}`);
                }
                toast.success(lines.join('\n'));
            } else {
                toast.success(`${ref} → ${newStatus}`);
            }
        } catch (e) {
            toast.error('Failed to update: ' + e);
        }
    }

    /**
     * Push a quote to the tenant's PrintLogic. Honors the tenant-level
     * `printlogic_dry_run` setting on the server side — when dry-run is
     * on, this returns a synthetic `DRY-xxxx` id and ZERO real network
     * traffic to PrintLogic. Same code path for "Promote DRY → real" and
     * "Retry after failure".
     */
    async function pushToPrintLogic(id: number) {
        setPushingIds((prev) => new Set(prev).add(id));
        try {
            const { quote, result } = await apiFetch<PushToPrintLogicResult>(
                `/admin/api/orgs/${organizationSlug}/quotes/${id}/push-to-printlogic`,
                { method: 'POST' },
            );
            setQuotes((q) => q?.map((row) => (row.id === id ? quote : row)) ?? null);

            if (result.already_pushed) {
                toast.info(`Already in PrintLogic (#${result.order_id})`);
            } else if (result.dry_run) {
                toast.success(
                    `Dry-run OK · ${result.order_id} (no real PrintLogic write — flip dry_run=false to promote)`,
                );
            } else if (result.ambiguous) {
                toast.warning(
                    'PrintLogic returned an ambiguous response — verify in their UI before retrying',
                );
            } else if (result.ok) {
                toast.success(`Pushed to PrintLogic · #${result.order_id}`);
            } else {
                toast.error(`Push failed: ${result.error ?? 'unknown error'}`);
            }
        } catch (e) {
            toast.error('Push failed: ' + e);
        } finally {
            setPushingIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    }

    async function cancelPrintLogic(id: number) {
        if (!confirm('Cancel this order in PrintLogic? This calls update_order_status with "Cancelled".')) {
            return;
        }
        setPushingIds((prev) => new Set(prev).add(id));
        try {
            const { quote, result } = await apiFetch<PushToPrintLogicResult>(
                `/admin/api/orgs/${organizationSlug}/quotes/${id}/cancel-printlogic`,
                { method: 'POST' },
            );
            setQuotes((q) => q?.map((row) => (row.id === id ? quote : row)) ?? null);
            if (result.ok) {
                toast.success('Cancelled in PrintLogic');
            } else {
                toast.error(
                    `Cancel rejected by PrintLogic: ${result.error ?? '?'} — delete from their UI manually.`,
                );
            }
        } catch (e) {
            toast.error('Cancel failed: ' + e);
        } finally {
            setPushingIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    }

    async function copyOrderId(id: number, orderId: string) {
        try {
            await navigator.clipboard.writeText(orderId);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 1500);
        } catch {
            // Clipboard API can fail in non-https or sandboxed iframes — silent.
        }
    }

    async function copyPaymentUrl(id: number, url: string) {
        try {
            await navigator.clipboard.writeText(url);
            setCopiedPaymentId(id);
            setTimeout(() => setCopiedPaymentId(null), 1500);
        } catch {
            // silent
        }
    }

    /**
     * Create a Stripe Payment Link. Server respects `stripe_enabled` —
     * if disabled, returns `{disabled:true}` and we surface a clear toast.
     * Idempotent: re-clicking returns the existing link.
     */
    async function createPaymentLink(id: number) {
        setPaymentBusyIds((prev) => new Set(prev).add(id));
        try {
            const { quote, result } = await apiFetch<CreatePaymentLinkResult>(
                `/admin/api/orgs/${organizationSlug}/quotes/${id}/create-payment-link`,
                { method: 'POST' },
            );
            setQuotes((q) => q?.map((row) => (row.id === id ? quote : row)) ?? null);
            if (result.disabled) {
                toast.warning('Stripe is disabled. Enable it in Connections → Stripe.');
            } else if (result.already_exists) {
                toast.info('Payment link already exists');
            } else if (result.ok) {
                toast.success('Payment link created');
            } else {
                toast.error(`Couldn't create link: ${result.error ?? 'unknown'}`);
            }
        } catch (e) {
            toast.error('Failed to create payment link: ' + e);
        } finally {
            setPaymentBusyIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    }

    async function cancelPaymentLink(id: number) {
        if (!confirm('Deactivate this payment link? Customer will no longer be able to pay through it.')) {
            return;
        }
        setPaymentBusyIds((prev) => new Set(prev).add(id));
        try {
            const { quote, result } = await apiFetch<CreatePaymentLinkResult>(
                `/admin/api/orgs/${organizationSlug}/quotes/${id}/cancel-payment-link`,
                { method: 'POST' },
            );
            setQuotes((q) => q?.map((row) => (row.id === id ? quote : row)) ?? null);
            if (result.ok) {
                toast.success('Payment link deactivated');
            } else {
                toast.error(`Cancel failed: ${result.error ?? '?'}`);
            }
        } catch (e) {
            toast.error('Cancel failed: ' + e);
        } finally {
            setPaymentBusyIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
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
            header: 'PrintLogic',
            id: 'printlogic',
            cell: ({ row }) => {
                const q = row.original;
                const id = q.id;
                const orderId = q.printlogic_order_id ?? null;
                const lastError = q.printlogic_last_error ?? null;
                const pushing = pushingIds.has(id);
                const isDryRun = orderId?.startsWith('DRY-');

                if (pushing) {
                    return (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Loader2 className="h-3 w-3 animate-spin" /> pushing…
                        </span>
                    );
                }

                // Real id pushed — green badge + copy + cancel
                if (orderId && !isDryRun) {
                    return (
                        <div className="flex items-center gap-1.5">
                            <Badge variant="success" className="font-mono">
                                #{orderId}
                            </Badge>
                            <button
                                type="button"
                                title="Copy order id"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    copyOrderId(id, orderId);
                                }}
                                className="text-slate-500 hover:text-slate-900"
                            >
                                {copiedId === id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </button>
                            <Button
                                size="sm"
                                variant="ghost"
                                title="Cancel in PrintLogic"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    cancelPrintLogic(id);
                                }}
                            >
                                <XCircle className="h-3 w-3" />
                            </Button>
                        </div>
                    );
                }

                // DRY-run id — yellow badge + "Promote" (re-push)
                if (orderId && isDryRun) {
                    return (
                        <div className="flex items-center gap-1.5">
                            <Badge variant="warning" className="font-mono">
                                {orderId}
                            </Badge>
                            <Button
                                size="sm"
                                variant="outline"
                                title="Promote — re-push (will hit real PrintLogic if dry_run=false)"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    pushToPrintLogic(id);
                                }}
                            >
                                <Send className="h-3 w-3" /> Promote
                            </Button>
                        </div>
                    );
                }

                // Failed previously — red dot + retry
                if (lastError) {
                    return (
                        <div className="flex items-center gap-1.5">
                            <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {lastError === 'ambiguous_ok' ? 'ambiguous' : 'failed'}
                            </Badge>
                            <Button
                                size="sm"
                                variant="outline"
                                title={lastError}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    pushToPrintLogic(id);
                                }}
                            >
                                <RotateCcw className="h-3 w-3" /> Retry
                            </Button>
                        </div>
                    );
                }

                // Never pushed — show the Push button
                return (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                            e.stopPropagation();
                            pushToPrintLogic(id);
                        }}
                    >
                        <ExternalLink className="h-3 w-3" /> Push
                    </Button>
                );
            },
        },
        {
            header: 'Payment',
            id: 'payment',
            cell: ({ row }) => {
                const q = row.original;
                const id = q.id;
                const url = q.stripe_payment_link_url ?? null;
                const status = q.stripe_payment_status ?? null;
                const lastError = q.stripe_last_error ?? null;
                const busy = paymentBusyIds.has(id);

                if (busy) {
                    return (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Loader2 className="h-3 w-3 animate-spin" /> working…
                        </span>
                    );
                }

                // Paid — green badge, opens Stripe receipt in new tab
                if (status === 'paid') {
                    return (
                        <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Paid €{q.total.toFixed(2)}
                        </Badge>
                    );
                }

                // Refunded — gray badge
                if (status === 'refunded') {
                    return <Badge variant="secondary">Refunded</Badge>;
                }

                // Unpaid + link present — yellow badge + Copy URL + Cancel
                if (status === 'unpaid' && url) {
                    return (
                        <div className="flex items-center gap-1.5">
                            <Badge variant="warning" className="gap-1">
                                <CreditCard className="h-3 w-3" /> Unpaid
                            </Badge>
                            <button
                                type="button"
                                title="Copy payment link"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    copyPaymentUrl(id, url);
                                }}
                                className="text-slate-500 hover:text-slate-900"
                            >
                                {copiedPaymentId === id ? (
                                    <Check className="h-3 w-3" />
                                ) : (
                                    <Copy className="h-3 w-3" />
                                )}
                            </button>
                            <Button
                                size="sm"
                                variant="ghost"
                                title="Deactivate this payment link"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    cancelPaymentLink(id);
                                }}
                            >
                                <Ban className="h-3 w-3" />
                            </Button>
                        </div>
                    );
                }

                // Failed — red badge + retry button
                if (status === 'failed' || (lastError && !url)) {
                    return (
                        <div className="flex items-center gap-1.5">
                            <Badge variant="destructive" className="gap-1" title={lastError ?? undefined}>
                                <AlertTriangle className="h-3 w-3" /> failed
                            </Badge>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    createPaymentLink(id);
                                }}
                            >
                                <RotateCcw className="h-3 w-3" /> Retry
                            </Button>
                        </div>
                    );
                }

                // No link yet — show Create button
                return (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                            e.stopPropagation();
                            createPaymentLink(id);
                        }}
                    >
                        <CreditCard className="h-3 w-3" /> Create link
                    </Button>
                );
            },
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

