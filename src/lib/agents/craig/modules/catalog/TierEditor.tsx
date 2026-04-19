'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CraigProduct } from '../../api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TierEditorProps {
    product: CraigProduct;
    organizationSlug: string;
    apiFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
    onChange: () => Promise<void> | void;
}

export function TierEditor({ product, organizationSlug, apiFetch, onChange }: TierEditorProps) {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [adding, setAdding] = useState(false);

    if (product.pricing_strategy !== 'tiered' && product.tiers.length === 0) {
        return (
            <div className="text-xs text-slate-500">
                Pricing strategy: <span className="font-medium">{product.pricing_strategy}</span>
                {product.unit_price !== null && <> · Unit €{product.unit_price.toFixed(2)}</>}
                {product.bulk_price !== null && product.bulk_threshold && (
                    <> · Bulk €{product.bulk_price.toFixed(2)} (≥{product.bulk_threshold})</>
                )}
            </div>
        );
    }

    async function updateTier(tierId: number, price: number) {
        try {
            await apiFetch(
                `/admin/api/orgs/${organizationSlug}/products/${product.id}/tiers/${tierId}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ price }),
                },
            );
            toast.success('Tier updated');
            await onChange();
        } catch (e) {
            toast.error('Update failed: ' + e);
        } finally {
            setEditingId(null);
        }
    }

    async function deleteTier(tierId: number) {
        try {
            await apiFetch(
                `/admin/api/orgs/${organizationSlug}/products/${product.id}/tiers/${tierId}`,
                { method: 'DELETE' },
            );
            toast.success('Tier removed');
            await onChange();
        } catch (e) {
            toast.error('Delete failed: ' + e);
        }
    }

    return (
        <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Price tiers
            </div>
            {product.tiers.map((t) => (
                <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs"
                >
                    <div className="flex-1 truncate">
                        <span className="font-medium">{t.quantity}</span>
                        <span className="text-slate-500">
                            {t.spec_key && ` · ${t.spec_key}`}
                        </span>
                    </div>
                    {editingId === t.id ? (
                        <PriceInput initial={t.price} onSave={(v) => updateTier(t.id, v)} onCancel={() => setEditingId(null)} />
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => setEditingId(t.id)}
                                className="font-semibold tabular-nums hover:underline"
                            >
                                €{t.price.toFixed(2)}
                            </button>
                            <button
                                type="button"
                                onClick={() => deleteTier(t.id)}
                                className="text-slate-400 hover:text-red-500"
                                title="Delete tier"
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </>
                    )}
                </div>
            ))}

            {adding ? (
                <NewTierForm
                    productId={product.id}
                    organizationSlug={organizationSlug}
                    apiFetch={apiFetch}
                    onCancel={() => setAdding(false)}
                    onCreated={async () => {
                        setAdding(false);
                        await onChange();
                    }}
                />
            ) : (
                <Button size="sm" variant="ghost" onClick={() => setAdding(true)} className="w-full justify-start">
                    <Plus className="h-3 w-3" /> Add tier
                </Button>
            )}
        </div>
    );
}

function PriceInput({
    initial,
    onSave,
    onCancel,
}: {
    initial: number;
    onSave: (v: number) => void;
    onCancel: () => void;
}) {
    const [value, setValue] = useState(initial.toString());
    return (
        <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">€</span>
            <Input
                autoFocus
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-7 w-20 text-xs"
            />
            <Button size="sm" onClick={() => { const v = parseFloat(value); if (!isNaN(v)) onSave(v); }}>
                Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancel
            </Button>
        </div>
    );
}

function NewTierForm({
    productId,
    organizationSlug,
    apiFetch,
    onCancel,
    onCreated,
}: {
    productId: number;
    organizationSlug: string;
    apiFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
    onCancel: () => void;
    onCreated: () => Promise<void> | void;
}) {
    const [qty, setQty] = useState('');
    const [price, setPrice] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit() {
        const q = parseInt(qty, 10);
        const p = parseFloat(price);
        if (isNaN(q) || isNaN(p) || q <= 0 || p < 0) {
            toast.error('Enter a valid quantity and price.');
            return;
        }
        setBusy(true);
        try {
            await apiFetch(
                `/admin/api/orgs/${organizationSlug}/products/${productId}/tiers`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ quantity: q, price: p }),
                },
            );
            toast.success('Tier added');
            await onCreated();
        } catch (e) {
            toast.error('Failed: ' + e);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5">
            <Input
                placeholder="Qty"
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="h-7 w-20 text-xs"
            />
            <span className="text-slate-400 text-xs">→</span>
            <span className="text-xs text-slate-500">€</span>
            <Input
                placeholder="Price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="h-7 w-24 text-xs"
            />
            <Button size="sm" onClick={submit} disabled={busy}>
                Add
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancel
            </Button>
        </div>
    );
}
