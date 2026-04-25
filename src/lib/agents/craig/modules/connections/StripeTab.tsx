'use client';
import { useEffect, useState } from 'react';
import { CreditCard, Eye, EyeOff, Copy, Check, Loader2, PlugZap } from 'lucide-react';
import { toast } from 'sonner';
import type { AgentModuleProps } from '@/types/agent';
import type { CraigSetting } from '../../api';
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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/blocks/ErrorState';

/**
 * Tenant-side Stripe configuration.
 *
 * Setting keys (all per-tenant rows in Craig's `settings` table):
 *   - stripe_enabled         ('true' | 'false') — master switch, default false
 *   - stripe_secret_key      (sk_live_... or sk_test_...)
 *   - stripe_webhook_secret  (whsec_...)
 *   - stripe_currency        ('eur' default)
 *   - stripe_success_url     (optional redirect after payment)
 *
 * The Webhook URL is displayed prominently — that's what Justin pastes
 * into Stripe's Dashboard → Developers → Webhooks.
 */

const STRIPE_KEYS = [
    'stripe_enabled',
    'stripe_secret_key',
    'stripe_webhook_secret',
    'stripe_currency',
    'stripe_success_url',
] as const;
type StripeKey = (typeof STRIPE_KEYS)[number];

const EMPTY: Record<StripeKey, string> = {
    stripe_enabled: 'false',
    stripe_secret_key: '',
    stripe_webhook_secret: '',
    stripe_currency: 'eur',
    stripe_success_url: '',
};

interface IntegrationHealth {
    configured: boolean;
    enabled: boolean;
    health: 'green' | 'yellow' | 'red' | 'unknown';
    last_success_at?: string | null;
    last_error?: string | null;
    notes?: string | null;
}

export function StripeTab({ organizationSlug, agentApiBaseUrl, apiFetch }: AgentModuleProps) {
    const [settings, setSettings] = useState<Record<StripeKey, CraigSetting | null> | null>(null);
    const [drafts, setDrafts] = useState<Record<StripeKey, string>>(EMPTY);
    const [saving, setSaving] = useState<StripeKey | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [revealSecret, setRevealSecret] = useState(false);
    const [revealWhsec, setRevealWhsec] = useState(false);
    const [copied, setCopied] = useState<'url' | null>(null);
    const [health, setHealth] = useState<IntegrationHealth | null>(null);
    const [testing, setTesting] = useState(false);

    // Load settings
    useEffect(() => {
        let cancelled = false;
        apiFetch<{ settings: CraigSetting[] }>(`/admin/api/orgs/${organizationSlug}/settings`)
            .then((d) => {
                if (cancelled) return;
                const bag: Record<StripeKey, CraigSetting | null> = {
                    stripe_enabled: null,
                    stripe_secret_key: null,
                    stripe_webhook_secret: null,
                    stripe_currency: null,
                    stripe_success_url: null,
                };
                const draft = { ...EMPTY };
                for (const s of d.settings) {
                    if ((STRIPE_KEYS as readonly string[]).includes(s.key)) {
                        bag[s.key as StripeKey] = s;
                        draft[s.key as StripeKey] = s.value ?? '';
                    }
                }
                setSettings(bag);
                setDrafts(draft);
            })
            .catch((e) => !cancelled && setError(String(e)));
        return () => {
            cancelled = true;
        };
    }, [organizationSlug, apiFetch]);

    // Poll health every 30s while open
    useEffect(() => {
        let cancelled = false;
        async function fetchHealth() {
            try {
                const data = await apiFetch<{ stripe: IntegrationHealth }>(
                    `/admin/api/orgs/${organizationSlug}/integrations/status`,
                );
                if (!cancelled) setHealth(data.stripe);
            } catch {
                /* swallow */
            }
        }
        fetchHealth();
        const t = setInterval(fetchHealth, 30_000);
        return () => {
            cancelled = true;
            clearInterval(t);
        };
    }, [organizationSlug, apiFetch]);

    async function patch(key: StripeKey, value: string): Promise<CraigSetting> {
        const { setting } = await apiFetch<{ setting: CraigSetting }>(
            `/admin/api/orgs/${organizationSlug}/settings/${key}`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value, value_type: 'string' }),
            },
        );
        setSettings((prev) => (prev ? { ...prev, [key]: setting } : prev));
        return setting;
    }

    async function save(key: StripeKey) {
        setSaving(key);
        try {
            await patch(key, drafts[key]);
            toast.success(`${key.replace('stripe_', '')} saved`);
        } catch (e) {
            toast.error('Failed: ' + e);
        } finally {
            setSaving(null);
        }
    }

    async function toggleEnabled(next: boolean) {
        const value = next ? 'true' : 'false';
        const prev = drafts.stripe_enabled;
        setDrafts((d) => ({ ...d, stripe_enabled: value }));
        try {
            await patch('stripe_enabled', value);
            toast.success(next ? 'Stripe enabled' : 'Stripe disabled');
        } catch (e) {
            setDrafts((d) => ({ ...d, stripe_enabled: prev }));
            toast.error('Failed: ' + e);
        }
    }

    async function testConnection() {
        setTesting(true);
        try {
            const res = await apiFetch<{ ok: boolean; message: string; account_id?: string }>(
                `/admin/api/orgs/${organizationSlug}/integrations/stripe/test`,
                { method: 'POST' },
            );
            if (res.ok) {
                toast.success(res.message);
            } else {
                toast.error(res.message);
            }
        } catch (e) {
            toast.error('Test failed: ' + e);
        } finally {
            setTesting(false);
        }
    }

    async function copyUrl(value: string) {
        try {
            await navigator.clipboard.writeText(value);
            setCopied('url');
            setTimeout(() => setCopied(null), 1500);
            toast.success('Copied');
        } catch (e) {
            toast.error('Clipboard blocked: ' + e);
        }
    }

    if (error) return <ErrorState description={error} />;
    if (settings === null) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-40" />
            </div>
        );
    }

    const enabled = drafts.stripe_enabled === 'true';
    // The backend masks secret values as "********" in GET responses. We
    // treat the mask as "configured but hidden" — at focus the field
    // clears so the user types a fresh value. Saving without typing is a
    // backend no-op (refuses to overwrite real secret with the mask).
    const SECRET_MASK = '********';
    const isMasked = (v: string) => v === SECRET_MASK;
    const clearIfMasked = (key: 'stripe_secret_key' | 'stripe_webhook_secret') => () => {
        if (isMasked(drafts[key])) {
            setDrafts((d) => ({ ...d, [key]: '' }));
        }
    };
    const hasSecret = !!drafts.stripe_secret_key.trim();
    const hasWhsec = !!drafts.stripe_webhook_secret.trim();
    const webhookUrl = `${agentApiBaseUrl}/admin/api/webhooks/stripe/${organizationSlug}`;

    const pillVariant = (h: IntegrationHealth | null) => {
        if (!h || h.health === 'unknown') return 'secondary';
        if (h.health === 'green') return 'success';
        if (h.health === 'yellow') return 'warning';
        return 'destructive';
    };

    return (
        <div className="space-y-4">
            {/* Status card */}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                                <CreditCard className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle>Stripe payment links</CardTitle>
                                <CardDescription>
                                    When a customer confirms a quote, Craig generates a
                                    Stripe Payment Link so they can pay immediately.
                                </CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant={pillVariant(health)}>
                                {health?.health ?? 'unknown'}
                            </Badge>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={testConnection}
                                disabled={testing || !hasSecret}
                                title="Validate the saved key against Stripe"
                            >
                                {testing ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <PlugZap className="h-3 w-3" />
                                )}{' '}
                                Test
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="text-sm">
                            <div className="text-slate-500">Status</div>
                            <div className="font-medium">
                                {enabled ? 'Enabled' : 'Disabled'}
                            </div>
                        </div>
                        <div className="text-sm">
                            <div className="text-slate-500">Configured</div>
                            <div className="font-medium">
                                {hasSecret && hasWhsec
                                    ? 'Keys present'
                                    : 'Missing key or webhook secret'}
                            </div>
                        </div>
                        <div className="text-sm sm:col-span-2">
                            <div className="text-slate-500">Last paid quote</div>
                            <div className="font-medium">
                                {health?.last_success_at
                                    ? new Date(health.last_success_at).toLocaleString('en-IE')
                                    : '—'}
                            </div>
                        </div>
                        {health?.notes && (
                            <p className="sm:col-span-2 text-xs text-slate-500">{health.notes}</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Webhook URL — the most important field, displayed first */}
            <Card>
                <CardHeader>
                    <CardTitle>1. Webhook URL</CardTitle>
                    <CardDescription>
                        Paste this into Stripe's Dashboard → Developers → Webhooks → Add
                        endpoint. Subscribe at minimum to:{' '}
                        <code>checkout.session.completed</code>,{' '}
                        <code>payment_intent.succeeded</code>,{' '}
                        <code>payment_intent.payment_failed</code>,{' '}
                        <code>charge.refunded</code>.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                        <Button variant="outline" onClick={() => copyUrl(webhookUrl)}>
                            {copied === 'url' ? (
                                <Check className="h-4 w-4" />
                            ) : (
                                <Copy className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Credentials */}
            <Card>
                <CardHeader>
                    <CardTitle>2. Credentials</CardTitle>
                    <CardDescription>
                        From Stripe Dashboard → Developers → API keys (secret) and
                        Webhooks → endpoint signing secret.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Secret key */}
                    <div className="space-y-1.5">
                        <Label htmlFor="stripe_secret_key">Stripe secret key</Label>
                        <div className="flex gap-2">
                            <Input
                                id="stripe_secret_key"
                                type={revealSecret ? 'text' : 'password'}
                                value={drafts.stripe_secret_key}
                                onChange={(e) =>
                                    setDrafts((d) => ({
                                        ...d,
                                        stripe_secret_key: e.target.value,
                                    }))
                                }
                                onFocus={clearIfMasked('stripe_secret_key')}
                                placeholder={
                                    isMasked(drafts.stripe_secret_key)
                                        ? 'Configured — type to replace'
                                        : 'sk_live_... or sk_test_...'
                                }
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setRevealSecret((r) => !r)}
                            >
                                {revealSecret ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </Button>
                            <Button
                                onClick={() => save('stripe_secret_key')}
                                disabled={saving === 'stripe_secret_key'}
                            >
                                {saving === 'stripe_secret_key' ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    'Save'
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Webhook secret */}
                    <div className="space-y-1.5">
                        <Label htmlFor="stripe_webhook_secret">Webhook signing secret</Label>
                        <div className="flex gap-2">
                            <Input
                                id="stripe_webhook_secret"
                                type={revealWhsec ? 'text' : 'password'}
                                value={drafts.stripe_webhook_secret}
                                onChange={(e) =>
                                    setDrafts((d) => ({
                                        ...d,
                                        stripe_webhook_secret: e.target.value,
                                    }))
                                }
                                onFocus={clearIfMasked('stripe_webhook_secret')}
                                placeholder={
                                    isMasked(drafts.stripe_webhook_secret)
                                        ? 'Configured — type to replace'
                                        : 'whsec_...'
                                }
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setRevealWhsec((r) => !r)}
                            >
                                {revealWhsec ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </Button>
                            <Button
                                onClick={() => save('stripe_webhook_secret')}
                                disabled={saving === 'stripe_webhook_secret'}
                            >
                                {saving === 'stripe_webhook_secret' ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    'Save'
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Currency */}
                    <div className="space-y-1.5">
                        <Label htmlFor="stripe_currency">Currency (ISO 4217)</Label>
                        <div className="flex gap-2">
                            <Input
                                id="stripe_currency"
                                value={drafts.stripe_currency}
                                onChange={(e) =>
                                    setDrafts((d) => ({
                                        ...d,
                                        stripe_currency: e.target.value
                                            .trim()
                                            .toLowerCase(),
                                    }))
                                }
                                placeholder="eur"
                                className="max-w-[120px]"
                            />
                            <Button
                                onClick={() => save('stripe_currency')}
                                disabled={saving === 'stripe_currency'}
                            >
                                Save
                            </Button>
                        </div>
                    </div>

                    {/* Success URL (optional) */}
                    <div className="space-y-1.5">
                        <Label htmlFor="stripe_success_url">Success URL (optional)</Label>
                        <div className="flex gap-2">
                            <Input
                                id="stripe_success_url"
                                value={drafts.stripe_success_url}
                                onChange={(e) =>
                                    setDrafts((d) => ({
                                        ...d,
                                        stripe_success_url: e.target.value,
                                    }))
                                }
                                placeholder="https://just-print.ie/thanks (defaults to Stripe's hosted page)"
                            />
                            <Button
                                onClick={() => save('stripe_success_url')}
                                disabled={saving === 'stripe_success_url'}
                            >
                                Save
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Master switch */}
            <Card>
                <CardHeader>
                    <CardTitle>3. Enable</CardTitle>
                    <CardDescription>
                        Master switch. When OFF, Craig never creates payment links —
                        regardless of whether keys are pasted. Flip ON only after a
                        successful test-mode round-trip.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                        <div>
                            <div className="font-medium">
                                {enabled ? 'Stripe is ON' : 'Stripe is OFF'}
                            </div>
                            <p className="text-xs text-slate-600">
                                Requires both secret key and webhook signing secret to be
                                set before flipping ON.
                            </p>
                        </div>
                        <Switch
                            checked={enabled}
                            onCheckedChange={toggleEnabled}
                            disabled={!hasSecret || !hasWhsec}
                            aria-label="Toggle Stripe"
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
