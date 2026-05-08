'use client';
/**
 * v35 — Customer-reported issues from the widget Report Issue link.
 *
 * Lists IssueReport rows. Each row shows the customer's free-text
 * complaint + a link to the full conversation (if any). JS / Justin
 * can mark them resolved or dismissed.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, XCircle, Mail, MessageSquare, Loader2 } from 'lucide-react';
import type { AgentModuleProps } from '@/types/agent';
import { PageHeader } from '@/components/blocks/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/blocks/ErrorState';

interface CraigIssue {
    id: number;
    conversation_id: number | null;
    customer_email: string | null;
    customer_name: string | null;
    channel: string | null;
    message: string;
    status: 'open' | 'resolved' | 'dismissed';
    reviewed_by: string | null;
    reviewed_at: string | null;
    resolution_notes: string | null;
    notification_sent_at: string | null;
    notification_last_error: string | null;
    created_at: string | null;
}

export function IssuesModule({ organizationSlug, apiFetch }: AgentModuleProps) {
    const [issues, setIssues] = useState<CraigIssue[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'open' | 'resolved' | 'dismissed'>('open');
    const [busyId, setBusyId] = useState<number | null>(null);

    async function refresh() {
        try {
            const qs = filter === 'all' ? '' : `?status=${filter}`;
            const { issues: rows } = await apiFetch<{ issues: CraigIssue[] }>(
                `/admin/api/orgs/${organizationSlug}/issues${qs}`,
            );
            setIssues(rows);
            setError(null);
        } catch (e) {
            setError(String(e));
        }
    }

    useEffect(() => {
        void refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organizationSlug, filter]);

    async function updateStatus(id: number, status: 'resolved' | 'dismissed' | 'open') {
        setBusyId(id);
        try {
            await apiFetch<{ issue: CraigIssue }>(
                `/admin/api/orgs/${organizationSlug}/issues/${id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status }),
                },
            );
            toast.success(
                status === 'resolved' ? 'Issue marked resolved'
                    : status === 'dismissed' ? 'Issue dismissed'
                        : 'Issue re-opened',
            );
            await refresh();
        } catch (e) {
            toast.error(`Update failed: ${e}`);
        } finally {
            setBusyId(null);
        }
    }

    if (error) {
        return (
            <div className="space-y-4">
                <PageHeader title="Issues" description="Customer-reported issues" />
                <ErrorState description={error} />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <PageHeader
                title="Issues"
                description="Customer-reported problems from the widget. Each issue triggered an admin alert email when it was submitted."
            />

            {/* Filter chips */}
            <div className="flex gap-2 flex-wrap">
                {(['open', 'resolved', 'dismissed', 'all'] as const).map((f) => {
                    const count = issues
                        ? f === 'all'
                            ? issues.length
                            : issues.filter((i) => i.status === f).length
                        : null;
                    return (
                        <button
                            key={f}
                            type="button"
                            onClick={() => setFilter(f)}
                            className={
                                'rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                                (filter === f
                                    ? 'bg-[var(--color-primary,#040f2a)] text-white border-transparent'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
                            }
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                            {count != null && f === filter && (
                                <span className="ml-1.5 opacity-70">·{count}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {issues === null ? (
                <div className="space-y-2">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                </div>
            ) : issues.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    <AlertTriangle className="mx-auto h-8 w-8 mb-2 text-slate-400" />
                    No {filter === 'all' ? '' : filter + ' '}issues right now. 🎉
                </div>
            ) : (
                <div className="space-y-3">
                    {issues.map((issue) => (
                        <IssueCard
                            key={issue.id}
                            issue={issue}
                            busy={busyId === issue.id}
                            onResolve={() => updateStatus(issue.id, 'resolved')}
                            onDismiss={() => updateStatus(issue.id, 'dismissed')}
                            onReopen={() => updateStatus(issue.id, 'open')}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}


function IssueCard({
    issue,
    busy,
    onResolve,
    onDismiss,
    onReopen,
}: {
    issue: CraigIssue;
    busy: boolean;
    onResolve: () => void;
    onDismiss: () => void;
    onReopen: () => void;
}) {
    const statusBadge = issue.status === 'open' ? (
        <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-800">
            Open
        </Badge>
    ) : issue.status === 'resolved' ? (
        <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-800">
            Resolved
        </Badge>
    ) : (
        <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-600">
            Dismissed
        </Badge>
    );

    const created = issue.created_at ? new Date(issue.created_at) : null;
    const createdStr = created
        ? created.toLocaleString('en-IE', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        })
        : '';

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-slate-900">
                            {issue.customer_name || '(anonymous)'}
                        </span>
                        {statusBadge}
                        {issue.channel && (
                            <Badge variant="secondary">{issue.channel}</Badge>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {issue.customer_email && (
                            <span className="inline-flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {issue.customer_email}
                            </span>
                        )}
                        {issue.conversation_id && (
                            <span className="inline-flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                Conv #{issue.conversation_id}
                            </span>
                        )}
                        <span>{createdStr}</span>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-md p-3 my-3 text-sm text-slate-700 whitespace-pre-wrap">
                {issue.message}
            </div>

            {issue.notification_last_error && (
                <div className="mb-3 text-[11px] text-amber-700">
                    ⚠️ Admin alert email failed: {issue.notification_last_error}
                </div>
            )}

            {issue.reviewed_by && issue.reviewed_at && (
                <div className="text-[11px] text-slate-500 mb-2">
                    Reviewed by {issue.reviewed_by} on{' '}
                    {new Date(issue.reviewed_at).toLocaleString('en-IE')}
                    {issue.resolution_notes && (
                        <div className="mt-1 italic">&ldquo;{issue.resolution_notes}&rdquo;</div>
                    )}
                </div>
            )}

            <div className="flex gap-2 flex-wrap mt-2">
                {issue.status === 'open' ? (
                    <>
                        <Button
                            size="sm"
                            onClick={onResolve}
                            disabled={busy}
                            variant="outline"
                            className="bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800"
                        >
                            {busy ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1.5" />}
                            Mark resolved
                        </Button>
                        <Button
                            size="sm"
                            onClick={onDismiss}
                            disabled={busy}
                            variant="outline"
                        >
                            <XCircle className="h-3 w-3 mr-1.5" />
                            Dismiss
                        </Button>
                    </>
                ) : (
                    <Button size="sm" variant="outline" onClick={onReopen} disabled={busy}>
                        Re-open
                    </Button>
                )}
            </div>
        </div>
    );
}
