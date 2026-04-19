'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { FormField } from '@/components/blocks/FormField';
import { createClientSchema, type CreateClientValues } from '@/schemas/client';
import { createNewClient } from '../actions';

export function NewClientForm() {
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<CreateClientValues>({
        resolver: zodResolver(createClientSchema),
        defaultValues: {
            name: '',
            slug: '',
            theme: { primary_color: '#0d0d2b', font: 'Inter', logo_url: '' },
            enable_craig: true,
        },
    });

    async function onSubmit(values: CreateClientValues) {
        setBusy(true);
        const payload: CreateClientValues = {
            ...values,
            theme: {
                ...values.theme,
                logo_url: values.theme.logo_url || undefined,
            },
        };
        const res = await createNewClient(payload);
        setBusy(false);
        if ('error' in res) {
            toast.error(res.error);
            return;
        }
        toast.success(`Created "${values.name}"`);
        router.push('/strategos/clients');
    }

    return (
        <Card>
            <CardContent className="pt-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <FormField label="Name" required error={errors.name?.message}>
                            <Input {...register('name')} placeholder="Acme Print Co" />
                        </FormField>
                        <FormField
                            label="URL slug"
                            required
                            description="Lowercase letters, digits, hyphens."
                            error={errors.slug?.message}
                        >
                            <Input {...register('slug')} placeholder="acme-print" />
                        </FormField>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <FormField
                            label="Primary color"
                            description="Brand color used in their workspace"
                            error={errors.theme?.primary_color?.message}
                        >
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={watch('theme.primary_color') ?? '#0d0d2b'}
                                    onChange={(e) => setValue('theme.primary_color', e.target.value)}
                                    className="h-9 w-12 cursor-pointer rounded-md border border-slate-200"
                                />
                                <Input
                                    {...register('theme.primary_color')}
                                    className="flex-1 font-mono text-xs"
                                />
                            </div>
                        </FormField>
                        <FormField label="Font" description="Google Fonts family">
                            <Input {...register('theme.font')} placeholder="Inter" />
                        </FormField>
                    </div>
                    <FormField label="Logo URL" description="Optional — shown in sidebar + PDFs" error={errors.theme?.logo_url?.message}>
                        <Input {...register('theme.logo_url')} placeholder="https://example.com/logo.png" />
                    </FormField>

                    <div className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                        <div>
                            <div className="text-sm font-medium text-slate-900">
                                Enable Craig (quoting agent)
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                                Connects Craig to this client with default capabilities. Catalog and
                                settings start empty — configure them after.
                            </div>
                        </div>
                        <Switch
                            checked={watch('enable_craig')}
                            onCheckedChange={(v) => setValue('enable_craig', v)}
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.push('/strategos/clients')}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={busy}>
                            {busy ? 'Creating…' : 'Create client'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
