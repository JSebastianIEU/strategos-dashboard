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
    tiered: 'Tiered (qty → price table)',
    per_unit: 'Per unit (unit price × quantity)',
    per_unit_metric: 'Per metric unit (sq m, kg, hour…)',
    bulk_break: 'Bulk break (unit OR bulk price beyond threshold)',
    per_job: 'Per job (single fixed price)',
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
