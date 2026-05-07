/**
 * v33 — quote lifecycle derivation.
 *
 * Today the dashboard shows raw fields (status, stripe_payment_status,
 * printlogic_order_id, ...) and the operator has to mentally combine
 * them. This module collapses those fields into ONE LifecycleStage
 * value with a label + color, so the DataTable + sidebar can render
 * a consistent visual story.
 *
 * Six stages (canonical order):
 *
 *   new                 — quote just created, ops not yet notified
 *   awaiting_approval   — ops notified, waiting for Justin's click
 *   approved            — Justin clicked Approve, payment link sent
 *   paid                — customer paid via Stripe
 *   in_production       — pushed to PrintLogic
 *   rejected            — Justin rejected the quote
 *
 * The transition timestamps (notification_sent_at, approved_at,
 * stripe_paid_at, printlogic_pushed_at) drive the StageTracker
 * timeline in the sidebar.
 */
import type { CraigQuote } from './api';

export type LifecycleStage =
    | 'new'
    | 'awaiting_approval'
    | 'approved'
    | 'paid'
    | 'in_production'
    | 'rejected';

export interface StageMeta {
    label: string;
    /** Tailwind color tokens — bg + text + border combined for badges. */
    badgeClass: string;
    /** Color hint for the StageTracker dot. */
    dotClass: string;
    /** Plain-english description shown on hover. */
    description: string;
    /** Position in the timeline (0-indexed). 'rejected' returns -1. */
    order: number;
}

export const STAGE_META: Record<LifecycleStage, StageMeta> = {
    new: {
        label: 'New',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
        dotClass: 'bg-slate-400',
        description: 'Quote just created, the operator has not been notified yet.',
        order: 0,
    },
    awaiting_approval: {
        label: 'Awaiting approval',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        dotClass: 'bg-amber-500',
        description: 'Ops notified by email — waiting for the dashboard Approve click.',
        order: 1,
    },
    approved: {
        label: 'Approved',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
        dotClass: 'bg-blue-500',
        description: 'Approved. Payment link sent to the customer.',
        order: 2,
    },
    paid: {
        label: 'Paid',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        dotClass: 'bg-emerald-500',
        description: 'Customer has paid via Stripe.',
        order: 3,
    },
    in_production: {
        label: 'In production',
        badgeClass: 'bg-violet-100 text-violet-800 border-violet-300',
        dotClass: 'bg-violet-500',
        description: 'Pushed to PrintLogic — the workshop is on it.',
        order: 4,
    },
    rejected: {
        label: 'Rejected',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
        dotClass: 'bg-rose-500',
        description: 'Operator rejected the quote — customer informed manually.',
        order: -1,
    },
};

/** Canonical order for the StageTracker timeline. Excludes "rejected" (terminal off-path). */
export const STAGE_ORDER: LifecycleStage[] = [
    'new',
    'awaiting_approval',
    'approved',
    'paid',
    'in_production',
];

/**
 * Derive the lifecycle stage from a quote row. Pure — no IO. Stable
 * across re-renders given the same input.
 */
export function deriveStage(quote: CraigQuote): LifecycleStage {
    if (quote.status === 'rejected') return 'rejected';

    // Production trumps everything else: if PrintLogic has the order,
    // we're moving paper, regardless of whether the dashboard's status
    // says 'approved' or somebody flipped 'paid'.
    if ((quote.printlogic_order_id ?? '').trim()) return 'in_production';

    if (quote.stripe_payment_status === 'paid') return 'paid';

    if (quote.status === 'approved') return 'approved';

    // status === 'pending_approval' below
    if (quote.notification_sent_at) return 'awaiting_approval';

    return 'new';
}

/**
 * Pull the timestamp on each stage transition for the StageTracker
 * timeline. Returns null for stages that haven't happened yet.
 */
export function stageTimestamps(quote: CraigQuote): Record<LifecycleStage, string | null> {
    return {
        new: quote.created_at ?? null,
        awaiting_approval: quote.notification_sent_at ?? null,
        approved: quote.approved_at ?? null,
        paid: quote.stripe_paid_at ?? null,
        in_production: quote.printlogic_pushed_at ?? null,
        rejected: quote.status === 'rejected' ? (quote.created_at ?? null) : null,
    };
}

/**
 * Count how many quotes are at each stage. Used by the filter chips
 * at the top of the Quotes module ("Awaiting ●5 / Approved ●2 / ...").
 */
export function countByStage(quotes: CraigQuote[]): Record<LifecycleStage, number> {
    const counts: Record<LifecycleStage, number> = {
        new: 0,
        awaiting_approval: 0,
        approved: 0,
        paid: 0,
        in_production: 0,
        rejected: 0,
    };
    for (const q of quotes) {
        counts[deriveStage(q)] += 1;
    }
    return counts;
}
