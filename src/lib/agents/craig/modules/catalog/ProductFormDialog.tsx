'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FormField } from '@/components/blocks/FormField';
import {
    createProductSchema,
    PRICING_STRATEGIES,
    PRICING_STRATEGY_HINTS,
    PRICING_STRATEGY_LABELS,
    type CreateProductValues,
} from '@/schemas/product';
import type { CraigCategory, CraigProduct } from '../../api';

interface ProductFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    organizationSlug: string;
    apiFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
    categories: CraigCategory[];
    initial?: CraigProduct;
    onSuccess: () => Promise<void> | void;
}

export function ProductFormDialog({
    open,
    onOpenChange,
    organizationSlug,
    apiFetch,
    categories,
    initial,
    onSuccess,
}: ProductFormDialogProps) {
    const isEdit = !!initial;
    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<CreateProductValues>({
        resolver: zodResolver(createProductSchema),
        defaultValues: initial
            ? {
                  name: initial.name,
                  category: initial.category,
                  description: initial.description ?? '',
                  notes: initial.notes ?? '',
                  pricing_strategy: initial.pricing_strategy,
                  metric_unit: initial.metric_unit ?? '',
                  pricing_unit: initial.pricing_unit ?? '',
                  price_per: initial.price_per ?? '',
                  image_url: initial.image_url ?? '',
                  double_sided_surcharge: initial.double_sided_surcharge,
                  unit_price: initial.unit_price ?? undefined,
                  bulk_price: initial.bulk_price ?? undefined,
                  bulk_threshold: initial.bulk_threshold ?? undefined,
                  min_qty: initial.min_qty ?? 1,
                  // v34
                  manual_review_required: initial.manual_review_required ?? false,
                  manual_review_reason: initial.manual_review_reason ?? '',
                  internal_notes: initial.internal_notes ?? '',
              }
            : {
                  name: '',
                  category: categories[0]?.slug ?? '',
                  pricing_strategy: 'tiered',
                  double_sided_surcharge: true,
                  min_qty: 1,
                  manual_review_required: false,
              },
    });

    const strategy = watch('pricing_strategy');

    async function onSubmit(values: CreateProductValues) {
        try {
            const url = isEdit
                ? `/admin/api/orgs/${organizationSlug}/products/${initial!.id}`
                : `/admin/api/orgs/${organizationSlug}/products`;
            // Server doesn't accept empty strings for URL — drop blank image_url
            const payload = { ...values, image_url: values.image_url || undefined };
            await apiFetch(url, {
                method: isEdit ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            toast.success(isEdit ? 'Product updated' : 'Product created');
            await onSuccess();
            reset();
            onOpenChange(false);
        } catch (e) {
            toast.error('Failed: ' + e);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{isEdit ? `Edit ${initial!.name}` : 'New product'}</DialogTitle>
                    <DialogDescription>
                        Configure how Craig prices this product. Tiers are added separately.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <FormField label="Name" htmlFor="name" required error={errors.name?.message}>
                            <Input id="name" {...register('name')} placeholder="e.g. Business Cards" />
                        </FormField>
                        <FormField label="Category" required error={errors.category?.message}>
                            <Select
                                value={watch('category')}
                                onValueChange={(v) => setValue('category', v, { shouldValidate: true })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pick a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((c) => (
                                        <SelectItem key={c.slug} value={c.slug}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormField>
                    </div>

                    <FormField
                        label="Pricing strategy"
                        required
                        error={errors.pricing_strategy?.message}
                        description={PRICING_STRATEGY_HINTS[strategy]}
                    >
                        <Select
                            value={strategy}
                            onValueChange={(v) =>
                                setValue('pricing_strategy', v as CreateProductValues['pricing_strategy'], {
                                    shouldValidate: true,
                                })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PRICING_STRATEGIES.map((s) => (
                                    <SelectItem key={s} value={s}>
                                        {PRICING_STRATEGY_LABELS[s]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormField>

                    {strategy === 'per_unit_metric' && (
                        <FormField label="Metric unit" description="e.g. sq m, kg, hour">
                            <Input {...register('metric_unit')} placeholder="sq m" />
                        </FormField>
                    )}

                    {(strategy === 'per_unit' || strategy === 'per_unit_metric' || strategy === 'bulk_break') && (
                        <div className="grid grid-cols-3 gap-3">
                            <FormField label="Unit price (€)">
                                <Input type="number" step="0.01" {...register('unit_price', { valueAsNumber: true })} />
                            </FormField>
                            {strategy === 'bulk_break' && (
                                <>
                                    <FormField label="Bulk price (€)">
                                        <Input type="number" step="0.01" {...register('bulk_price', { valueAsNumber: true })} />
                                    </FormField>
                                    <FormField label="Bulk threshold (qty)">
                                        <Input type="number" {...register('bulk_threshold', { valueAsNumber: true })} />
                                    </FormField>
                                </>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <FormField label="Price per (label)" description="e.g. '100 cards', 'per banner'">
                            <Input {...register('price_per')} />
                        </FormField>
                        <FormField label="Min qty">
                            <Input type="number" {...register('min_qty', { valueAsNumber: true })} />
                        </FormField>
                    </div>

                    <FormField label="Description">
                        <Textarea rows={2} {...register('description')} />
                    </FormField>

                    <FormField
                        label="Customer-facing note"
                        description="Craig may quote this back to the customer (e.g. 'Available in matte or gloss')."
                    >
                        <Textarea rows={2} {...register('notes')} />
                    </FormField>

                    <FormField
                        label="Internal notes (operator-only)"
                        description="NEVER shown to customers. For your reference — pricing rationale, supplier quirks, gotchas."
                    >
                        <Textarea rows={2} {...register('internal_notes')} />
                    </FormField>

                    <FormField
                        label="Image URL"
                        description="Public URL to a product photo. Shown in the catalog."
                        error={errors.image_url?.message}
                    >
                        <div className="flex gap-2">
                            <Input
                                {...register('image_url')}
                                placeholder="https://example.com/product.jpg"
                            />
                            {watch('image_url') && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={watch('image_url') || ''}
                                    alt=""
                                    className="h-9 w-9 rounded-md object-cover border border-slate-200"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            )}
                        </div>
                    </FormField>

                    <div className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                        <div>
                            <div className="text-sm font-medium text-slate-900">Double-sided surcharge</div>
                            <div className="text-xs text-slate-500">
                                If on, the &quot;double_sided&quot; surcharge applies to this product.
                            </div>
                        </div>
                        <Switch
                            checked={watch('double_sided_surcharge')}
                            onCheckedChange={(v) => setValue('double_sided_surcharge', v)}
                        />
                    </div>

                    {/* v34 — manual-review escalation flag */}
                    <div className="rounded-md border border-orange-200 bg-orange-50 p-3 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-sm font-medium text-slate-900">
                                    Manual review required
                                </div>
                                <div className="text-xs text-slate-600 mt-0.5">
                                    When ON, Craig will <strong>refuse to auto-quote</strong> this
                                    product. He&apos;ll create a <code>needs_revision</code> quote
                                    and email you for manual pricing instead.
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    Use this for per-sq/m products (vinyl, banners), POA items, or
                                    anything where the catalog price isn&apos;t reliable for the
                                    customer&apos;s actual request.
                                </div>
                            </div>
                            <Switch
                                checked={watch('manual_review_required') ?? false}
                                onCheckedChange={(v) =>
                                    setValue('manual_review_required', v, { shouldDirty: true })
                                }
                            />
                        </div>
                        {watch('manual_review_required') && (
                            <FormField
                                label="Reason (shown in the email subject + sidebar)"
                                error={errors.manual_review_reason?.message}
                            >
                                <Input
                                    {...register('manual_review_reason')}
                                    placeholder="e.g. per-sq/m item — needs width/height to quote"
                                />
                            </FormField>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
