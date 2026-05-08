'use client';
/**
 * v35 — Test Chat sandbox.
 *
 * Lets JS / Justin chat with Craig in an isolated environment that
 * skips the customer funnel (no artwork question, no contact info,
 * no delivery prompt). Conversations created here are marked
 * is_test=True on the backend and hidden from the regular
 * Conversations + Quotations modules.
 *
 * Layout:
 *   - left rail: list of test conversations (newest first)
 *   - main: active conversation transcript + textarea + send button
 *   - "New conversation" button creates a fresh test conv
 *   - per-row delete button (refuses non-test convs server-side)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Beaker, Plus, Trash2, Send, Loader2 } from 'lucide-react';
import type { AgentModuleProps } from '@/types/agent';
import type { CraigConversation } from '../api';
import { PageHeader } from '@/components/blocks/PageHeader';
import { Button } from '@/components/ui/button';
import { TranscriptViewer } from '../components/TranscriptViewer';

interface TestChatReply {
    reply: string;
    conversation_id: number;
    quote_generated: boolean;
    escalated: boolean;
    tool_calls: unknown[];
}

interface TestConversationFull {
    id: number;
    messages: Array<{ role: string; content: string }>;
}

export function TestChatModule({ organizationSlug, apiFetch }: AgentModuleProps) {
    const [conversations, setConversations] = useState<CraigConversation[] | null>(null);
    const [activeId, setActiveId] = useState<number | null>(null);
    const [activeConv, setActiveConv] = useState<TestConversationFull | null>(null);
    const [draft, setDraft] = useState<string>('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const transcriptEndRef = useRef<HTMLDivElement | null>(null);

    /** v35 — list ONLY test conversations from the backend.
     * Endpoint already exists; we just pass only_test=true. */
    async function refreshList() {
        try {
            const { conversations: cs } = await apiFetch<{ conversations: CraigConversation[] }>(
                `/admin/api/orgs/${organizationSlug}/conversations?only_test=true&limit=50`,
            );
            setConversations(cs);
            // If we don't have an active conversation but there are some,
            // auto-select the most recent one.
            if (cs.length > 0 && activeId === null) {
                setActiveId(cs[0].id);
            }
        } catch (e) {
            setError(String(e));
        }
    }

    /** Load the full transcript for the currently selected conversation. */
    async function loadActive(id: number) {
        try {
            const { conversation } = await apiFetch<{ conversation: TestConversationFull }>(
                `/admin/api/orgs/${organizationSlug}/conversations/${id}`,
            );
            setActiveConv({ id: conversation.id, messages: conversation.messages || [] });
        } catch (e) {
            toast.error(`Failed to load conversation: ${e}`);
        }
    }

    useEffect(() => {
        void refreshList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organizationSlug]);

    useEffect(() => {
        if (activeId !== null) void loadActive(activeId);
        else setActiveConv(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId]);

    // Auto-scroll to bottom when new messages land
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [activeConv?.messages.length]);

    async function sendMessage() {
        const trimmed = draft.trim();
        if (!trimmed) return;
        setSending(true);
        // Optimistically append the user message so UI feels snappy
        if (activeConv) {
            setActiveConv({
                ...activeConv,
                messages: [...activeConv.messages, { role: 'user', content: trimmed }],
            });
        }
        try {
            const result = await apiFetch<TestChatReply>(
                `/admin/api/orgs/${organizationSlug}/test-chat`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conversation_id: activeId,
                        message: trimmed,
                    }),
                },
            );
            setDraft('');
            // After the round-trip, re-load the canonical transcript
            // (server may have appended system messages or re-ordered).
            const newId = result.conversation_id;
            if (activeId === null) {
                setActiveId(newId);
                // refreshList will fetch again and pick up the new row
                await refreshList();
            } else {
                await loadActive(activeId);
                await refreshList();
            }
        } catch (e) {
            toast.error(`Send failed: ${e}`);
        } finally {
            setSending(false);
        }
    }

    async function deleteConv(id: number) {
        if (!confirm('Delete this test conversation? This cannot be undone.')) return;
        try {
            await apiFetch(
                `/admin/api/orgs/${organizationSlug}/test-chat/${id}`,
                { method: 'DELETE' },
            );
            toast.success('Test conversation deleted');
            if (activeId === id) {
                setActiveId(null);
                setActiveConv(null);
            }
            await refreshList();
        } catch (e) {
            toast.error(`Delete failed: ${e}`);
        }
    }

    function startNewConv() {
        setActiveId(null);
        setActiveConv({ id: 0, messages: [] });
        setDraft('');
    }

    /** Format: "1m ago", "2h ago", "Yesterday", "Apr 18" */
    function formatTimestamp(iso: string | null | undefined): string {
        if (!iso) return '';
        const d = new Date(iso);
        const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
        if (diffMin < 1) return 'just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        const diffDay = Math.floor(diffHr / 24);
        if (diffDay === 1) return 'Yesterday';
        if (diffDay < 7) return `${diffDay}d ago`;
        return d.toLocaleDateString('en-IE', { month: 'short', day: 'numeric' });
    }

    const sortedConvs = useMemo(() => {
        if (!conversations) return [];
        return [...conversations].sort((a, b) => {
            const at = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
            return bt - at;
        });
    }, [conversations]);

    if (error) {
        return (
            <div className="space-y-4">
                <PageHeader title="Test Chat" description="Sandbox conversations with Craig" />
                <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <PageHeader
                title="Test Chat"
                description="Sandbox chat with Craig — no funnel, no contact info, no artwork prompts. Test conversations are isolated from real customer data."
            />

            <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
                {/* Left rail */}
                <aside className="rounded-lg border border-slate-200 bg-white p-3 h-fit max-h-[80vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                            Test conversations
                        </h3>
                        <Button size="sm" variant="outline" onClick={startNewConv}>
                            <Plus className="h-3 w-3 mr-1" />
                            New
                        </Button>
                    </div>
                    {sortedConvs.length === 0 ? (
                        <div className="text-xs text-slate-500 italic px-2 py-4">
                            No test conversations yet. Click &ldquo;New&rdquo; or just start typing below.
                        </div>
                    ) : (
                        <ul className="space-y-1">
                            {sortedConvs.map((c) => {
                                const isActive = c.id === activeId;
                                return (
                                    <li key={c.id}>
                                        <div
                                            className={
                                                'group flex items-start gap-2 rounded-md px-2 py-1.5 cursor-pointer text-xs ' +
                                                (isActive
                                                    ? 'bg-[var(--color-primary,#040f2a)] text-white'
                                                    : 'hover:bg-slate-50 text-slate-700')
                                            }
                                            onClick={() => setActiveId(c.id)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">
                                                    {c.last_message_preview || `Conv #${c.id}`}
                                                </div>
                                                <div
                                                    className={
                                                        'text-[10px] mt-0.5 ' +
                                                        (isActive ? 'text-white/70' : 'text-slate-500')
                                                    }
                                                >
                                                    {formatTimestamp(c.last_message_at || c.created_at)}
                                                    {' · '}{c.message_count ?? 0} msg
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    void deleteConv(c.id);
                                                }}
                                                className={
                                                    'opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded ' +
                                                    (isActive
                                                        ? 'hover:bg-white/10 text-white/70'
                                                        : 'hover:bg-rose-100 text-rose-500')
                                                }
                                                title="Delete this test conversation"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </aside>

                {/* Main chat */}
                <main className="rounded-lg border border-slate-200 bg-white flex flex-col min-h-[600px] max-h-[80vh]">
                    {/* Header banner */}
                    <div className="px-4 py-2 border-b border-slate-200 bg-blue-50">
                        <div className="flex items-center gap-2 text-xs text-blue-900">
                            <Beaker className="h-3.5 w-3.5" />
                            <span className="font-semibold uppercase tracking-wider">
                                Sandbox mode
                            </span>
                            <span className="text-blue-700">
                                · No funnel. Test prices, ask &ldquo;why&rdquo;, debug edge cases.
                            </span>
                        </div>
                    </div>

                    {/* Transcript */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {activeConv && activeConv.messages.length > 0 ? (
                            <>
                                <TranscriptViewer
                                    messages={activeConv.messages}
                                    maxHeightClass=""
                                />
                                <div ref={transcriptEndRef} />
                            </>
                        ) : (
                            <div className="text-center text-slate-500 italic text-sm py-12">
                                {activeConv === null ? (
                                    <>
                                        Pick a conversation from the left, or just type a message
                                        below to start a new one.
                                    </>
                                ) : (
                                    <>
                                        Start chatting with Craig. Try things like:
                                        <ul className="text-left max-w-md mx-auto mt-3 list-disc list-inside text-xs">
                                            <li>&ldquo;Quote me 530 business cards&rdquo;</li>
                                            <li>&ldquo;100 A5 saddle stitch booklets, 16pp self cover&rdquo;</li>
                                            <li>&ldquo;What&apos;s the price for 250 NCR pads A4 triplicate?&rdquo;</li>
                                            <li>&ldquo;500 vinyl labels&rdquo; (should escalate)</li>
                                        </ul>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div className="border-t border-slate-200 p-3">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                void sendMessage();
                            }}
                            className="flex gap-2 items-end"
                        >
                            <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        void sendMessage();
                                    }
                                }}
                                placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                                rows={2}
                                disabled={sending}
                                className="flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                            <Button type="submit" disabled={sending || !draft.trim()}>
                                {sending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </form>
                    </div>
                </main>
            </div>
        </div>
    );
}
