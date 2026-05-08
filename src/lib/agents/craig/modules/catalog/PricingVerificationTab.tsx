'use client';
/**
 * v34 — Pricing Verification table.
 *
 * Renders every product × representative-quantity pair with the
 * engine's calculated price. Justin scans the table to sanity-check
 * prices, flags rows that look wrong, and leaves a per-row comment.
 * He can export the whole thing to Excel for offline review.
 *
 * Why we need this: the catalog grew large enough that eyeballing
 * each tier in the Products tab isn't tractable. JP-0086 (€24,600
 * vinyl labels) was a smoking gun — Justin couldn't have caught the
 * mismatch from the Products tab alone because the calculated price
 * isn't shown there. This tab surfaces it.
 *
 * For products flagged manual_review_required (per-sq/m, POA), the
 * row carries the escalation reason instead of a price + tints amber.
 */
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Download, RefreshCw, Loader2 } from 'lucide-react';
import type { AgentModuleProps } from '@/types/agent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/blocks/ErrorState';
import { Badge } from '@/components/ui/badge';

interface VerificationRow {
    product_key: string;
    product_name: string;
    category: string;
    pricing_strategy: string;
    pricing_unit: string | null;
    quantity: number;
    spec_key: string | null;
    calculated_price_inc_vat: number | null;
    calculated_price_ex_vat: number | null;
    surcharges_applied: string[];
    escalation_reason?: string | null;
    manual_review_required: boolean;
    internal_notes?: string | null;
    flagged_wrong: boolean;
    comment: string | null;
    flagged_by: string | null;
    updated_at: string | null;
}

export function PricingVerificationTab({
    organizationSlug,
    apiFetch,
}: AgentModuleProps) {
    const [rows, setRows] = useState<VerificationRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [exporting, setExporting] = useState(false);

    async function refresh(showToast = false) {
        setRefreshing(true);
        try {
            const { rows: fetched } = await apiFetch<{ rows: VerificationRow[]; count: number }>(
                `/admin/api/orgs/${organizationSlug}/pricing-verification`,
            );
            setRows(fetched);
            setError(null);
            if (showToast) toast.success(`Refreshed ${fetched.length} rows`);
        } catch (e) {
            setError(String(e));
        } finally {
            setRefreshing(false);
        }
    }

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organizationSlug]);

    /** Bucket rows by category for the per-category table sections. */
    const byCategory = useMemo(() => {
        if (!rows) return new Map<string, VerificationRow[]>();
        const m = new Map<string, VerificationRow[]>();
        for (const r of rows) {
            const list = m.get(r.category) ?? [];
            list.push(r);
            m.set(r.category, list);
        }
        return m;
    }, [rows]);

    /**
     * v34 — flag/comment upsert. Debounced via local state, so typing
     * in the comment input doesn't fire a request per keystroke.
     */
    async function saveFlag(row: VerificationRow, patch: Partial<Pick<VerificationRow, 'flagged_wrong' | 'comment'>>) {
        try {
            await apiFetch(`/admin/api/orgs/${organizationSlug}/pricing-verification/flag`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_key: row.product_key,
                    quantity: row.quantity,
                    spec_key: row.spec_key ?? '',
                    flagged_wrong: patch.flagged_wrong ?? row.flagged_wrong,
                    comment: patch.comment ?? row.comment,
                }),
            });
            // Optimistic update
            setRows((prev) =>
                (prev ?? []).map((r) =>
                    r.product_key === row.product_key &&
                    r.quantity === row.quantity &&
                    (r.spec_key ?? '') === (row.spec_key ?? '')
                        ? { ...r, ...patch }
                        : r,
                ),
            );
        } catch (e) {
            toast.error(`Failed to save flag: ${e}`);
        }
    }

    async function handleExport() {
        if (!rows || rows.length === 0) {
            toast.error('Nothing to export');
            return;
        }
        setExporting(true);
        try {
            // Dynamic import keeps xlsx out of the SSR bundle.
            const XLSX = await import('xlsx');
            const wb = XLSX.utils.book_new();

            // One sheet per category, sorted alphabetically.
            const categories = Array.from(byCategory.keys()).sort();
            for (const cat of categories) {
                const catRows = byCategory.get(cat) ?? [];
                const sheet = catRows.map((r) => ({
                    'Product key': r.product_key,
                    Product: r.product_name,
                    'Strategy': r.pricing_strategy,
                    'Unit': r.pricing_unit ?? '',
                    Qty: r.quantity,
                    'Spec key': r.spec_key ?? '',
                    'Price (inc VAT)': r.calculated_price_inc_vat,
                    'Price (ex VAT)': r.calculated_price_ex_vat,
                    Surcharges: r.surcharges_applied.join(' | '),
                    Status: r.manual_review_required
                        ? `Manual review: ${r.escalation_reason ?? '?'}`
                        : r.escalation_reason
                          ? `Escalated: ${r.escalation_reason}`
                          : 'OK',
                    Flagged: r.flagged_wrong ? 'YES' : '',
                    Comment: r.comment ?? '',
                    'Flagged by': r.flagged_by ?? '',
                    'Internal notes': r.internal_notes ?? '',
                }));
                const ws = XLSX.utils.json_to_sheet(sheet);
                // Sanitize sheet name (Excel forbids :, /, \, ?, *, [, ])
                const safeName = cat.replace(/[/\\?*[\]:]/g, '_').slice(0, 31) || 'Sheet';
                XLSX.utils.book_append_sheet(wb, ws, safeName);
            }

            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const filename = `pricing-verification-${organizationSlug}-${today}.xlsx`;
            XLSX.writeFile(wb, filename);
            toast.success(`Exported ${rows.length} rows to ${filename}`);
        } catch (e) {
            toast.error(`Export failed: ${e}`);
        } finally {
            setExporting(false);
        }
    }

    if (error) return <ErrorState description={error} />;
    if (rows === null) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-10" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
            </div>
        );
    }

    const totalProducts = byCategory.size > 0
        ? Array.from(byCategory.values()).reduce(
              (acc, arr) => acc + new Set(arr.map((r) => r.product_key)).size,
              0,
          )
        : 0;
    const flaggedCount = rows.filter((r) => r.flagged_wrong).length;
    const escalationCount = rows.filter((r) => r.manual_review_required).length;

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-sm text-slate-500 leading-relaxed">
                    Live calculated prices for every product at representative quantities.
                    Flag rows that look wrong + leave a comment so the next pricing review
                    knows what to fix. Manual-review products show the escalation reason
                    instead of a price.
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refresh(true)}
                        disabled={refreshing}
                    >
                        {refreshing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Refresh
                    </Button>
                    <Button size="sm" onClick={handleExport} disabled={exporting || rows.length === 0}>
                        {exporting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                            <Download className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Export to Excel
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{rows.length} rows</Badge>
                <Badge variant="secondary">{totalProducts} products</Badge>
                {escalationCount > 0 && (
                    <Badge variant="outline" className="bg-orange-50 border-orange-200 text-orange-800">
                        {escalationCount} manual-review
                    </Badge>
                )}
                {flaggedCount > 0 && (
                    <Badge variant="outline" className="bg-rose-50 border-rose-200 text-rose-800">
                        {flaggedCount} flagged wrong
                    </Badge>
                )}
            </div>

            {Array.from(byCategory.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([cat, catRows]) => (
                    <CategorySection
                        key={cat}
                        category={cat}
                        rows={catRows}
                        onSaveFlag={saveFlag}
                    />
                ))}
        </div>
    );
}


function CategorySection({
    category,
    rows,
    onSaveFlag,
}: {
    category: string;
    rows: VerificationRow[];
    onSaveFlag: (row: VerificationRow, patch: Partial<Pick<VerificationRow, 'flagged_wrong' | 'comment'>>) => Promise<void>;
}) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white">
            <div className="px-4 py-2 border-b border-slate-200 bg-slate-50">
                <h3 className="text-sm font-semibold capitalize">
                    {category.replace(/_/g, ' ')}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                        ({rows.length} rows)
                    </span>
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Product</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Strategy</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600">Qty</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Spec</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-600">Price inc VAT</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
                            <th className="px-3 py-2 text-center font-medium text-slate-600">Flag</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-600">Comment</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <VerificationRowComponent
                                key={`${r.product_key}-${r.quantity}-${r.spec_key ?? ''}`}
                                row={r}
                                onSaveFlag={onSaveFlag}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}


function VerificationRowComponent({
    row,
    onSaveFlag,
}: {
    row: VerificationRow;
    onSaveFlag: (row: VerificationRow, patch: Partial<Pick<VerificationRow, 'flagged_wrong' | 'comment'>>) => Promise<void>;
}) {
    // Local state for the comment so we can debounce the save
    const [localComment, setLocalComment] = useState<string>(row.comment ?? '');

    // Sync local state when the upstream value changes (e.g. after refresh)
    useEffect(() => {
        setLocalComment(row.comment ?? '');
    }, [row.comment]);

    // Debounced save when comment changes
    useEffect(() => {
        if (localComment === (row.comment ?? '')) return;
        const t = setTimeout(() => {
            void onSaveFlag(row, { comment: localComment || null });
        }, 500);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localComment]);

    const rowBg = row.flagged_wrong
        ? 'bg-rose-50'
        : row.manual_review_required
          ? 'bg-orange-50'
          : '';

    return (
        <tr className={`border-b border-slate-100 ${rowBg}`}>
            <td className="px-3 py-2">
                <div className="font-medium text-slate-900">{row.product_name}</div>
                <div className="font-mono text-[10px] text-slate-500">{row.product_key}</div>
            </td>
            <td className="px-3 py-2 text-slate-700 capitalize whitespace-nowrap">
                {row.pricing_strategy.replace(/_/g, ' ')}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{row.quantity}</td>
            <td className="px-3 py-2 text-slate-600 font-mono text-[10px]">
                {row.spec_key || ''}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
                {row.calculated_price_inc_vat != null ? (
                    <span className="font-medium">€{row.calculated_price_inc_vat.toFixed(2)}</span>
                ) : (
                    <span className="text-slate-400">—</span>
                )}
            </td>
            <td className="px-3 py-2">
                {row.manual_review_required ? (
                    <span className="inline-flex items-center gap-1 text-orange-800 text-[11px]">
                        <AlertTriangle className="h-3 w-3" />
                        {row.escalation_reason ?? 'manual review'}
                    </span>
                ) : row.escalation_reason ? (
                    <span className="text-rose-700 text-[11px]">{row.escalation_reason}</span>
                ) : (
                    <span className="text-emerald-700 text-[11px]">OK</span>
                )}
            </td>
            <td className="px-3 py-2 text-center">
                <input
                    type="checkbox"
                    checked={row.flagged_wrong}
                    onChange={(e) => void onSaveFlag(row, { flagged_wrong: e.target.checked })}
                    className="h-3.5 w-3.5"
                    aria-label="Flag wrong price"
                />
            </td>
            <td className="px-3 py-2">
                <Input
                    value={localComment}
                    onChange={(e) => setLocalComment(e.target.value)}
                    placeholder="Add a note…"
                    className="h-7 text-xs bg-white"
                />
                {row.flagged_by && (
                    <div className="text-[10px] text-slate-400 mt-0.5">
                        by {row.flagged_by}
                    </div>
                )}
            </td>
        </tr>
    );
}
