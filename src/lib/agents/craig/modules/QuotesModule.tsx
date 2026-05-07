'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import type { CraigArtworkFile, CraigQuote, CreatePaymentLinkResult, PushToPrintLogicResult, QuoteStatus } from '../api';
import { deriveStage, countByStage, STAGE_META, STAGE_ORDER } from '../quote-lifecycle';
import type { LifecycleStage } from '../quote-lifecycle';
import { LifecycleBadge } from '../components/LifecycleBadge';
import { StageTracker } from '../components/StageTracker';
import { TranscriptViewer } from '../components/TranscriptViewer';
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
    const [status, setStatus] = useState<QuoteStatus | 'all'>('all');
    const [channel, setChannel] = useState<string | 'all'>('all');
    // v33 — lifecycle-stage filter. Defaults to 'awaiting_approval'
    // because that's the queue Justin opens the dashboard FOR. Click
    // 'All' to see everything, or pick a different stage to drill in.
    const [stageFilter, setStageFilter] = useState<LifecycleStage | 'all'>('awaiting_approval');
    const [search, setSearch] = useState('');
    const [pdfQuote, setPdfQuote] = useState<CraigQuote | null>(null);
    /** Phase G — quote selected for the right-side detail panel (row click). */
    const [selectedQuote, setSelectedQuote] = useState<CraigQuote | null>(null);
    /** Conversation hydrated for the selected quote (lazy fetch on row click). */
    const [selectedConv, setSelectedConv] = useState<{
        customer_name?: string | null;
        customer_email?: string | null;
        customer_phone?: string | null;
        is_company?: boolean | null;
        is_returning_customer?: boolean | null;
        past_customer_email?: string | null;
        delivery_method?: string | null;
        delivery_address?: { address1?: string; address2?: string; address3?: string; address4?: string; postcode?: string } | null;
        customer_has_own_artwork?: boolean | null;
        artwork_will_send_later?: boolean;
        // v33 — full conversation transcript (rendered inline in the sidebar).
        messages?: Array<{ role: string; content: string }>;
    } | null>(null);
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

    // v33 — deep link from operator notification email. The Resend
    // template links to `?focus_quote=<id>`; when that param is set
    // and the quote is in our list, auto-open the sidebar + scroll
    // it into view. Only runs once per fresh mount + after quotes load.
    const searchParams = useSearchParams();
    const focusQuoteParam = searchParams?.get('focus_quote') ?? null;
    useEffect(() => {
        if (!focusQuoteParam || !quotes || quotes.length === 0) return;
        const wantId = parseInt(focusQuoteParam, 10);
        if (Number.isNaN(wantId)) return;
        // Make sure the stage filter doesn't hide the focused row.
        // Switching to 'all' is the safest default for arrived-from-email.
        setStageFilter('all');
        const target = quotes.find((q) => q.id === wantId);
        if (target) {
            void openQuoteDetail(target);
            // Scroll into view after the sidebar mounts
            setTimeout(() => {
                const el = document.querySelector<HTMLElement>(
                    `aside[data-quote-id="${wantId}"]`,
                );
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 200);
        }
        // Intentionally only run on the first quotes load OR when the
        // param changes; subsequent re-renders shouldn't re-open.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusQuoteParam, quotes]);

    /** v33 — stage counts for the chip badges. Always reflects the
     *  full unfiltered set so the chips show the right totals
     *  regardless of which stage is currently selected. */
    const stageCounts = useMemo(
        () => (quotes ? countByStage(quotes) : null),
        [quotes],
    );

    const filtered = useMemo(() => {
        if (!quotes) return [];
        let out = quotes;
        if (stageFilter !== 'all') {
            out = out.filter((row) => deriveStage(row) === stageFilter);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            out = out.filter(
                (row) =>
                    row.product_key.toLowerCase().includes(q) ||
                    String(row.id).includes(q),
            );
        }
        return out;
    }, [quotes, search, stageFilter]);

    async function openQuoteDetail(q: CraigQuote) {
        setSelectedQuote(q);
        setSelectedConv(null);
        if (!q.conversation_id) return;
        try {
            const data = await apiFetch<{ conversation: typeof selectedConv }>(
                `/admin/api/orgs/${organizationSlug}/conversations/${q.conversation_id}`,
            );
            setSelectedConv(data.conversation);
        } catch {
            // sidebar still opens with quote-only data; conv lookup is best-effort
        }
    }

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
            cell: ({ row }) => {
                const q = row.original;
                const shipping = q.shipping_cost_inc_vat ?? 0;
                return (
                    <div className="flex flex-col leading-tight">
                        <span className="font-semibold tabular-nums">
                            €{q.total.toFixed(2)}
                        </span>
                        {shipping > 0 && (
                            <span className="text-[10px] text-slate-500 tabular-nums">
                                incl. €{shipping.toFixed(2)} delivery
                            </span>
                        )}
                    </div>
                );
            },
        },
        {
            header: 'Artwork',
            id: 'artwork',
            cell: ({ row }) => {
                const q = row.original;
                if (!q.artwork_file_url) {
                    return <span className="text-xs text-slate-400">—</span>;
                }
                const sizeKb = q.artwork_file_size
                    ? Math.round(q.artwork_file_size / 1024)
                    : null;
                return (
                    <a
                        href={q.artwork_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={q.artwork_file_name ?? ''}
                        className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline truncate max-w-[160px]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        📎 {q.artwork_file_name ?? 'file'}
                        {sizeKb !== null && (
                            <span className="text-slate-400">
                                ({sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)}MB` : `${sizeKb}KB`})
                            </span>
                        )}
                    </a>
                );
            },
        },
        {
            header: 'Stage',
            accessorKey: 'status',
            cell: ({ row }) => (
                <LifecycleBadge stage={deriveStage(row.original)} />
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

            {/* v33 — lifecycle-stage filter chips. The "All" chip
                shows the total count; each stage chip shows its own
                count. Default is "Awaiting approval" because that's
                the queue Justin opens the dashboard for. */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <FilterChip
                        label={`All${stageCounts ? ` (${quotes?.length ?? 0})` : ''}`}
                        active={stageFilter === 'all'}
                        onClick={() => setStageFilter('all')}
                    />
                    {STAGE_ORDER.map((stage) => {
                        const count = stageCounts?.[stage] ?? 0;
                        return (
                            <FilterChip
                                key={stage}
                                label={`${STAGE_META[stage].label}${count ? ` (${count})` : ''}`}
                                active={stageFilter === stage}
                                onClick={() => setStageFilter(stage)}
                            />
                        );
                    })}
                    {stageCounts && stageCounts.rejected > 0 && (
                        <FilterChip
                            label={`${STAGE_META.rejected.label} (${stageCounts.rejected})`}
                            active={stageFilter === 'rejected'}
                            onClick={() => setStageFilter('rejected')}
                        />
                    )}
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

            <div className={selectedQuote ? "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_440px] gap-6" : ""}>
                <div>
                    {quotes === null ? (
                        <Skeleton className="h-64" />
                    ) : (
                        <DataTable
                            columns={columns}
                            data={filtered}
                            emptyTitle="No quotes match"
                            emptyDescription="Adjust your filters or wait for Craig to produce a new quote."
                            onRowClick={openQuoteDetail}
                        />
                    )}
                </div>

                {selectedQuote && (
                    <QuoteDetailSidebar
                        quote={selectedQuote}
                        conv={selectedConv}
                        organizationSlug={organizationSlug}
                        agentApiBaseUrl={agentApiBaseUrl}
                        onClose={() => { setSelectedQuote(null); setSelectedConv(null); }}
                        apiFetch={apiFetch}
                    />
                )}
            </div>

            <PdfDrawer
                open={!!pdfQuote}
                onClose={() => setPdfQuote(null)}
                title={pdfQuote ? `Quote JP-${String(pdfQuote.id).padStart(4, '0')}` : ''}
                url={pdfQuote ? `${agentApiBaseUrl}/quotes/${pdfQuote.id}/pdf` : ''}
            />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Phase G — Quote detail sidebar (right panel)
// Renders the full Quote + parent Conversation funnel data, artwork
// previews, shipping breakdown, and the existing action buttons.
// ─────────────────────────────────────────────────────────────────────

interface QuoteDetailSidebarProps {
    quote: CraigQuote;
    conv: {
        customer_name?: string | null;
        customer_email?: string | null;
        customer_phone?: string | null;
        is_company?: boolean | null;
        is_returning_customer?: boolean | null;
        past_customer_email?: string | null;
        delivery_method?: string | null;
        delivery_address?: { address1?: string; address2?: string; address3?: string; address4?: string; postcode?: string } | null;
        customer_has_own_artwork?: boolean | null;
        // v30 — set when customer chose "I'll send my artwork later".
        // Drives the yellow "Artwork pending" badge in the sidebar.
        artwork_will_send_later?: boolean;
        // v33 — full conversation transcript for the inline TranscriptViewer.
        messages?: Array<{ role: string; content: string }>;
    } | null;
    organizationSlug: string;
    agentApiBaseUrl: string;
    onClose: () => void;
    apiFetch: AgentModuleProps['apiFetch'];
}

function QuoteDetailSidebar({ quote, conv, organizationSlug, agentApiBaseUrl, onClose, apiFetch }: QuoteDetailSidebarProps) {
    void apiFetch; // not used here — sidebar reads quote+conv from props
    void agentApiBaseUrl;

    /**
     * Build a URL the dashboard browser can hit. Uses the dashboard's
     * Next.js binary-proxy route so the JWT stays server-side. Inputs
     * to that route: ?agent=craig&client={slug}&path=/admin/api/...
     */
    function fileProxyUrl(file: CraigArtworkFile): string {
        const path = file.url.replace('{org}', organizationSlug);
        const qs = new URLSearchParams({
            agent: 'craig',
            client: organizationSlug,
            path,
        });
        return `/api/agent-binary?${qs.toString()}`;
    }

    const ref = `JP-${String(quote.id).padStart(4, '0')}`;
    const goods = Number(quote.final_price_inc_vat || 0);
    const shipping = Number(quote.shipping_cost_inc_vat || 0);
    const artwork = Number(quote.artwork_cost || 0) * 1.23; // ex VAT * 23%
    const total = Number(quote.total || (goods + shipping));
    const addr = conv?.delivery_address;
    const addrLine = addr
        ? [addr.address1, addr.address2, addr.address3, addr.address4, addr.postcode].filter(Boolean).join(', ')
        : null;

    return (
        <aside
            data-quote-id={quote.id}
            className="rounded-xl border border-slate-200 bg-white p-5 h-fit sticky top-6 max-h-[88vh] overflow-y-auto"
        >
            <div className="flex items-start justify-between mb-3">
                <div>
                    <div className="text-sm font-semibold text-slate-900">Quote {ref}</div>
                    <div className="mt-1 text-xs text-slate-500">
                        {quote.product_key}
                    </div>
                </div>
                <button
                    type="button"
                    className="text-xs text-slate-500 hover:text-slate-900 px-2"
                    onClick={onClose}
                >
                    Close
                </button>
            </div>

            {/* v33 — Lifecycle stage tracker */}
            <div className="mb-4">
                <StageTracker quote={quote} />
            </div>

            {/* v33 — surface notification errors so Justin can retry */}
            {quote.notification_last_error && !quote.notification_sent_at && (
                <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-800">
                    <strong className="font-semibold">Notification not sent: </strong>
                    {quote.notification_last_error}
                </div>
            )}

            {/* Customer */}
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5 mb-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Customer</div>
                <div className="font-medium text-slate-900">{conv?.customer_name ?? '—'}</div>
                {conv?.customer_email && <div className="text-slate-700">{conv.customer_email}</div>}
                {conv?.customer_phone && <div className="text-slate-700">{conv.customer_phone}</div>}
                <div className="flex flex-wrap gap-1.5 pt-1">
                    {conv?.is_company === true && <Badge variant="secondary">Company</Badge>}
                    {conv?.is_company === false && <Badge variant="secondary">Individual</Badge>}
                    {conv?.is_returning_customer && <Badge variant="secondary">Returning</Badge>}
                    {conv?.delivery_method === 'delivery' && <Badge variant="secondary">Delivery</Badge>}
                    {conv?.delivery_method === 'collect' && <Badge variant="secondary">Collection</Badge>}
                </div>
                {conv?.is_returning_customer && conv.past_customer_email && (
                    <div className="text-slate-600 pt-1">Past account: {conv.past_customer_email}</div>
                )}
                {addrLine && (
                    <div className="text-slate-600 pt-1">📦 {addrLine}</div>
                )}
            </div>

            {/* Pricing breakdown */}
            <div className="rounded-md border border-slate-200 bg-white p-3 text-xs space-y-1 mb-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Pricing</div>
                <div className="flex justify-between">
                    <span>Goods (inc VAT)</span>
                    <span className="tabular-nums">€{goods.toFixed(2)}</span>
                </div>
                {artwork > 0 && (
                    <div className="flex justify-between">
                        <span>Design service (inc VAT)</span>
                        <span className="tabular-nums">€{artwork.toFixed(2)}</span>
                    </div>
                )}
                {shipping > 0 ? (
                    <div className="flex justify-between">
                        <span>Just Print Delivery</span>
                        <span className="tabular-nums">€{shipping.toFixed(2)}</span>
                    </div>
                ) : (conv?.delivery_method === 'delivery') ? (
                    <div className="flex justify-between text-emerald-700">
                        <span>Delivery</span>
                        <span className="tabular-nums">FREE (over €100)</span>
                    </div>
                ) : null}
                <div className="flex justify-between font-semibold border-t border-slate-200 pt-1 mt-1">
                    <span>Total inc VAT</span>
                    <span className="tabular-nums">€{total.toFixed(2)}</span>
                </div>
            </div>

            {/* v30 — Artwork pending badge: customer chose "I'll send
                my artwork later" and no files have arrived yet. */}
            {conv?.artwork_will_send_later && (!quote.artwork_files || quote.artwork_files.length === 0) && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs mb-4">
                    <div className="flex items-start gap-2">
                        <span className="text-base leading-none">⏳</span>
                        <div>
                            <div className="font-semibold text-amber-900">Artwork pending</div>
                            <div className="text-amber-800 mt-0.5">
                                Customer said they&apos;ll send the artwork later. Don&apos;t push to PrintLogic until they&apos;ve sent it.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Artwork files */}
            {quote.artwork_files && quote.artwork_files.length > 0 && (
                <div className="rounded-md border border-slate-200 bg-white p-3 text-xs space-y-2 mb-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Artwork ({quote.artwork_files.length})
                    </div>
                    {quote.artwork_files.map((f, i) => {
                        const proxyUrl = fileProxyUrl(f);
                        const isImage = (f.content_type ?? '').startsWith('image/');
                        const sizeMb = (f.size / (1024 * 1024)).toFixed(1);
                        return (
                            <div key={i} className="rounded-md border border-slate-100 bg-slate-50 p-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-base">📎</span>
                                    <span className="font-medium text-slate-900 truncate flex-1" title={f.filename}>
                                        {f.filename}
                                    </span>
                                    <span className="text-slate-500 text-[10px]">{sizeMb} MB</span>
                                </div>
                                {isImage && (
                                    <a href={proxyUrl} target="_blank" rel="noopener noreferrer">
                                        <img
                                            src={proxyUrl}
                                            alt={f.filename}
                                            className="mt-2 max-h-44 w-full object-contain rounded bg-white cursor-zoom-in"
                                        />
                                    </a>
                                )}
                                <div className="flex gap-3 mt-2">
                                    <a
                                        href={proxyUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-700 hover:underline text-[11px]"
                                    >
                                        Open in tab ↗
                                    </a>
                                    <a
                                        href={proxyUrl}
                                        download={f.filename}
                                        className="text-blue-700 hover:underline text-[11px]"
                                    >
                                        Download
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Specs JSON */}
            {Object.keys(quote.specs as Record<string, unknown>).length > 0 && (
                <div className="rounded-md border border-slate-200 bg-white p-3 text-xs space-y-1 mb-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Specs</div>
                    <pre className="font-mono text-[11px] text-slate-700 whitespace-pre-wrap break-all">
                        {JSON.stringify(quote.specs, null, 2)}
                    </pre>
                </div>
            )}

            {/* v33 — inline conversation transcript so Justin can read
                what Craig said to the customer without leaving the
                Quotations tab. Capped at 40vh so it doesn't push the
                Approve action below the fold. */}
            {conv && Array.isArray((conv as { messages?: unknown }).messages) && (
                <div className="rounded-md border border-slate-200 bg-white p-3 text-xs space-y-2 mb-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Conversation transcript
                    </div>
                    <TranscriptViewer
                        messages={(conv as { messages: Array<{ role: string; content: string }> }).messages}
                        maxHeightClass="max-h-[40vh]"
                    />
                </div>
            )}

            {/* Integration state */}
            <div className="rounded-md border border-slate-200 bg-white p-3 text-xs space-y-1.5 mb-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Integrations</div>
                {quote.stripe_payment_link_url && (
                    <div>
                        <span className="text-slate-500">Stripe: </span>
                        <Badge variant={quote.stripe_payment_status === 'paid' ? 'success' : 'secondary'}>
                            {quote.stripe_payment_status ?? 'unpaid'}
                        </Badge>
                        {' '}
                        <a
                            href={quote.stripe_payment_link_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 hover:underline ml-1"
                        >
                            Payment link ↗
                        </a>
                    </div>
                )}
                {quote.printlogic_order_id && (
                    <div>
                        <span className="text-slate-500">PrintLogic: </span>
                        <code className="font-mono">{quote.printlogic_order_id}</code>
                        {quote.printlogic_order_id.startsWith('DRY-') && (
                            <Badge variant="secondary" className="ml-1">DRY</Badge>
                        )}
                    </div>
                )}
                {quote.missive_draft_id && (
                    <div>
                        <span className="text-slate-500">Missive draft: </span>
                        <code className="font-mono">{quote.missive_draft_id.slice(0, 12)}…</code>
                    </div>
                )}
                {!quote.stripe_payment_link_url && !quote.printlogic_order_id && !quote.missive_draft_id && (
                    <div className="text-slate-500 italic">No integrations fired yet.</div>
                )}
            </div>
        </aside>
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

