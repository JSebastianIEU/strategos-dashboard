/**
 * Product / category / tier schemas — used by both the UI form and the
 * server action / proxy validation.
 */
import { z } from 'zod';

export const PRICING_STRATEGIES = [
    'tiered',
    'per_unit',
    'per_unit_metric',
    'bulk_break',
    'per_job',
] as const;
export type PricingStrategy = (typeof PRICING_STRATEGIES)[number];

export const PRICING_STRATEGY_LABELS: Record<PricingStrategy, string> = {
    tiered: 'Per-quantity price tiers (look up by qty)',
    per_unit: 'Per-unit (price × quantity)',
    per_unit_metric: 'Per square-meter / kilo / hour (asks for dimensions)',
    bulk_break: 'Volume discount above threshold',
    per_job: 'Single fixed price per job',
};

/**
 * v34 — short hint shown next to each strategy option in the
 * ProductFormDialog. Helps non-technical operators understand
 * which one they want.
 */
export const PRICING_STRATEGY_HINTS: Record<PricingStrategy, string> = {
    tiered: 'Used for: business cards, flyers, postcards, pads. Each quantity (e.g. 100, 250, 500) has its own price set in the tiers table.',
    per_unit: 'Used for: roller banners, foamex boards, dibond. Price = unit price × quantity. Bulk threshold optional.',
    per_unit_metric: 'Used for: vinyl, banners, fabric where size matters. Engine multiplies the metric unit (e.g. m²) by the quantity. Currently flagged manual_review.',
    bulk_break: 'Used when: there are TWO prices — one for low qty, one for bulk above a threshold (e.g. unit_price=€35, bulk_price=€28, bulk_threshold=10).',
    per_job: 'Used for: booklets — a single fixed price for a complete spec (format + binding + pages + cover). Tiers carry the actual prices keyed by spec_key.',
};

const slug = z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9_]+$/, 'lowercase letters, digits and underscores only')
    .optional();

export const createProductSchema = z.object({
    name: z.string().min(1, 'Required').max(200),
    key: slug,
    category: z.string().min(1, 'Required').max(80),
    description: z.string().max(2000).optional(),
    notes: z.string().max(2000).optional(),
    pricing_strategy: z.enum(PRICING_STRATEGIES),
    metric_unit: z.string().max(30).optional(),
    pricing_unit: z.string().max(60).optional(),
    price_per: z.string().max(60).optional(),
    image_url: z
        .string()
        .url('Must be a valid URL')
        .max(500)
        .or(z.literal(''))
        .optional(),
    double_sided_surcharge: z.boolean(),
    unit_price: z.number().nonnegative().optional(),
    bulk_price: z.number().nonnegative().optional(),
    bulk_threshold: z.number().int().nonnegative().optional(),
    min_qty: z.number().int().min(1),
    // v34 — manual-review escalation flag + reason. When checked, Craig
    // refuses to auto-quote this product (regardless of qty/specs) and
    // creates a needs_revision Quote so Justin prices manually.
    manual_review_required: z.boolean().optional(),
    manual_review_reason: z.string().max(500).optional(),
    // Operator-only notes — never shown to customer (distinct from `notes`).
    internal_notes: z.string().max(2000).optional(),
});
export type CreateProductValues = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial().extend({
    name: z.string().min(1).max(200).optional(),
    category: z.string().min(1).max(80).optional(),
});
export type UpdateProductValues = z.infer<typeof updateProductSchema>;

export const tierSchema = z.object({
    spec_key: z.string().max(100),
    quantity: z.number().int().positive(),
    price: z.number().nonnegative(),
});
export type TierValues = z.infer<typeof tierSchema>;
