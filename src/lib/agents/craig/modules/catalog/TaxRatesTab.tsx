'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';
import type { AgentModuleProps } from '@/types/agent';
import type { CraigCategory, CraigCategoryTaxMap, CraigTaxRate } from '../../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/blocks/FormField';
import { ConfirmDialog } from '@/components/blocks/ConfirmDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/blocks/ErrorState';
import { taxRateSchema, type TaxRateValues } from '@/schemas/tax-rate';

export function TaxRatesTab({ organizationSlug, apiFetch }: AgentModuleProps) {
    const [taxRates, setTaxRates] = useState<CraigTaxRate[] | null>(null);
    const [categoryMap, setCategoryMap] = useState<CraigCategoryTaxMap[]>([]);
    const [categories, setCategories] = useState<CraigCategory[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<CraigTaxRate | null>(null);

    async function refresh() {
        try {
            const [rates, cats] = await Promise.all([
                apiFetch<{ tax_rates: CraigTaxRate[]; category_map: CraigCategoryTaxMap[] }>(
                    `/admin/api/orgs/${organizationSlug}/tax-rates`,
                ),
                apiFetch<{ categories: CraigCategory[] }>(
                    `/admin/api/orgs/${organizationSlug}/categories`,
                ),
            ]);
            setTaxRates(rates.tax_rates);
            setCategoryMap(rates.category_map);
            setCategories(cats.categories);
        } catch (e) {
            setError(String(e));
        }
    }

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organizationSlug]);

    async function setCategoryRate(category: string, taxRateId: number) {
        try {
            await apiFetch(`/admin/api/orgs/${organizationSlug}/category-tax-map`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entries: [{ category, tax_rate_id: taxRateId }] }),
            });
            toast.success('Mapping updated');
            await refresh();
        } catch (e) {
            toast.error('Failed: ' + e);
        }
    }

    async function setDefault(rate: CraigTaxRate) {
        try {
            await apiFetch(`/admin/api/orgs/${organizationSlug}/tax-rates/${rate.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_default: true }),
            });
            toast.success(`"${rate.name}" is now the default rate`);
            await refresh();
        } catch (e) {
            toast.error('Failed: ' + e);
        }
    }

    async function deleteRate(rate: CraigTaxRate) {
        try {
            await apiFetch(`/admin/api/orgs/${organizationSlug}/tax-rates/${rate.id}`, {
                method: 'DELETE',
            });
            toast.success('Tax rate removed');
            await refresh();
        } catch (e) {
            toast.error('Failed: ' + e);
        }
    }

    if (error) return <ErrorState description={error} />;
    if (taxRates === null) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Tax rates list */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">Tax rates</h3>
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus className="h-3.5 w-3.5" />
                        New tax rate
                    </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {taxRates.map((rate) => (
                        <Card key={rate.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-sm">{rate.name}</CardTitle>
                                        <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                                            {(rate.rate * 100).toFixed(rate.rate * 100 % 1 === 0 ? 0 : 2)}%
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        {rate.is_default && (
                                            <Badge variant="success" className="gap-1">
                                                <Star className="h-2.5 w-2.5 fill-current" /> Default
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                {rate.description && (
                                    <p className="text-xs text-slate-500 mt-2">{rate.description}</p>
                                )}
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-2">
                                    {!rate.is_default && (
                                        <Button size="sm" variant="outline" onClick={() => setDefault(rate)}>
                                            Set as default
                                        </Button>
                                    )}
                                    {!rate.is_default && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => setConfirmDelete(rate)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Category → rate mapping */}
            <section>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Category mapping</h3>
                <p className="text-xs text-slate-500 mb-3">
                    Each category uses its assigned rate, or falls back to the default if unmapped.
                </p>
                <Card>
                    <CardContent className="p-0">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                                <tr>
                                    <th className="px-4 py-2 font-medium">Category</th>
                                    <th className="px-4 py-2 font-medium">Tax rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {categories.map((cat) => {
                                    const mapped = categoryMap.find((m) => m.category === cat.slug);
                                    return (
                                        <tr key={cat.slug}>
                                            <td className="px-4 py-2">
                                                <div className="font-medium">{cat.name}</div>
                                                <div className="text-[10px] text-slate-500">
                                                    {cat.product_count} products
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <Select
                                                    value={mapped?.tax_rate_id?.toString() ?? ''}
                                                    onValueChange={(v) => setCategoryRate(cat.slug, Number(v))}
                                                >
                                                    <SelectTrigger className="w-48 h-8">
                                                        <SelectValue placeholder="Use default" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {taxRates.map((r) => (
                                                            <SelectItem key={r.id} value={r.id.toString()}>
                                                                {r.name} ({(r.rate * 100).toFixed(1)}%)
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </section>

            <CreateTaxRateDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                organizationSlug={organizationSlug}
                apiFetch={apiFetch}
                onSuccess={refresh}
            />
            <ConfirmDialog
                open={!!confirmDelete}
                onOpenChange={(o) => !o && setConfirmDelete(null)}
                title={`Delete "${confirmDelete?.name}"?`}
                description="Categories using this rate will fall back to the default."
                destructive
                confirmLabel="Delete"
                onConfirm={async () => {
                    if (confirmDelete) await deleteRate(confirmDelete);
                }}
            />
        </div>
    );
}

function CreateTaxRateDialog({
    open,
    onOpenChange,
    organizationSlug,
    apiFetch,
    onSuccess,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    organizationSlug: string;
    apiFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
    onSuccess: () => Promise<void> | void;
}) {
    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<TaxRateValues>({
        resolver: zodResolver(taxRateSchema),
        defaultValues: { name: '', rate: 0, is_default: false },
    });

    async function onSubmit(values: TaxRateValues) {
        try {
            await apiFetch(`/admin/api/orgs/${organizationSlug}/tax-rates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            toast.success('Tax rate created');
            await onSuccess();
            reset();
            onOpenChange(false);
        } catch (e) {
            toast.error('Failed: ' + e);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New tax rate</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <FormField label="Name" required error={errors.name?.message}>
                        <Input {...register('name')} placeholder="e.g. eu_standard" />
                    </FormField>
                    <FormField
                        label="Rate"
                        required
                        description="As a decimal: 0.23 for 23%"
                        error={errors.rate?.message}
                    >
                        <Input type="number" step="0.001" {...register('rate', { valueAsNumber: true })} placeholder="0.23" />
                    </FormField>
                    <FormField label="Description">
                        <Input {...register('description')} placeholder="optional" />
                    </FormField>
                    <div className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                        <div>
                            <div className="text-sm font-medium">Default rate?</div>
                            <div className="text-xs text-slate-500">
                                Used when a category has no explicit mapping.
                            </div>
                        </div>
                        <Switch
                            checked={watch('is_default')}
                            onCheckedChange={(v) => setValue('is_default', v)}
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving…' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
