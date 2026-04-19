import { z } from 'zod';

export const taxRateSchema = z.object({
    name: z.string().min(1, 'Required').max(60),
    rate: z.number().min(0, '0 – 1').max(1, '0 – 1'),
    description: z.string().max(500).optional(),
    is_default: z.boolean(),
});
export type TaxRateValues = z.infer<typeof taxRateSchema>;
