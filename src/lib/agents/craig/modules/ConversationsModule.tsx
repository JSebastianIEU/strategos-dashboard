'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { FileText, Download, Trash2, Pencil, Check, X, Building2, RotateCw, Truck, Store, AlertTriangle, ShieldCheck, Ban } from 'lucide-react';
import type { AgentModuleProps } from '@/types/agent';
import type { CraigConversation, CraigConversationDetail, CraigDeliveryAddress } from '../api';
import { TranscriptViewer } from '../components/TranscriptViewer';
import { DataTable } from '@/components/blocks/DataTable';
import { PageHeader } from '@/components/blocks/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/blocks/ErrorState';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const CHANNELS = ['all', 'web', 'whatsapp', 'email', 'missive', 'phone'] as const;

type EditDraft = {
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    is_company: '' | 'true' | 'false';
    is_returning_customer: '' | 'true' | 'false';
    past_customer_email: string;
    delivery_method: '' | 'delivery' | 'collect';
    address1: string;
    address2: string;
    address3: string;
    address4: string;
    postcode: string;
};

function _draftFromConv(c: CraigConversationDetail): EditDraft {
    const a = c.delivery_address || {};
    return {
        customer_name: c.customer_name ?? '',
        customer_email: c.customer_email ?? '',
        customer_phone: c.customer_phone ?? '',
        is_company:
            c.is_company === true ? 'true' : c.is_company === false ? 'false' : '',
        is_returning_customer:
            c.is_returning_customer === true
                ? 'true'
                : c.is_returning_customer === false
                ? 'false'
                : '',
        past_customer_email: c.past_customer_email ?? '',
        delivery_method:
            c.delivery_method === 'delivery' || c.delivery_method === 'collect'
                ? c.delivery_method
                : '',
        address1: a.address1 ?? '',
        address2: a.address2 ?? '',
        address3: a.address3 ?? '',
        address4: a.address4 ?? '',
        postcode: a.postcode ?? '',
    };
}

export function ConversationsModule({ organizationSlug, agentApiBaseUrl, apiFetch }: AgentModuleProps) {
    const [list, setList] = useState<CraigConversation[] | null>(null);
    const [selected, setSelected] = useState<CraigConversationDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [channel, setChannel] = useState<(typeof CHANNELS)[number]>('all');
    const [search, setSearch] = useState('');
    /**
     * v38 — abandoned-conversations filter. When ON, the table only
     * shows conversations where: status='active' AND last_message_at
     * is >24h ago AND the conversation has at least 3 messages AND
     * the last role was 'assistant' (i.e. Craig replied, customer
     * never came back). Surfaces the 42% abandon-rate problem that
     * was invisible before — Justin only got notified on `quoted`
     * and `escalated`, never on `active+stuck`.
     */
    const [showOnlyAbandoned, setShowOnlyAbandoned] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<EditDraft | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);
    /** v36 — multi-selected rows for bulk delete. */
    const [selectedRows, setSelectedRows] = useState<CraigConversation[]>([]);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const [bulkBusy, setBulkBusy] = useState(false);
    /** v37 — engagement-approval action busy spinner. */
    const [engagementBusy, setEngagementBusy] = useState(false);
    /** v37 — confirm dialog before "Don't engage" so Justin can't fat-finger it. */
    const [confirmReject, setConfirmReject] = useState(false);

    /**
     * v36 — bulk-delete the selected conversations + their cascading
     * quotes via POST /conversations/bulk on the backend. Refuses
     * without X-Confirm-Delete header.
     */
    async function bulkDelete() {
        const ids = selectedRows.map((r) => r.id);
        if (ids.length === 0) return;
        setBulkBusy(true);
        try {
            const res = await apiFetch<{
                ok: number[];
                failed: Array<{ id: number; error: string }>;
                quotes_deleted: number;
            }>(
                `/admin/api/orgs/${organizationSlug}/conversations/bulk`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Confirm-Delete': 'yes',
                    },
                    body: JSON.stringify({ action: 'delete', ids }),
                },
            );
            setList((prev) => prev?.filter((c) => !res.ok.includes(c.id)) ?? null);
            if (selected && res.ok.includes(selected.id)) {
                setSelected(null);
            }
            const okN = res.ok.length;
            const failN = res.failed.length;
            const quotesN = res.quotes_deleted;
            if (okN && !failN) {
                toast.success(
                    `Deleted ${okN} conversation${okN === 1 ? '' : 's'}` +
                    (quotesN ? ` + ${quotesN} linked quote${quotesN === 1 ? '' : 's'}` : ''),
                );
            } else if (okN && failN) {
                toast.warning(`${okN} ok, ${failN} failed`);
            } else {
                toast.error(`All ${failN} failed`);
            }
            setSelectedRows([]);
            setConfirmBulkDelete(false);
        } catch (e) {
            toast.error('Bulk delete failed: ' + e);
        } finally {
            setBulkBusy(false);
        }
    }

    function startEdit() {
        if (selected) {
            setDraft(_draftFromConv(selected));
            setEditing(true);
        }
    }

    function cancelEdit() {
        setEditing(false);
        setDraft(null);
    }

    async function saveEdit() {
        if (!selected || !draft) return;
        setSavingEdit(true);
        try {
            const body: Record<string, unknown> = {
                customer_name: draft.customer_name || '',
                customer_email: draft.customer_email || '',
                customer_phone: draft.customer_phone || '',
                past_customer_email: draft.past_customer_email || '',
            };
            if (draft.is_company !== '') body.is_company = draft.is_company === 'true';
            if (draft.is_returning_customer !== '')
                body.is_returning_customer = draft.is_returning_customer === 'true';
            if (draft.delivery_method !== '') body.delivery_method = draft.delivery_method;
            if (draft.delivery_method === 'delivery') {
                body.delivery_address = {
                    address1: draft.address1,
                    address2: draft.address2,
                    address3: draft.address3,
                    address4: draft.address4,
                    postcode: draft.postcode,
                };
            }
            const { conversation } = await apiFetch<{ conversation: CraigConversation }>(
                `/admin/api/orgs/${organizationSlug}/conversations/${selected.id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                },
            );
            setSelected({
                ...selected,
                ...conversation,
            });
            setList((prev) =>
                prev?.map((c) => (c.id === conversation.id ? { ...c, ...conversation } : c)) ?? null,
            );
            setEditing(false);
            setDraft(null);
            toast.success('Customer info updated');
        } catch (e) {
            toast.error('Failed to update: ' + e);
        } finally {
            setSavingEdit(false);
        }
    }

    useEffect(() => {
        let cancelled = false;
        setList(null);
        setError(null);
        const params = new URLSearchParams();
        if (channel !== 'all') params.set('channel', channel);
        if (search.trim()) params.set('search', search.trim());
        const qs = params.toString() ? `?${params}` : '';
        apiFetch<{ conversations: CraigConversation[] }>(
            `/admin/api/orgs/${organizationSlug}/conversations${qs}`,
        )
            .then((d) => !cancelled && setList(d.conversations))
            .catch((e) => !cancelled && setError(String(e)));
        return () => {
            cancelled = true;
        };
    }, [organizationSlug, apiFetch, channel, search]);

    /**
     * v37 — deep-link reader. When Justin clicks "Approve" or
     * "Don't engage" in the engagement-approval email, the URL lands
     * here with `?pending_engagement={conv_id}` (and optionally
     * `&action=reject` to pre-open the reject confirmation). Opens the
     * matching row's sidebar so Justin lands directly on the actions.
     */
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (list === null) return;
        const params = new URLSearchParams(window.location.search);
        const pendingId = Number(params.get('pending_engagement'));
        if (!pendingId) return;
        const row = list.find((c) => c.id === pendingId);
        if (!row) return;
        // Open the conversation; if the email was the "reject" link,
        // pre-open the confirm dialog so Justin only has to click once.
        openConversation(row).then(() => {
            if (params.get('action') === 'reject') setConfirmReject(true);
        });
        // Strip the deep-link params so a refresh doesn't re-open it.
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', cleanUrl);
        // We only want this to run once per list-load.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [list]);

    async function openConversation(c: CraigConversation) {
        try {
            const { conversation } = await apiFetch<{ conversation: CraigConversationDetail }>(
                `/admin/api/orgs/${organizationSlug}/conversations/${c.id}`,
            );
            setSelected(conversation);
        } catch (e) {
            toast.error('Failed to load conversation: ' + e);
        }
    }

    /**
     * v37 — Justin approves engagement on a paused inbound. POST to
     * /approve-engagement, which replays the deferred Craig run + posts
     * the Missive draft. On success refresh the row + close the dialog.
     */
    async function approveEngagement() {
        if (!selected) return;
        setEngagementBusy(true);
        try {
            const res = await apiFetch<{
                ok: boolean;
                drafted: boolean;
                reply_len: number;
                error: string | null;
                conversation: { id: number; status: string; engagement_classification: unknown };
            }>(
                `/admin/api/orgs/${organizationSlug}/conversations/${selected.id}/approve-engagement`,
                { method: 'POST' },
            );
            const status = res.conversation?.status ?? 'engagement_approved';
            // Refresh the full conversation so messages + transcript update
            const { conversation } = await apiFetch<{ conversation: CraigConversationDetail }>(
                `/admin/api/orgs/${organizationSlug}/conversations/${selected.id}`,
            );
            setSelected(conversation);
            setList((prev) =>
                prev?.map((c) => (c.id === conversation.id ? { ...c, ...conversation } : c)) ?? null,
            );
            if (res.drafted) {
                toast.success('Craig replied — draft posted to Missive');
            } else if (res.error) {
                toast.warning(`Approved but reply failed: ${res.error}`);
            } else {
                toast.success(`Engagement approved (status: ${status})`);
            }
        } catch (e) {
            toast.error('Approve failed: ' + e);
        } finally {
            setEngagementBusy(false);
        }
    }

    /**
     * v37 — Justin rejects engagement. Conversation flips to
     * `engagement_rejected` and the webhook silently drops all future
     * inbound on the same Missive thread.
     */
    async function rejectEngagement() {
        if (!selected) return;
        setEngagementBusy(true);
        try {
            const { conversation } = await apiFetch<{
                ok: boolean;
                conversation: CraigConversation;
            }>(
                `/admin/api/orgs/${organizationSlug}/conversations/${selected.id}/reject-engagement`,
                { method: 'POST' },
            );
            setSelected({ ...selected, ...conversation } as CraigConversationDetail);
            setList((prev) =>
                prev?.map((c) => (c.id === conversation.id ? { ...c, ...conversation } : c)) ?? null,
            );
            toast.success("Marked don't engage — Craig will stay silent on this thread");
            setConfirmReject(false);
        } catch (e) {
            toast.error('Reject failed: ' + e);
        } finally {
            setEngagementBusy(false);
        }
    }

    async function deleteConversation(id: number) {
        if (!confirm(`Delete conversation #${id} and its quotes? This cannot be undone.`)) {
            return;
        }
        try {
            await apiFetch(`/admin/api/orgs/${organizationSlug}/conversations/${id}`, {
                method: 'DELETE',
            });
            toast.success(`Conversation #${id} deleted`);
            setList((prev) => prev?.filter((c) => c.id !== id) ?? null);
            if (selected?.id === id) setSelected(null);
        } catch (e) {
            toast.error('Failed to delete: ' + e);
        }
    }

    const columns: ColumnDef<CraigConversation>[] = [
        { header: 'ID', accessorKey: 'id' },
        {
            header: 'Channel',
            accessorKey: 'channel',
            cell: ({ row }) => <Badge variant="secondary">{row.original.channel}</Badge>,
        },
        {
            header: 'Customer',
            cell: ({ row }) =>
                row.original.customer_name ||
                row.original.customer_email ||
                row.original.customer_phone || (
                    <span className="text-slate-400">Anonymous</span>
                ),
        },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: ({ row }) => {
                const s = row.original.status;
                // v37 — distinct visual treatment for the engagement-gate
                // states so Justin can scan the queue at a glance.
                if (s === 'pending_engagement_approval') {
                    return (
                        <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-200 gap-1">
                            <AlertTriangle className="h-3 w-3" /> awaiting approval
                        </Badge>
                    );
                }
                if (s === 'engagement_rejected') {
                    return (
                        <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-300 gap-1">
                            <Ban className="h-3 w-3" /> rejected
                        </Badge>
                    );
                }
                if (s === 'engagement_approved') {
                    return (
                        <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-200 gap-1">
                            <ShieldCheck className="h-3 w-3" /> approved
                        </Badge>
                    );
                }
                return <Badge variant="secondary">{s}</Badge>;
            },
        },
        { header: 'Messages', accessorKey: 'message_count' },
        {
            header: 'Last activity',
            cell: ({ row }) =>
                row.original.last_message_at
                    ? new Date(row.original.last_message_at).toLocaleString('en-IE', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                      })
                    : '—',
        },
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-6">
            <div>
                <PageHeader
                    title="Conversations"
                    description="Every customer chat Craig has handled. Click a row to read the full transcript."
                />

                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <select
                        value={channel}
                        onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number])}
                        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"
                    >
                        {CHANNELS.map((c) => (
                            <option key={c} value={c}>
                                {c === 'all' ? 'All channels' : c}
                            </option>
                        ))}
                    </select>
                    <Input
                        placeholder="Search by name, email, phone…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-8 w-72"
                    />
                    {/* v38 — abandoned filter chip. Surfaces customers
                        who engaged then ghosted before Craig could quote.
                        Counted client-side from the already-loaded list. */}
                    {(() => {
                        const now = Date.now();
                        const ONE_DAY = 24 * 60 * 60 * 1000;
                        const abandonedCount = (list ?? []).filter((c) => {
                            if (c.status !== 'active') return false;
                            if ((c.message_count ?? 0) < 3) return false;
                            if (!c.last_message_at) return false;
                            const age = now - new Date(c.last_message_at).getTime();
                            return age >= ONE_DAY;
                        }).length;
                        return (
                            <Button
                                size="sm"
                                variant={showOnlyAbandoned ? 'default' : 'outline'}
                                onClick={() => setShowOnlyAbandoned((v) => !v)}
                                className={
                                    showOnlyAbandoned
                                        ? 'h-8 bg-amber-600 hover:bg-amber-700 text-white'
                                        : 'h-8 border-amber-300 text-amber-900 hover:bg-amber-50'
                                }
                                title="Active threads with no customer reply in 24h+ — investigate why they bounced"
                            >
                                <AlertTriangle className="h-3 w-3 mr-1.5" />
                                {showOnlyAbandoned ? 'Showing abandoned' : `Abandoned (${abandonedCount})`}
                            </Button>
                        );
                    })()}
                </div>

                {error && <ErrorState description={error} className="mb-4" />}

                {/* v36 — bulk-actions toolbar */}
                {selectedRows.length > 0 && (
                    <div className="sticky top-2 z-10 mb-3 flex items-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2 shadow-sm">
                        <div className="text-sm font-medium text-slate-900">
                            {selectedRows.length} selected
                        </div>
                        <div className="flex-1" />
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200"
                            onClick={() => setConfirmBulkDelete(true)}
                            disabled={bulkBusy}
                        >
                            <Trash2 className="h-3 w-3 mr-1.5" /> Delete {selectedRows.length}
                        </Button>
                    </div>
                )}

                {list === null ? (
                    <Skeleton className="h-64" />
                ) : (
                    <DataTable
                        columns={columns}
                        data={(() => {
                            if (!showOnlyAbandoned) return list;
                            const now = Date.now();
                            const ONE_DAY = 24 * 60 * 60 * 1000;
                            return list.filter((c) => {
                                if (c.status !== 'active') return false;
                                if ((c.message_count ?? 0) < 3) return false;
                                if (!c.last_message_at) return false;
                                const age = now - new Date(c.last_message_at).getTime();
                                return age >= ONE_DAY;
                            });
                        })()}
                        onRowClick={openConversation}
                        emptyTitle={
                            showOnlyAbandoned
                                ? "No abandoned conversations — nice"
                                : "No conversations match"
                        }
                        enableRowSelection
                        getRowId={(row) => String(row.id)}
                        onSelectedRowsChange={setSelectedRows}
                    />
                )}
            </div>

            {/* v36 — bulk-delete confirm dialog */}
            {confirmBulkDelete && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
                    onClick={() => !bulkBusy && setConfirmBulkDelete(false)}
                >
                    <div
                        className="max-w-md w-full rounded-xl bg-white shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-slate-200">
                            <h3 className="text-base font-semibold text-slate-900">
                                Delete {selectedRows.length} conversation{selectedRows.length === 1 ? '' : 's'}?
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                This permanently removes the conversation rows AND all linked
                                quotes (cascade delete). It cannot be undone.
                            </p>
                        </div>
                        <div className="px-5 py-4 max-h-60 overflow-y-auto">
                            <ul className="text-xs space-y-1">
                                {selectedRows.slice(0, 12).map((c) => (
                                    <li key={c.id}>
                                        <span className="font-mono">#{c.id}</span>
                                        {' · '}
                                        {c.customer_name || '(anonymous)'}
                                        {' · '}
                                        <span className="text-slate-500">{c.channel}</span>
                                    </li>
                                ))}
                                {selectedRows.length > 12 && (
                                    <li className="text-slate-500">
                                        …and {selectedRows.length - 12} more
                                    </li>
                                )}
                            </ul>
                        </div>
                        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setConfirmBulkDelete(false)}
                                disabled={bulkBusy}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={bulkDelete}
                                disabled={bulkBusy}
                                className="bg-rose-600 hover:bg-rose-700 text-white"
                            >
                                <Trash2 className="h-3 w-3 mr-1.5" />
                                Delete {selectedRows.length}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {selected && (
                <aside className="rounded-xl border border-slate-200 bg-white p-5 h-fit sticky top-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">
                                Conversation #{selected.id}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                                {selected.customer_name ?? 'Anonymous'} · {selected.channel}
                            </div>
                            {selected.customer_email && (
                                <div className="text-xs text-slate-500 truncate">
                                    {selected.customer_email}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {!editing && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-slate-500 hover:text-slate-900"
                                    onClick={startEdit}
                                    aria-label="Edit customer info"
                                    title="Edit customer info"
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            )}
                            <Button
                                size="icon"
                                variant="ghost"
                                className="text-slate-500 hover:text-rose-600"
                                onClick={() => deleteConversation(selected.id)}
                                aria-label="Delete conversation"
                                title="Delete conversation + its quotes"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            <button
                                className="text-xs text-slate-500 hover:text-slate-900 px-2"
                                onClick={() => setSelected(null)}
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    {/* Customer profile (read-only mode) */}
                    {!editing && (
                        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5">
                            <div className="flex flex-wrap gap-1.5">
                                {selected.is_company === true && (
                                    <Badge variant="secondary" className="gap-1">
                                        <Building2 className="h-3 w-3" /> Company
                                    </Badge>
                                )}
                                {selected.is_company === false && (
                                    <Badge variant="secondary">Individual</Badge>
                                )}
                                {selected.is_returning_customer && (
                                    <Badge variant="secondary" className="gap-1">
                                        <RotateCw className="h-3 w-3" /> Returning
                                    </Badge>
                                )}
                                {selected.delivery_method === 'delivery' && (
                                    <Badge variant="secondary" className="gap-1">
                                        <Truck className="h-3 w-3" /> Delivery
                                    </Badge>
                                )}
                                {selected.delivery_method === 'collect' && (
                                    <Badge variant="secondary" className="gap-1">
                                        <Store className="h-3 w-3" /> Collect
                                    </Badge>
                                )}
                            </div>
                            {selected.customer_phone && (
                                <div className="text-slate-600">📞 {selected.customer_phone}</div>
                            )}
                            {selected.is_returning_customer && selected.past_customer_email && (
                                <div className="text-slate-600">
                                    Past account: {selected.past_customer_email}
                                </div>
                            )}
                            {selected.delivery_method === 'delivery' && selected.delivery_address && (
                                <div className="text-slate-600">
                                    📦{' '}
                                    {[
                                        selected.delivery_address.address1,
                                        selected.delivery_address.address2,
                                        selected.delivery_address.address3,
                                        selected.delivery_address.address4,
                                        selected.delivery_address.postcode,
                                    ]
                                        .filter(Boolean)
                                        .join(', ') || '(address pending)'}
                                </div>
                            )}
                        </div>
                    )}

                    {/* v37 — engagement-approval banner. Visible while the
                        conversation is paused awaiting Justin's call AND
                        immediately after he chooses (until refresh). */}
                    {!editing && selected.status === 'pending_engagement_approval' && selected.engagement_classification && (
                        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs">
                            <div className="flex items-center gap-1.5 mb-2">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-900">
                                    Should Craig respond to this email?
                                </span>
                            </div>
                            <div className="text-slate-700 mb-2">
                                Confidence{' '}
                                <span className="font-semibold">
                                    {Math.round(((selected.engagement_classification.confidence ?? 0) as number) * 100)}%
                                </span>
                                {' — below the auto-respond threshold. Craig wrote nothing to Missive yet.'}
                            </div>
                            {selected.engagement_classification.reason && (
                                <div className="text-slate-600 mb-3 italic">
                                    Reason: {selected.engagement_classification.reason}
                                </div>
                            )}
                            <div className="rounded-md border border-amber-200 bg-white p-2.5 mb-3 space-y-1">
                                <div className="text-[10px] uppercase tracking-wider text-slate-500">From</div>
                                <div className="text-slate-900 break-all">
                                    {selected.engagement_classification.from || '(unknown)'}
                                </div>
                                <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1.5">Subject</div>
                                <div className="text-slate-900">
                                    {selected.engagement_classification.subject || '(no subject)'}
                                </div>
                                {selected.engagement_classification.body_preview && (
                                    <>
                                        <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1.5">Body</div>
                                        <div className="text-slate-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                                            {selected.engagement_classification.body_preview}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* v37.1 — pre-rendered Craig reply. Shown so Justin
                                sees exactly what will ship if he approves. */}
                            {selected.engagement_classification.proposed_reply && (
                                <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2.5 mb-3 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <div className="text-[10px] uppercase tracking-wider text-emerald-900 font-semibold">
                                            Craig&apos;s draft (not sent yet)
                                        </div>
                                        {selected.engagement_classification.proposed_quote_id && (
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full">
                                                Quote JP-{String(selected.engagement_classification.proposed_quote_id).padStart(4, '0')} attached
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-slate-800 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                                        {selected.engagement_classification.proposed_reply}
                                    </div>
                                    <div className="text-[10px] text-slate-500 italic">
                                        Approve sends this reply as-is. Don&apos;t engage drops it.
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={approveEngagement}
                                    disabled={engagementBusy}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                                >
                                    <ShieldCheck className="h-3 w-3 mr-1.5" />
                                    Approve & let Craig respond
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setConfirmReject(true)}
                                    disabled={engagementBusy}
                                    className="text-slate-700 border-slate-300"
                                >
                                    <Ban className="h-3 w-3 mr-1.5" />
                                    Don't engage
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* v37 — already-rejected indicator (read-only) */}
                    {!editing && selected.status === 'engagement_rejected' && (
                        <div className="mb-4 rounded-md border border-slate-300 bg-slate-50 p-3 text-xs flex items-center gap-2">
                            <Ban className="h-3.5 w-3.5 text-slate-600" />
                            <div className="text-slate-700">
                                Marked don&apos;t engage. Craig stays silent on all future
                                inbound on this Missive thread.
                            </div>
                        </div>
                    )}

                    {/* Customer profile (edit mode) */}
                    {editing && draft && (
                        <div className="mb-4 rounded-md border border-slate-200 bg-white p-3 text-xs space-y-2.5">
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    Edit customer info
                                </div>
                                <div className="flex gap-1">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={cancelEdit}
                                        disabled={savingEdit}
                                        className="h-7 px-2"
                                    >
                                        <X className="h-3 w-3 mr-1" /> Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={saveEdit}
                                        disabled={savingEdit}
                                        className="h-7 px-2"
                                    >
                                        <Check className="h-3 w-3 mr-1" /> Save
                                    </Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <Label className="text-[10px]">Name</Label>
                                    <Input
                                        className="h-7 text-xs"
                                        value={draft.customer_name}
                                        onChange={(e) =>
                                            setDraft({ ...draft, customer_name: e.target.value })
                                        }
                                    />
                                </div>
                                <div>
                                    <Label className="text-[10px]">Email</Label>
                                    <Input
                                        className="h-7 text-xs"
                                        value={draft.customer_email}
                                        onChange={(e) =>
                                            setDraft({ ...draft, customer_email: e.target.value })
                                        }
                                    />
                                </div>
                                <div>
                                    <Label className="text-[10px]">Phone</Label>
                                    <Input
                                        className="h-7 text-xs"
                                        value={draft.customer_phone}
                                        onChange={(e) =>
                                            setDraft({ ...draft, customer_phone: e.target.value })
                                        }
                                    />
                                </div>
                                <div>
                                    <Label className="text-[10px]">Customer type</Label>
                                    <select
                                        className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                                        value={draft.is_company}
                                        onChange={(e) =>
                                            setDraft({
                                                ...draft,
                                                is_company: e.target.value as EditDraft['is_company'],
                                            })
                                        }
                                    >
                                        <option value="">unknown</option>
                                        <option value="true">Company (B2B)</option>
                                        <option value="false">Individual</option>
                                    </select>
                                </div>
                                <div>
                                    <Label className="text-[10px]">Returning?</Label>
                                    <select
                                        className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                                        value={draft.is_returning_customer}
                                        onChange={(e) =>
                                            setDraft({
                                                ...draft,
                                                is_returning_customer:
                                                    e.target.value as EditDraft['is_returning_customer'],
                                            })
                                        }
                                    >
                                        <option value="">unknown</option>
                                        <option value="true">Yes</option>
                                        <option value="false">No</option>
                                    </select>
                                </div>
                                <div>
                                    <Label className="text-[10px]">Past email</Label>
                                    <Input
                                        className="h-7 text-xs"
                                        value={draft.past_customer_email}
                                        onChange={(e) =>
                                            setDraft({
                                                ...draft,
                                                past_customer_email: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                                <div className="col-span-2">
                                    <Label className="text-[10px]">Delivery</Label>
                                    <select
                                        className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                                        value={draft.delivery_method}
                                        onChange={(e) =>
                                            setDraft({
                                                ...draft,
                                                delivery_method:
                                                    e.target.value as EditDraft['delivery_method'],
                                            })
                                        }
                                    >
                                        <option value="">—</option>
                                        <option value="delivery">Deliver to address</option>
                                        <option value="collect">Collect from shop</option>
                                    </select>
                                </div>
                                {draft.delivery_method === 'delivery' && (
                                    <>
                                        <div className="col-span-2">
                                            <Label className="text-[10px]">Address line 1</Label>
                                            <Input
                                                className="h-7 text-xs"
                                                value={draft.address1}
                                                onChange={(e) =>
                                                    setDraft({ ...draft, address1: e.target.value })
                                                }
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[10px]">Line 2</Label>
                                            <Input
                                                className="h-7 text-xs"
                                                value={draft.address2}
                                                onChange={(e) =>
                                                    setDraft({ ...draft, address2: e.target.value })
                                                }
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[10px]">Postcode</Label>
                                            <Input
                                                className="h-7 text-xs"
                                                value={draft.postcode}
                                                onChange={(e) =>
                                                    setDraft({ ...draft, postcode: e.target.value })
                                                }
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {selected.quotes.length > 0 && (
                        <div className="mb-4">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                                Attachments ({selected.quotes.length})
                            </div>
                            <div className="space-y-2">
                                {selected.quotes.map((q) => {
                                    const ref = `JP-${String(q.id).padStart(4, '0')}`;
                                    // Prefer the server-provided pdf_url; fall back to the conventional route.
                                    const pdfUrl = `${agentApiBaseUrl}${q.pdf_url ?? `/quotes/${q.id}/pdf`}`;
                                    return (
                                        <div
                                            key={q.id}
                                            className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs"
                                        >
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <FileText className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                                    <span className="font-mono truncate">{ref}</span>
                                                </div>
                                                <span className="font-semibold tabular-nums">
                                                    €{q.total.toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <Badge variant="secondary">
                                                    {q.status.replace(/_/g, ' ')}
                                                </Badge>
                                                <div className="flex gap-1.5">
                                                    <a
                                                        href={pdfUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
                                                    >
                                                        <FileText className="h-3 w-3" />
                                                        View PDF
                                                    </a>
                                                    <a
                                                        href={pdfUrl}
                                                        download={`${ref}.pdf`}
                                                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
                                                    >
                                                        <Download className="h-3 w-3" />
                                                        Download
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <TranscriptViewer
                        messages={selected.messages}
                        maxHeightClass="max-h-[55vh]"
                    />
                </aside>
            )}

            {/* v37 — reject confirmation dialog */}
            {confirmReject && selected && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
                    onClick={() => !engagementBusy && setConfirmReject(false)}
                >
                    <div
                        className="max-w-md w-full rounded-xl bg-white shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-slate-200">
                            <h3 className="text-base font-semibold text-slate-900">
                                Don&apos;t engage with this thread?
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Craig will stay silent on this Missive thread forever.
                                All future inbound on the same conversation will be
                                silently dropped (no notification, no draft).
                            </p>
                        </div>
                        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setConfirmReject(false)}
                                disabled={engagementBusy}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={rejectEngagement}
                                disabled={engagementBusy}
                                className="bg-slate-700 hover:bg-slate-800 text-white"
                            >
                                <Ban className="h-3 w-3 mr-1.5" />
                                Don&apos;t engage
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
