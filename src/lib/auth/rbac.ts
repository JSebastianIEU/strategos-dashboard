/**
 * Role-based access control helpers.
 *
 * Roles (ordered least → most privileged):
 *   client_viewer → client_member → client_owner → strategos_admin
 *
 * Anything in an 'agency' org with role strategos_admin = sees all clients.
 */

import type { AppUser } from '@/types/user';
import type { MembershipRole } from '@/types/organization';

const ROLE_RANK: Record<MembershipRole, number> = {
    client_viewer: 1,
    client_member: 2,
    client_owner: 3,
    strategos_admin: 4,
};

/** Is this user a Strategos-level admin? */
export function isStrategosAdmin(user: AppUser): boolean {
    return user.memberships.some(
        (m) => m.role === 'strategos_admin' && m.organization.type === 'agency',
    );
}

/** Membership for the given org slug, or null. */
export function membershipFor(user: AppUser, orgSlug: string) {
    return user.memberships.find((m) => m.organization.slug === orgSlug) ?? null;
}

/** Can this user access this client org at all? */
export function canAccessOrg(user: AppUser, orgSlug: string): boolean {
    return isStrategosAdmin(user) || !!membershipFor(user, orgSlug);
}

/** Does this user have at least the given role in this org? */
export function hasAtLeastRole(
    user: AppUser,
    orgSlug: string,
    minRole: MembershipRole,
): boolean {
    if (isStrategosAdmin(user)) return true;
    const m = membershipFor(user, orgSlug);
    if (!m) return false;
    return ROLE_RANK[m.role] >= ROLE_RANK[minRole];
}

/**
 * Generic capability check — central place for "what can X do?" questions.
 * Extend freely as new actions are added.
 */
export type Action =
    | 'org.view'
    | 'quote.view'
    | 'quote.approve'
    | 'conversation.view'
    | 'product.edit'
    | 'setting.edit'
    | 'agent.manage'
    | 'user.manage'
    | 'client.manage';

export function canUser(user: AppUser, action: Action, orgSlug?: string): boolean {
    // Strategos admins can do everything
    if (isStrategosAdmin(user)) return true;

    // Actions that require Strategos-level access
    if (action === 'agent.manage' || action === 'user.manage' || action === 'client.manage') {
        return false;
    }

    if (!orgSlug) return false;
    const m = membershipFor(user, orgSlug);
    if (!m) return false;

    switch (action) {
        case 'org.view':
        case 'quote.view':
        case 'conversation.view':
            return ROLE_RANK[m.role] >= ROLE_RANK.client_viewer;
        case 'quote.approve':
            return ROLE_RANK[m.role] >= ROLE_RANK.client_member;
        case 'product.edit':
        case 'setting.edit':
            return ROLE_RANK[m.role] >= ROLE_RANK.client_owner;
        default:
            return false;
    }
}
