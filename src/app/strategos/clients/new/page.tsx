import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { isStrategosAdmin } from '@/lib/auth/rbac';
import { PageHeader } from '@/components/blocks/PageHeader';
import { NewClientForm } from './NewClientForm';

export default async function NewClientPage() {
    const user = await getCurrentUser();
    if (!user) redirect('/login');
    if (!isStrategosAdmin(user)) notFound();

    return (
        <div className="max-w-xl mx-auto">
            <PageHeader
                title="New client"
                description="Create a new client workspace. You can enable Craig (quoting agent) right away."
            />
            <NewClientForm />
        </div>
    );
}
