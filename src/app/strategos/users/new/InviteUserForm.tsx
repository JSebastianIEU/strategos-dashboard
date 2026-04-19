'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
    inviteUserSchema,
    MEMBERSHIP_ROLES,
    ROLE_LABELS,
    type InviteUserValues,
} from '@/schemas/user';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/components/blocks/FormField';
import { inviteUser } from '../actions';

interface OrgOption {
    slug: string;
    name: string;
    type: string;
}

export function InviteUserForm({ orgs }: { orgs: OrgOption[] }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<InviteUserValues>({
        resolver: zodResolver(inviteUserSchema),
        defaultValues: { email: '', organization_slug: orgs[0]?.slug ?? '', role: 'client_member' },
    });

    async function onSubmit(values: InviteUserValues) {
        setBusy(true);
        const res = await inviteUser(values);
        setBusy(false);
        if ('error' in res) {
            toast.error(res.error);
            return;
        }
        toast.success(`Invited ${values.email}`);
        router.push('/strategos/users');
    }

    return (
        <Card>
            <CardContent className="pt-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <FormField label="Email" required error={errors.email?.message}>
                        <Input
                            type="email"
                            autoComplete="email"
                            {...register('email')}
                            placeholder="user@company.com"
                        />
                    </FormField>
                    <FormField label="Workspace" required error={errors.organization_slug?.message}>
                        <Select
                            value={watch('organization_slug')}
                            onValueChange={(v) =>
                                setValue('organization_slug', v, { shouldValidate: true })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Pick workspace" />
                            </SelectTrigger>
                            <SelectContent>
                                {orgs.map((o) => (
                                    <SelectItem key={o.slug} value={o.slug}>
                                        {o.name}{' '}
                                        <span className="text-slate-400 text-xs ml-1">({o.type})</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormField>
                    <FormField label="Role" required error={errors.role?.message}>
                        <Select
                            value={watch('role')}
                            onValueChange={(v) =>
                                setValue('role', v as InviteUserValues['role'], { shouldValidate: true })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {MEMBERSHIP_ROLES.map((r) => (
                                    <SelectItem key={r} value={r}>
                                        {ROLE_LABELS[r]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormField>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.push('/strategos/users')}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={busy}>
                            {busy ? 'Sending…' : 'Send invite'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
