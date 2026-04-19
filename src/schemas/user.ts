import { z } from 'zod';

export const MEMBERSHIP_ROLES = [
    'strategos_admin',
    'client_owner',
    'client_member',
    'client_viewer',
] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const ROLE_LABELS: Record<MembershipRole, string> = {
    strategos_admin: 'Strategos admin',
    client_owner: 'Client owner',
    client_member: 'Client member',
    client_viewer: 'Client viewer',
};

export const inviteUserSchema = z.object({
    email: z.string().email('Must be a valid email').max(200),
    organization_slug: z.string().min(1, 'Pick a workspace'),
    role: z.enum(MEMBERSHIP_ROLES),
});
export type InviteUserValues = z.infer<typeof inviteUserSchema>;

export const updateMembershipSchema = z.object({
    membership_id: z.string().uuid(),
    role: z.enum(MEMBERSHIP_ROLES),
});
export type UpdateMembershipValues = z.infer<typeof updateMembershipSchema>;
