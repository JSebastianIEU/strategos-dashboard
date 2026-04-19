import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { isStrategosAdmin } from '@/lib/auth/rbac';
import { Sidebar } from '@/components/blocks/Sidebar';
import { DemoBanner } from '@/components/blocks/DemoBanner';

export default async function StrategosLayout({ children }: { children: React.ReactNode }) {
    const user = await getCurrentUser();
    if (!user) redirect('/login');
    if (!isStrategosAdmin(user)) notFound();

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
