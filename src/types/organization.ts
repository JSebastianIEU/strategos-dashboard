/**
 * Organization and membership types — mirror the Supabase schema.
 */

export type OrganizationType = 'agency' | 'client';

export interface OrganizationTheme {
    primary_color?: string;
    accent_colors?: string[];
    logo_url?: string | null;
    font?: string;
}

export interface Organization {
    id: string;
    slug: string;
    name: string;
    type: OrganizationType;
    parent_id: string | null;
    theme: OrganizationTheme;
    created_at: string;
    updated_at: string;
}

export type MembershipRole =
    | 'strategos_admin'
    | 'client_owner'
    | 'client_member'
    | 'client_viewer';

export interface Membership {
    id: string;
    user_id: string;
    organization_id: string;
    role: MembershipRole;
    created_at: string;
    updated_at: string;
}

/** Convenience: membership with its joined organization, used all over the UI. */
export interface MembershipWithOrg extends Membership {
    organization: Organization;
}
