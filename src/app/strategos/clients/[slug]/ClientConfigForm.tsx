'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { FormField } from '@/components/blocks/FormField';
import { updateClientSchema, type UpdateClientValues } from '@/schemas/client';
import type { Organization } from '@/types/organization';
import { updateClient, toggleAgentForClient } from '../actions';

interface Props {
    org: Organization;
    craigEnabled: boolean;
    availableAgents: Array<{ slug: string; name: string }>;
}

export function ClientConfigForm({ org, craigEnabled, availableAgents }: Props) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [enabled, setEnabled] = useState<Record<string, boolean>>({
        craig: craigEnabled,
    });

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<UpdateClientValues>({
        resolver: zodResolver(updateClientSchema),
        defaultValues: {
            name: org.name,
            theme: {
                primary_color: org.theme.primary_color ?? '#0d0d2b',
                font: org.theme.font ?? 'Inter',
                logo_url: org.theme.logo_url ?? '',
            },
        },
    });

    async function onSubmit(values: UpdateClientValues) {
        setBusy(true);
        const payload: UpdateClientValues = {
            ...values,
            theme: values.theme
                ? { ...values.theme, logo_url: values.theme.logo_url || undefined }
                : undefined,
        };
        const res = await updateClient(org.slug, payload);
        setBusy(false);
        if ('error' in res) toast.error(res.error);
        else {
            toast.success('Saved');
            router.refresh();
        }
    }

    async function toggleAgent(agentSlug: string, enable: boolean) {
        // Optimistic update
        setEnabled((prev) => ({ ...prev, [agentSlug]: enable }));
        const res = await toggleAgentForClient(org.slug, agentSlug, enable);
        if ('error' in res) {
            toast.error(res.error);
            setEnabled((prev) => ({ ...prev, [agentSlug]: !enable }));
        } else {
            toast.success(enable ? 'Agent enabled' : 'Agent disabled');
            router.refresh();
        }
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Branding</CardTitle>
                    <CardDescription>
                        Controls how the client sees their workspace.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <FormField label="Name" error={errors.name?.message}>
                            <Input {...register('name')} />
                        </FormField>
                        <div className="grid grid-cols-2 gap-3">
                            <FormField label="Primary color" error={errors.theme?.primary_color?.message}>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={watch('theme.primary_color') ?? '#0d0d2b'}
                                        onChange={(e) =>
                                            setValue('theme.primary_color', e.target.value)
                                        }
                                        className="h-9 w-12 cursor-pointer rounded-md border border-slate-200"
                                    />
                                    <Input
                                        {...register('theme.primary_color')}
                                        className="flex-1 font-mono text-xs"
                                    />
                                </div>
                            </FormField>
                            <FormField label="Font">
                                <Input {...register('theme.font')} />
                            </FormField>
                        </div>
                        <FormField label="Logo URL" error={errors.theme?.logo_url?.message}>
                            <Input {...register('theme.logo_url')} />
                        </FormField>
                        <div className="flex justify-end">
                            <Button type="submit" disabled={busy}>
                                {busy ? 'Saving…' : 'Save branding'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Agents</CardTitle>
                    <CardDescription>
                        Enable agents this client will have access to.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {availableAgents.map((a) => (
                        <div
                            key={a.slug}
                            className="flex items-center justify-between rounded-md border border-slate-200 p-3"
                        >
                            <div>
                                <div className="text-sm font-medium text-slate-900">{a.name}</div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                    {enabled[a.slug] ? 'Enabled' : 'Disabled'} for this workspace
                                </div>
                            </div>
                            <Switch
                                checked={!!enabled[a.slug]}
                                onCheckedChange={(v) => toggleAgent(a.slug, v)}
                            />
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
