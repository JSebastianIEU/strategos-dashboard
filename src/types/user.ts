import type { MembershipWithOrg } from './organization';

export interface AppUser {
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    memberships: MembershipWithOrg[];
}
