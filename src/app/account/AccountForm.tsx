'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Mail, User, Loader2 } from 'lucide-react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateDisplayName, requestEmailChange } from './actions';

interface Props {
    initialDisplayName: string | null;
    currentEmail: string;
}

export function AccountForm({ initialDisplayName, currentEmail }: Props) {
    const [displayName, setDisplayName] = useState(initialDisplayName ?? '');
    const [newEmail, setNewEmail] = useState('');
    const [savingName, startSavingName] = useTransition();
    const [savingEmail, startSavingEmail] = useTransition();
    const router = useRouter();

    function onSaveName(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startSavingName(async () => {
            const res = await updateDisplayName(fd);
            if (res.ok) {
                toast.success(res.message ?? 'Saved');
                router.refresh();
            } else {
                toast.error(res.message ?? 'Failed');
            }
        });
    }

    function onRequestEmailChange(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startSavingEmail(async () => {
            const res = await requestEmailChange(fd);
            if (res.ok) {
                toast.success(res.message ?? 'Confirmation sent');
                setNewEmail('');
            } else {
                toast.error(res.message ?? 'Failed');
            }
        });
    }

    const nameDirty = displayName.trim() !== (initialDisplayName ?? '').trim();

    return (
        <div className="space-y-4">
            {/* Display name */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-500" />
                        <CardTitle className="text-base">Display name</CardTitle>
                    </div>
                    <CardDescription>
                        Shown in the sidebar and on activity logs. You can change this any time.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={onSaveName} className="flex gap-2">
                        <div className="flex-1">
                            <Label htmlFor="display_name" className="sr-only">
                                Display name
                            </Label>
                            <Input
                                id="display_name"
                                name="display_name"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="e.g. Juan Sebastian"
                                maxLength={80}
                                required
                            />
                        </div>
                        <Button type="submit" disabled={!nameDirty || savingName}>
                            {savingName ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                'Save'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Email — read-only + change */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-500" />
                        <CardTitle className="text-base">Email</CardTitle>
                    </div>
                    <CardDescription>
                        Used for sign-in and notifications. Changing it sends a confirmation
                        link to the new address — your old email keeps working until you
                        click that link.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="current_email" className="text-xs text-slate-500">
                            Current
                        </Label>
                        <Input
                            id="current_email"
                            value={currentEmail}
                            readOnly
                            className="mt-1 bg-slate-50 font-mono text-sm"
                        />
                    </div>

                    <form onSubmit={onRequestEmailChange} className="space-y-2">
                        <Label htmlFor="new_email" className="text-xs text-slate-500">
                            New email
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                id="new_email"
                                name="new_email"
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="new.address@example.com"
                                required
                                className="flex-1"
                            />
                            <Button type="submit" disabled={!newEmail || savingEmail}>
                                {savingEmail ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    'Send link'
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
