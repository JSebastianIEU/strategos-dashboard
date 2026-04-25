import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { Sidebar } from '@/components/blocks/Sidebar';
import { DemoBanner } from '@/components/blocks/DemoBanner';

/**
 * Account settings layout. Available to ANY logged-in user — no role
 * gating. Just sidebar + main content area, like the rest of the app.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
    const user = await getCurrentUser();
    if (!user) redirect('/login');

    return (
        <div className="flex h-screen flex-col">
            <DemoBanner />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar user={user} />
                <main className="flex-1 overflow-y-auto p-8">{children}</main>
            </div>
        </div>
    );
}
