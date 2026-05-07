/**
 * v33 — compact lifecycle pill, used in the Quotations DataTable rows
 * (replaces the raw `status` cell) and as a label inside the sidebar
 * before the StageTracker.
 *
 * Reads the colour map from `quote-lifecycle.ts` so the row + the
 * tracker + the filter chips all stay visually consistent.
 */
import type { LifecycleStage } from '../quote-lifecycle';
import { STAGE_META } from '../quote-lifecycle';

export interface LifecycleBadgeProps {
    stage: LifecycleStage;
    /** Optional override label (e.g. with a count: "Awaiting (3)") */
    label?: string;
    className?: string;
}

export function LifecycleBadge({ stage, label, className }: LifecycleBadgeProps) {
    const meta = STAGE_META[stage];
    return (
        <span
            className={[
                'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5',
                'text-[11px] font-medium whitespace-nowrap',
                meta.badgeClass,
                className ?? '',
            ].filter(Boolean).join(' ')}
            title={meta.description}
        >
            <span
                className={[
                    'inline-block w-1.5 h-1.5 rounded-full',
                    meta.dotClass,
                ].join(' ')}
                aria-hidden
            />
            <span>{label ?? meta.label}</span>
        </span>
    );
}
