import { z } from 'zod';

const slugField = z
    .string()
    .min(2, 'Must be at least 2 characters')
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, digits, hyphens only');

const hexColor = z
    .string()
    .regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'Must be a #hex color')
    .optional();

const optionalUrl = z.string().url('Must be a valid URL').max(500).or(z.literal('')).optional();

export const clientThemeSchema = z.object({
    primary_color: hexColor,
    logo_url: optionalUrl,
    font: z.string().max(60).optional(),
});
export type ClientThemeValues = z.infer<typeof clientThemeSchema>;

export const createClientSchema = z.object({
    name: z.string().min(1, 'Required').max(200),
    slug: slugField,
    theme: clientThemeSchema,
    enable_craig: z.boolean(),
});
export type CreateClientValues = z.infer<typeof createClientSchema>;

export const updateClientSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    theme: clientThemeSchema.optional(),
});
export type UpdateClientValues = z.infer<typeof updateClientSchema>;
