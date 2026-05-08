import { z } from 'zod';

export const SURCHARGE_KINDS = ['multiplier', 'additive'] as const;
export type SurchargeKind = (typeof SURCHARGE_KINDS)[number];

export const surchargeSchema = z.object({
    name: z.string().min(1, 'Required').max(60),
    multiplier: z.number(),
    kind: z.enum(SURCHARGE_KINDS),
    applies_to_category: z.string().max(80).optional(),
    /**
     * v34 — per-product scoping. When non-empty, this surcharge applies
     * ONLY to products with these `key`s (overrides applies_to_category
     * at runtime). Use for "soft_touch +25% but only on business_cards"
     * style rules.
     */
    applies_to_product_keys: z.array(z.string().min(1).max(80)).optional(),
    description: z.string().max(500).optional(),
});
export type SurchargeValues = z.infer<typeof surchargeSchema>;
