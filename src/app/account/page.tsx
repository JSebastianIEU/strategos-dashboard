import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { PageHeader } from '@/components/blocks/PageHeader';
import { AccountForm } from './AccountForm';

export const metadata = {
    title: 'Account · Strategos AI',
};

export default async function AccountPage() {
    const user = await getCurrentUser();
    if (!user) redirect('/login');

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <PageHeader
                title="Account"
                description="Manage your profile, email, and sign-in preferences."
            />
            <AccountForm
                initialDisplayName={user.display_name}
                currentEmail={user.email}
            />
        </div>
    );
}
