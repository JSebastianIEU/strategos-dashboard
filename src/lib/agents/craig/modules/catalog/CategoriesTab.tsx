'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Tag, Plus, Edit3, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AgentModuleProps } from '@/types/agent';
import type { CraigCategory } from '../../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/blocks/EmptyState';
import { ErrorState } from '@/components/blocks/ErrorState';
import { ConfirmDialog } from '@/components/blocks/ConfirmDialog';
import { FormField } from '@/components/blocks/FormField';
import { Skeleton } from '@/components/ui/skeleton';
import {
    createCategorySchema,
    type CreateCategoryValues,
} from '@/schemas/category';

export function CategoriesTab({ organizationSlug, apiFetch }: AgentModuleProps) {
    const [categories, setCategories] = useState<CraigCategory[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<CraigCategory | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<CraigCategory | null>(null);

    async function refresh() {
        try {
            const { categories: cs } = await apiFetch<{ categories: CraigCategory[] }>(
                `/admin/api/orgs/${organizationSlug}/categories`,
            );
            setCategories(cs);
        } catch (e) {
            setError(String(e));
        }
    }

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organizationSlug]);

    async function deleteCategory(c: CraigCategory) {
        try {
            await apiFetch(
                `/admin/api/orgs/${organizationSlug}/categories/${c.slug}`,
                { method: 'DELETE' },
            );
            toast.success(`Deleted "${c.name}"`);
            await refresh();
        } catch (e) {
            toast.error(String(e));
        }
    }

    if (error) return <ErrorState description={error} />;
    if (categories === null) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                    Categories organize your catalog. Each category can have its own tax rate
                    (configure in the Tax rates tab).
                </p>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    New category
                </Button>
            </div>

            {categories.length === 0 ? (
                <EmptyState
                    icon={Tag}
                    title="No categories yet"
                    description="Create your first category, then add products to it."
                    action={
                        <Button size="sm" onClick={() => setCreateOpen(true)}>
                            <Plus className="h-3.5 w-3.5" />
                            New category
                        </Button>
                    }
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {categories.map((c) => (
                        <Card key={c.slug}>
                            <CardHeader>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <CardTitle className="text-sm">{c.name}</CardTitle>
                                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                                            {c.slug}
                                        </div>
                                        {c.description && (
                                            <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">
                                                {c.description}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-0.5 shrink-0">
                                        <Button size="icon" variant="ghost" onClick={() => setEditing(c)}>
                                            <Edit3 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => setConfirmDelete(c)}
                                            disabled={c.product_count > 0}
                                            title={
                                                c.product_count > 0
                                                    ? 'Move products out of this category first'
                                                    : 'Delete category'
                                            }
                                        >
                                            <Trash2
                                                className={
                                                    'h-3.5 w-3.5 ' +
                                                    (c.product_count > 0
                                                        ? 'text-slate-300'
                                                        : 'text-red-500')
                                                }
                                            />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <Badge variant="secondary">{c.product_count} products</Badge>
                                    {c.tax_rate_name ? (
                                        <Badge variant="outline">Tax: {c.tax_rate_name}</Badge>
                                    ) : (
                                        <Badge variant="warning">No tax mapping</Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <CategoryFormDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                organizationSlug={organizationSlug}
                apiFetch={apiFetch}
                onSuccess={refresh}
            />
            {editing && (
                <CategoryFormDialog
                    open={!!editing}
                    onOpenChange={(o) => !o && setEditing(null)}
                    organizationSlug={organizationSlug}
                    apiFetch={apiFetch}
                    initial={editing}
                    onSuccess={refresh}
                />
            )}
            <ConfirmDialog
                open={!!confirmDelete}
                onOpenChange={(o) => !o && setConfirmDelete(null)}
                title={`Delete "${confirmDelete?.name}"?`}
                description="Only empty categories can be deleted."
                destructive
                confirmLabel="Delete"
                onConfirm={async () => {
                    if (confirmDelete) await deleteCategory(confirmDelete);
                }}
            />
        </div>
    );
}

function CategoryFormDialog({
    open,
    onOpenChange,
    organizationSlug,
    apiFetch,
    initial,
    onSuccess,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    organizationSlug: string;
    apiFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
    initial?: CraigCategory;
    onSuccess: () => Promise<void> | void;
}) {
    const isEdit = !!initial;
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<CreateCategoryValues>({
        resolver: zodResolver(createCategorySchema),
        defaultValues: initial
            ? {
                  name: initial.name,
                  slug: initial.slug,
                  description: initial.description ?? '',
                  icon: initial.icon ?? '',
                  sort_order: initial.sort_order,
              }
            : { name: '', sort_order: 0 },
    });

    async function onSubmit(values: CreateCategoryValues) {
        try {
            const url = isEdit
                ? `/admin/api/orgs/${organizationSlug}/categories/${initial!.slug}`
                : `/admin/api/orgs/${organizationSlug}/categories`;
            const payload = { ...values, slug: values.slug || undefined };
            await apiFetch(url, {
                method: isEdit ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            toast.success(isEdit ? 'Category updated' : 'Category created');
            await onSuccess();
            reset();
            onOpenChange(false);
        } catch (e) {
            toast.error(String(e));
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isEdit ? `Edit ${initial!.name}` : 'New category'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <FormField label="Name" required error={errors.name?.message}>
                        <Input {...register('name')} placeholder="e.g. Stickers" />
                    </FormField>
                    {!isEdit && (
                        <FormField
                            label="Slug"
                            description="Auto-derived from name if blank. lowercase + underscores."
                            error={errors.slug?.message}
                        >
                            <Input {...register('slug')} placeholder="auto from name" />
                        </FormField>
                    )}
                    <FormField label="Description">
                        <Textarea rows={2} {...register('description')} />
                    </FormField>
                    <FormField
                        label="Sort order"
                        description="Lower numbers appear first"
                        error={errors.sort_order?.message}
                    >
                        <Input type="number" {...register('sort_order', { valueAsNumber: true })} />
                    </FormField>
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
