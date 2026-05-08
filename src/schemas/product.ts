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
    // v36 — dimension-aware strategies for per-sq/m + per-sheet products
    'per_sqm',
    'per_sheet',
] as const;
export type PricingStrategy = (typeof PRICING_STRATEGIES)[number];

export const PRICING_STRATEGY_LABELS: Record<PricingStrategy, string> = {
    tiered: 'Per-quantity price tiers (look up by qty)',
    per_unit: 'Per-unit (price × quantity)',
    per_unit_metric: 'Per square-meter (legacy — use per_sqm)',
    bulk_break: 'Volume discount above threshold',
    per_job: 'Single fixed price per job',
    per_sqm: 'Per square-meter (asks for dimensions)',
    per_sheet: 'Per sheet (foamex / dibond / corri panels)',
};

/**
 * v34 — short hint shown next to each strategy option in the
 * ProductFormDialog. Helps non-technical operators understand
 * which one they want.
 *
 * v36 — added hints for per_sqm + per_sheet strategies.
 */
export const PRICING_STRATEGY_HINTS: Record<PricingStrategy, string> = {
    tiered: 'Used for: business cards, flyers, postcards, pads. Each quantity (e.g. 100, 250, 500) has its own price set in the tiers table.',
    per_unit: 'Used for: roller banners (priced per unit). Price = unit price × quantity.',
    per_unit_metric: 'LEGACY — use per_sqm instead for any new per-square-meter product. Same engine path.',
    bulk_break: 'Used when: there are TWO prices — one for low qty, one for bulk above a threshold (e.g. unit_price=€35, bulk_price=€28, bulk_threshold=10).',
    per_job: 'Used for: booklets — a single fixed price for a complete spec (format + binding + pages + cover). Tiers carry the actual prices keyed by spec_key.',
    per_sqm: 'Used for: vinyl labels, banners, graphics, fabric displays. Set unit_price in €/m². For items cut from a sheet (vinyl labels), set yield_per_sqm. Customer must give per-item width × height in mm.',
    per_sheet: 'Used for: foamex / dibond / corri panels. Set sheet_size_mm (e.g. "2400x1200" for 8×4 ft) and sheet_price (€/sheet). Engine packs panels onto sheets and bills sheets_needed × sheet_price.',
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
    // v36 — per-sq/m + per-sheet config
    yield_per_sqm: z.number().nonnegative().optional(),
    default_unit_size_mm: z.string().max(20).optional(),
    sheet_size_mm: z.string().max(20).optional(),
    sheet_price: z.number().nonnegative().optional(),
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
