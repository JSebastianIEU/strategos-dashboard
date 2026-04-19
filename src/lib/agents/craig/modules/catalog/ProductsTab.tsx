'use client';
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Edit3, Package } from 'lucide-react';
import { toast } from 'sonner';
import type { AgentModuleProps } from '@/types/agent';
import type { CraigCategory, CraigProduct } from '../../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/blocks/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/blocks/ErrorState';
import { ConfirmDialog } from '@/components/blocks/ConfirmDialog';
import { ProductFormDialog } from './ProductFormDialog';
import { TierEditor } from './TierEditor';

export function ProductsTab({ organizationSlug, apiFetch }: AgentModuleProps) {
    const [products, setProducts] = useState<CraigProduct[] | null>(null);
    const [categories, setCategories] = useState<CraigCategory[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [search, setSearch] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<CraigProduct | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<CraigProduct | null>(null);

    async function refresh() {
        try {
            const [{ products: ps }, { categories: cs }] = await Promise.all([
                apiFetch<{ products: CraigProduct[] }>(`/admin/api/orgs/${organizationSlug}/products`),
                apiFetch<{ categories: CraigCategory[] }>(`/admin/api/orgs/${organizationSlug}/categories`),
            ]);
            setProducts(ps);
            setCategories(cs);
        } catch (e) {
            setError(String(e));
        }
    }

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organizationSlug]);

    const filtered = useMemo(() => {
        if (!products) return [];
        let out = products;
        if (activeCategory !== 'all') out = out.filter((p) => p.category === activeCategory);
        if (search.trim()) {
            const q = search.toLowerCase();
            out = out.filter(
                (p) =>
                    p.name.toLowerCase().includes(q) ||
                    p.key.toLowerCase().includes(q) ||
                    (p.description ?? '').toLowerCase().includes(q),
            );
        }
        return out;
    }, [products, activeCategory, search]);

    async function handleDelete(product: CraigProduct) {
        try {
            await apiFetch(
                `/admin/api/orgs/${organizationSlug}/products/${product.id}`,
                { method: 'DELETE' },
            );
            toast.success(`Deleted "${product.name}"`);
            await refresh();
        } catch (e) {
            toast.error('Failed to delete: ' + e);
        }
    }

    if (error) return <ErrorState description={error} />;
    if (products === null) {
        return (
            <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                    <CategoryChip
                        label={`All (${products.length})`}
                        active={activeCategory === 'all'}
                        onClick={() => setActiveCategory('all')}
                    />
                    {categories.map((c) => (
                        <CategoryChip
                            key={c.slug}
                            label={`${c.name} (${c.product_count})`}
                            active={activeCategory === c.slug}
                            onClick={() => setActiveCategory(c.slug)}
                        />
                    ))}
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Input
                        placeholder="Search products…"
                        className="w-56 h-8"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus className="h-3.5 w-3.5" />
                        New product
                    </Button>
                </div>
            </div>

            {/* Products */}
            {filtered.length === 0 ? (
                <EmptyState
                    icon={Package}
                    title="No products match"
                    description={search ? 'Try clearing the search.' : 'Create the first product in this category.'}
                />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filtered.map((p) => (
                        <Card key={p.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        {p.image_url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={p.image_url}
                                                alt=""
                                                className="h-12 w-12 rounded-md object-cover border border-slate-200 shrink-0"
                                            />
                                        ) : (
                                            <div className="h-12 w-12 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                                <Package className="h-5 w-5 text-slate-400" />
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <CardTitle>{p.name}</CardTitle>
                                            <CardDescription className="font-mono text-[10px]">
                                                {p.key}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => setEditing(p)}
                                        >
                                            <Edit3 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => setConfirmDelete(p)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    <Badge variant="secondary">{p.category.replace(/_/g, ' ')}</Badge>
                                    <Badge variant="outline">{p.pricing_strategy}</Badge>
                                    {p.price_per && (
                                        <Badge variant="secondary">{p.price_per}</Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <TierEditor
                                    product={p}
                                    organizationSlug={organizationSlug}
                                    apiFetch={apiFetch}
                                    onChange={refresh}
                                />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <ProductFormDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                organizationSlug={organizationSlug}
                apiFetch={apiFetch}
                categories={categories}
                onSuccess={refresh}
            />
            {editing && (
                <ProductFormDialog
                    open={!!editing}
                    onOpenChange={(o) => !o && setEditing(null)}
                    organizationSlug={organizationSlug}
                    apiFetch={apiFetch}
                    categories={categories}
                    initial={editing}
                    onSuccess={refresh}
                />
            )}
            <ConfirmDialog
                open={!!confirmDelete}
                onOpenChange={(o) => !o && setConfirmDelete(null)}
                title={`Delete "${confirmDelete?.name}"?`}
                description="This removes the product and all its price tiers. Existing quotes are unaffected."
                confirmLabel="Delete"
                destructive
                onConfirm={async () => {
                    if (confirmDelete) await handleDelete(confirmDelete);
                }}
            />
        </div>
    );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors ' +
                (active
                    ? 'bg-[var(--color-primary,#0d0d2b)] text-white border-transparent'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
            }
        >
            {label}
        </button>
    );
}
