'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Percent } from 'lucide-react';
import { toast } from 'sonner';
import type { AgentModuleProps } from '@/types/agent';
import type { CraigCategory, CraigProduct, CraigSurcharge } from '../../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { EmptyState } from '@/components/blocks/EmptyState';
import { surchargeSchema, type SurchargeValues } from '@/schemas/surcharge';

export function SurchargesTab({ organizationSlug, apiFetch }: AgentModuleProps) {
    const [surcharges, setSurcharges] = useState<CraigSurcharge[] | null>(null);
    const [categories, setCategories] = useState<CraigCategory[]>([]);
    // v34 — products list for the per-product multi-select scope.
    const [products, setProducts] = useState<CraigProduct[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<CraigSurcharge | null>(null);

    async function refresh() {
        try {
            const [{ surcharges: s }, { categories: cs }, { products: ps }] = await Promise.all([
                apiFetch<{ surcharges: CraigSurcharge[] }>(`/admin/api/orgs/${organizationSlug}/surcharges`),
                apiFetch<{ categories: CraigCategory[] }>(`/admin/api/orgs/${organizationSlug}/categories`),
                apiFetch<{ products: CraigProduct[] }>(`/admin/api/orgs/${organizationSlug}/products`),
            ]);
            setSurcharges(s);
            setCategories(cs);
            setProducts(ps);
        } catch (e) {
            setError(String(e));
        }
    }

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organizationSlug]);

    async function deleteSurcharge(s: CraigSurcharge) {
        try {
            await apiFetch(`/admin/api/orgs/${organizationSlug}/surcharges/${s.id}`, {
                method: 'DELETE',
            });
            toast.success(`Removed "${s.name}"`);
            await refresh();
        } catch (e) {
            toast.error('Failed: ' + e);
        }
    }

    if (error) return <ErrorState description={error} />;
    if (surcharges === null) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                    Surcharges modify a quote&apos;s base price. Multipliers add a percentage,
                    additive surcharges add a fixed amount per unit.
                </p>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    New surcharge
                </Button>
            </div>

            {surcharges.length === 0 ? (
                <EmptyState
                    icon={Percent}
                    title="No surcharges yet"
                    description="Create one to apply double-sided fees, finish upgrades, etc."
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {surcharges.map((s) => (
                        <Card key={s.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-sm">{s.name}</CardTitle>
                                        <div className="text-xl font-bold mt-1 tabular-nums">
                                            {s.kind === 'multiplier'
                                                ? `+${(s.multiplier * 100).toFixed(0)}%`
                                                : `+€${s.multiplier.toFixed(2)}`}
                                        </div>
                                    </div>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => setConfirmDelete(s)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                    </Button>
                                </div>
                                {s.description && (
                                    <p className="text-xs text-slate-500 mt-2">{s.description}</p>
                                )}
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-1.5">
                                    <Badge variant="secondary">{s.kind}</Badge>
                                    {s.applies_to_product_keys && s.applies_to_product_keys.length > 0 ? (
                                        // v34 — per-product scope wins over category.
                                        s.applies_to_product_keys.map((k) => (
                                            <Badge key={k} variant="outline" className="bg-orange-50 border-orange-200">
                                                {k.replace(/_/g, ' ')}
                                            </Badge>
                                        ))
                                    ) : s.applies_to_category ? (
                                        <Badge variant="outline">
                                            {s.applies_to_category.replace(/_/g, ' ')}
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline">all products</Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <CreateSurchargeDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                organizationSlug={organizationSlug}
                apiFetch={apiFetch}
                categories={categories}
                products={products}
                onSuccess={refresh}
            />
            <ConfirmDialog
                open={!!confirmDelete}
                onOpenChange={(o) => !o && setConfirmDelete(null)}
                title={`Delete "${confirmDelete?.name}"?`}
                description="Quotes already generated are unaffected."
                destructive
                confirmLabel="Delete"
                onConfirm={async () => {
                    if (confirmDelete) await deleteSurcharge(confirmDelete);
                }}
            />
        </div>
    );
}

function CreateSurchargeDialog({
    open,
    onOpenChange,
    organizationSlug,
    apiFetch,
    categories,
    products,
    onSuccess,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    organizationSlug: string;
    apiFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
    categories: CraigCategory[];
    products: CraigProduct[];
    onSuccess: () => Promise<void> | void;
}) {
    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<SurchargeValues>({
        resolver: zodResolver(surchargeSchema),
        defaultValues: { name: '', multiplier: 0, kind: 'multiplier', applies_to_product_keys: [] },
    });

    // v34 — track the selected product keys for the multi-select.
    // When non-empty, applies_to_category is grayed out (per-product
    // scope wins at runtime; sending both is also valid but confusing).
    const selectedKeys: string[] = watch('applies_to_product_keys') ?? [];
    const productScopeActive = selectedKeys.length > 0;

    async function onSubmit(values: SurchargeValues) {
        try {
            const cleaned: Record<string, unknown> = {
                ...values,
                applies_to_category: productScopeActive
                    ? undefined
                    : values.applies_to_category || undefined,
                applies_to_product_keys:
                    selectedKeys.length > 0 ? selectedKeys : undefined,
            };
            await apiFetch(`/admin/api/orgs/${organizationSlug}/surcharges`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cleaned),
            });
            toast.success('Surcharge created');
            await onSuccess();
            reset();
            onOpenChange(false);
        } catch (e) {
            toast.error('Failed: ' + e);
        }
    }

    function toggleKey(key: string) {
        const next = selectedKeys.includes(key)
            ? selectedKeys.filter((k) => k !== key)
            : [...selectedKeys, key];
        setValue('applies_to_product_keys', next, { shouldDirty: true });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New surcharge</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <FormField label="Name" required error={errors.name?.message}>
                        <Input {...register('name')} placeholder="e.g. lamination" />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                        <FormField label="Kind" required>
                            <Select
                                value={watch('kind')}
                                onValueChange={(v) =>
                                    setValue('kind', v as SurchargeValues['kind'], { shouldValidate: true })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="multiplier">Multiplier (e.g. +25%)</SelectItem>
                                    <SelectItem value="additive">Additive (e.g. +€5)</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormField>
                        <FormField
                            label="Amount"
                            required
                            description={
                                watch('kind') === 'multiplier'
                                    ? '0.25 means +25%'
                                    : 'Currency amount'
                            }
                            error={errors.multiplier?.message}
                        >
                            <Input
                                type="number"
                                step="0.01"
                                {...register('multiplier', { valueAsNumber: true })}
                                placeholder="0.25"
                            />
                        </FormField>
                    </div>
                    {/* v34 — per-product scope (most specific wins). When
                        any products are selected, the category scope below
                        is grayed out. */}
                    <FormField
                        label="Applies to specific products (optional)"
                        description="Pick one or more products to scope the surcharge precisely. Wins over category scope."
                    >
                        <div className="rounded-md border border-slate-200 bg-white p-2 max-h-44 overflow-y-auto space-y-1">
                            {products.length === 0 ? (
                                <div className="text-xs text-slate-500 py-1">No products yet.</div>
                            ) : (
                                products.map((p) => {
                                    const checked = selectedKeys.includes(p.key);
                                    return (
                                        <label
                                            key={p.key}
                                            className="flex items-center gap-2 text-xs hover:bg-slate-50 rounded px-1.5 py-1 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleKey(p.key)}
                                                className="h-3.5 w-3.5"
                                            />
                                            <span className="font-medium text-slate-900">{p.name}</span>
                                            <span className="text-slate-500">·</span>
                                            <span className="text-slate-500 capitalize">
                                                {p.category.replace(/_/g, ' ')}
                                            </span>
                                            <span className="ml-auto text-[10px] text-slate-400 font-mono">
                                                {p.key}
                                            </span>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                        {selectedKeys.length > 0 && (
                            <div className="mt-1.5 text-[11px] text-orange-700">
                                {selectedKeys.length} product{selectedKeys.length === 1 ? '' : 's'}
                                {' '}selected · category scope ignored
                            </div>
                        )}
                    </FormField>

                    <FormField
                        label="Applies to category"
                        description={
                            productScopeActive
                                ? 'Disabled — per-product scope is set above.'
                                : 'Leave blank to apply to all categories.'
                        }
                    >
                        <Select
                            value={watch('applies_to_category') ?? ''}
                            onValueChange={(v) =>
                                setValue('applies_to_category', v === '__all__' ? undefined : v)
                            }
                            disabled={productScopeActive}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all__">All categories</SelectItem>
                                {categories.map((c) => (
                                    <SelectItem key={c.slug} value={c.slug}>
                                        {c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormField>
                    <FormField label="Description">
                        <Input {...register('description')} placeholder="optional" />
                    </FormField>
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
