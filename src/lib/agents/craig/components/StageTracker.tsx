/**
 * v33 — horizontal 5-dot timeline showing where this quote is in the
 * lifecycle. Sits at the top of the QuoteDetailSidebar.
 *
 * - Dots up to and including `currentStage` are filled (with a
 *   timestamp tooltip if available).
 * - The current dot is highlighted with the stage color.
 * - Subsequent dots are gray-outlined.
 * - 'rejected' quotes show a separate red badge instead of the timeline.
 */
import type { LifecycleStage } from '../quote-lifecycle';
import { STAGE_META, STAGE_ORDER, deriveStage, stageTimestamps } from '../quote-lifecycle';
import type { CraigQuote } from '../api';

function fmtTimestamp(iso: string | null): string {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString(undefined, {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return iso.slice(0, 16);
    }
}

export interface StageTrackerProps {
    quote: CraigQuote;
}

export function StageTracker({ quote }: StageTrackerProps) {
    const current = deriveStage(quote);
    const ts = stageTimestamps(quote);

    if (current === 'rejected') {
        return (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-xs">
                <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-rose-500" aria-hidden />
                    <span className="font-medium text-rose-800">Rejected</span>
                    {quote.approved_by && (
                        <span className="text-rose-600">by {quote.approved_by}</span>
                    )}
                </div>
            </div>
        );
    }

    const currentIdx = STAGE_ORDER.indexOf(current);

    return (
        <div className="rounded-md border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
                {STAGE_ORDER.map((stage, idx) => {
                    const meta = STAGE_META[stage];
                    const reached = idx <= currentIdx;
                    const isCurrent = idx === currentIdx;
                    const stageTs = ts[stage];
                    return (
                        <div
                            key={stage}
                            className="flex flex-col items-center text-center flex-1 min-w-0"
                            title={
                                stageTs
                                    ? `${meta.label} — ${fmtTimestamp(stageTs)}`
                                    : meta.description
                            }
                        >
                            <div className="flex items-center w-full">
                                {idx > 0 && (
                                    <div
                                        className={[
                                            'flex-1 h-0.5',
                                            reached ? 'bg-slate-700' : 'bg-slate-200',
                                        ].join(' ')}
                                    />
                                )}
                                <div
                                    className={[
                                        'inline-block rounded-full',
                                        isCurrent
                                            ? `${meta.dotClass} w-3.5 h-3.5 ring-2 ring-offset-1 ring-slate-300`
                                            : reached
                                                ? 'bg-slate-700 w-2.5 h-2.5'
                                                : 'bg-white border-2 border-slate-300 w-2.5 h-2.5',
                                    ].join(' ')}
                                />
                                {idx < STAGE_ORDER.length - 1 && (
                                    <div
                                        className={[
                                            'flex-1 h-0.5',
                                            idx < currentIdx ? 'bg-slate-700' : 'bg-slate-200',
                                        ].join(' ')}
                                    />
                                )}
                            </div>
                            <div
                                className={[
                                    'mt-1.5 text-[10px] leading-tight',
                                    isCurrent
                                        ? 'font-semibold text-slate-900'
                                        : reached
                                            ? 'text-slate-700'
                                            : 'text-slate-400',
                                ].join(' ')}
                            >
                                {meta.label}
                            </div>
                            {stageTs && (
                                <div className="text-[9px] text-slate-400 mt-0.5 leading-none">
                                    {fmtTimestamp(stageTs)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
