import { z } from 'zod';

const slug = z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9_]+$/, 'lowercase letters, digits and underscores only')
    .optional();

export const createCategorySchema = z.object({
    name: z.string().min(1, 'Required').max(200),
    slug,
    description: z.string().max(1000).optional(),
    icon: z.string().max(60).optional(),
    sort_order: z.number().int().min(0),
});
export type CreateCategoryValues = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryValues = z.infer<typeof updateCategorySchema>;
