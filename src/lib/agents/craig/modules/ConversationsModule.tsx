'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { FileText, Download, Trash2 } from 'lucide-react';
import type { AgentModuleProps } from '@/types/agent';
import type { CraigConversation, CraigConversationDetail } from '../api';
import { DataTable } from '@/components/blocks/DataTable';
import { PageHeader } from '@/components/blocks/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/blocks/ErrorState';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const CHANNELS = ['all', 'web', 'whatsapp', 'email', 'missive', 'phone'] as const;

export function ConversationsModule({ organizationSlug, agentApiBaseUrl, apiFetch }: AgentModuleProps) {
    const [list, setList] = useState<CraigConversation[] | null>(null);
    const [selected, setSelected] = useState<CraigConversationDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [channel, setChannel] = useState<(typeof CHANNELS)[number]>('all');
    const [search, setSearch] = useState('');

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
            cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
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
                </div>

                {error && <ErrorState description={error} className="mb-4" />}
                {list === null ? (
                    <Skeleton className="h-64" />
                ) : (
                    <DataTable
                        columns={columns}
                        data={list}
                        onRowClick={openConversation}
                        emptyTitle="No conversations match"
                    />
                )}
            </div>

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

                    <div className="space-y-3 max-h-[55vh] overflow-y-auto">
                        {selected.messages.map((m, i) => (
                            <div
                                key={i}
                                className={
                                    m.role === 'user'
                                        ? 'rounded-lg bg-[var(--color-primary,#040f2a)] text-white p-3 ml-8 text-sm'
                                        : 'rounded-lg bg-slate-100 p-3 mr-8 text-sm'
                                }
                            >
                                <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1">
                                    {m.role}
                                </div>
                                <div className="whitespace-pre-wrap">{m.content}</div>
                            </div>
                        ))}
                    </div>
                </aside>
            )}
        </div>
    );
}
