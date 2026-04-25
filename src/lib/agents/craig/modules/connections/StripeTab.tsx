'use client';
import { useEffect, useState } from 'react';
import {
    CreditCard,
    Loader2,
    PlugZap,
    LinkIcon,
    Unlink,
    CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AgentModuleProps } from '@/types/agent';
import type { CraigSetting, StripeConnectStatus } from '../../api';
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
 * Stripe Connect tab — replaces the legacy paste-secret-key form.
 *
 * Two render branches:
 *   - Not connected: prominent "Connect with Stripe" button. The button
 *     is a plain anchor to /admin/api/oauth/stripe/start (which
 *     server-redirects to Stripe). Opening in same tab is intentional —
 *     OAuth popups have inconsistent cross-browser behavior.
 *   - Connected: read-only summary (account_id, email, connected date)
 *     + Test connection + Disconnect + the per-tenant currency/success_url
 *     fields the user can still tweak.
 *
 * The Connect platform credentials live in env vars on the server. This
 * UI intentionally has NO place to paste a sk_***-style key — that's
 * the entire point of the migration.
 *
 * Query param `?stripe=connected` / `?stripe=error&msg=...` is handled
 * by a parent component (see useStripeConnectToast hook).
 */

const NON_SECRET_KEYS = [
    'stripe_enabled',
    'stripe_currency',
    'stripe_success_url',
] as const;
type NonSecretKey = (typeof NON_SECRET_KEYS)[number];

const EMPTY: Record<NonSecretKey, string> = {
    stripe_enabled: 'false',
    stripe_currency: 'eur',
    stripe_success_url: '',
};

interface IntegrationHealth {
    health: 'green' | 'yellow' | 'red' | 'unknown';
    last_success_at: string | null;
    notes: string | null;
}

export function StripeTab({ organizationSlug, apiFetch }: AgentModuleProps) {
    const [status, setStatus] = useState<StripeConnectStatus | null>(null);
    const [settings, setSettings] = useState<Record<NonSecretKey, CraigSetting | null> | null>(null);
    const [drafts, setDrafts] = useState<Record<NonSecretKey, string>>(EMPTY);
    const [saving, setSaving] = useState<NonSecretKey | null>(null);
    const [testing, setTesting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [health, setHealth] = useState<IntegrationHealth | null>(null);

    /**
     * Initial load: pull both the Connect status (which view to render)
     * and the per-tenant non-secret settings (for the editable fields
     * shown in the connected branch).
     */
    useEffect(() => {
        let cancelled = false;
        Promise.all([
            apiFetch<StripeConnectStatus>(
                `/admin/api/orgs/${organizationSlug}/integrations/stripe/connect-status`,
            ),
            apiFetch<{ settings: CraigSetting[] }>(
                `/admin/api/orgs/${organizationSlug}/settings`,
            ),
        ])
            .then(([connectStatus, settingsResp]) => {
                if (cancelled) return;
                setStatus(connectStatus);

                const bag: Record<NonSecretKey, CraigSetting | null> = {
                    stripe_enabled: null,
                    stripe_currency: null,
                    stripe_success_url: null,
                };
                const draft = { ...EMPTY };
                for (const s of settingsResp.settings) {
                    if ((NON_SECRET_KEYS as readonly string[]).includes(s.key)) {
                        bag[s.key as NonSecretKey] = s;
                        draft[s.key as NonSecretKey] = s.value ?? '';
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

    /** Poll health every 30s while open. */
    useEffect(() => {
        let cancelled = false;
        async function fetchHealth() {
            try {
                const data = await apiFetch<{ stripe: IntegrationHealth }>(
                    `/admin/api/orgs/${organizationSlug}/integrations/status`,
                );
                if (!cancelled) setHealth(data.stripe);
            } catch {
                /* swallow — pill goes "unknown" */
            }
        }
        fetchHealth();
        const t = setInterval(fetchHealth, 30_000);
        return () => {
            cancelled = true;
            clearInterval(t);
        };
    }, [organizationSlug, apiFetch]);

    async function patch(key: NonSecretKey, value: string): Promise<CraigSetting> {
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

    async function save(key: NonSecretKey) {
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
            // Refresh status (enabled feeds into the health pill)
            const fresh = await apiFetch<StripeConnectStatus>(
                `/admin/api/orgs/${organizationSlug}/integrations/stripe/connect-status`,
            );
            setStatus(fresh);
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
            if (res.ok) toast.success(res.message);
            else toast.error(res.message);
        } catch (e) {
            toast.error('Test failed: ' + e);
        } finally {
            setTesting(false);
        }
    }

    async function handleDisconnect() {
        if (
            !confirm(
                "Disconnect from Stripe? Existing payment links stay valid until you cancel them in Stripe's dashboard. Already-paid quotes are unaffected. Reconnecting later requires going through the OAuth flow again.",
            )
        ) {
            return;
        }
        setDisconnecting(true);
        try {
            await apiFetch<{ ok: boolean }>(
                `/admin/api/orgs/${organizationSlug}/oauth/stripe/disconnect`,
                { method: 'POST' },
            );
            toast.success('Disconnected from Stripe');
            // Refresh status to switch the UI back to the "Not connected" view
            const fresh = await apiFetch<StripeConnectStatus>(
                `/admin/api/orgs/${organizationSlug}/integrations/stripe/connect-status`,
            );
            setStatus(fresh);
        } catch (e) {
            toast.error('Disconnect failed: ' + e);
        } finally {
            setDisconnecting(false);
        }
    }

    if (error) return <ErrorState description={error} />;
    if (!status || !settings) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-40" />
            </div>
        );
    }

    const enabled = drafts.stripe_enabled === 'true';

    const pillVariant = (h: IntegrationHealth | null) => {
        if (!h || h.health === 'unknown') return 'secondary';
        if (h.health === 'green') return 'success';
        if (h.health === 'yellow') return 'warning';
        return 'destructive';
    };

    /**
     * Two-step Connect flow — see backend `oauth_stripe_authorize_url`.
     * We fetch the authorize URL (carries our JWT), then navigate the
     * browser there. Cross-origin direct redirect wouldn't carry auth.
     */
    async function startConnect() {
        try {
            const res = await apiFetch<{ url: string }>(
                `/admin/api/orgs/${organizationSlug}/oauth/stripe/authorize-url`,
                { method: 'POST' },
            );
            window.location.href = res.url;
        } catch (e) {
            toast.error('Failed to start Connect flow: ' + e);
        }
    }

    // -------------------------------------------------------------------
    // Branch 1: NOT CONNECTED — show the "Connect with Stripe" CTA
    // -------------------------------------------------------------------
    if (!status.connected) {
        return (
            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                                    <CreditCard className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle>Connect Stripe</CardTitle>
                                    <CardDescription>
                                        One click to enable customer payments. Stripe handles
                                        the secure handoff — Strategos never sees your secret
                                        keys.
                                    </CardDescription>
                                </div>
                            </div>
                            <Badge variant={pillVariant(health)}>
                                {health?.health ?? 'unknown'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-4 text-sm text-slate-600">
                            When a customer confirms a quote, Craig will generate a Stripe
                            Payment Link automatically. Money flows directly to your Stripe
                            account — Strategos doesn't take a cut and doesn't custody your
                            funds.
                        </p>
                        <Button size="lg" onClick={startConnect}>
                            <LinkIcon className="h-4 w-4" />
                            Connect with Stripe
                        </Button>
                        <p className="mt-3 text-xs text-slate-500">
                            You'll be redirected to Stripe to authorize. After approving,
                            you'll land back here connected.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // -------------------------------------------------------------------
    // Branch 2: CONNECTED — show summary + Test/Disconnect + non-secret config
    // -------------------------------------------------------------------
    return (
        <div className="space-y-4">
            {/* Status card */}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle>Connected to Stripe</CardTitle>
                                <CardDescription>
                                    {status.user_email ?? 'Account linked'}{' '}
                                    <span className="font-mono text-xs">
                                        · {status.account_id}
                                    </span>
                                </CardDescription>
                            </div>
                        </div>
                        <Badge variant={pillVariant(health)}>
                            {health?.health ?? 'unknown'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="text-sm">
                            <div className="text-slate-500">Connected since</div>
                            <div className="font-medium">
                                {status.connected_at
                                    ? new Date(status.connected_at).toLocaleString('en-IE')
                                    : '—'}
                            </div>
                        </div>
                        <div className="text-sm">
                            <div className="text-slate-500">Last paid quote</div>
                            <div className="font-medium">
                                {health?.last_success_at
                                    ? new Date(health.last_success_at).toLocaleString('en-IE')
                                    : '—'}
                            </div>
                        </div>
                        {health?.notes && (
                            <p className="sm:col-span-2 text-xs text-slate-500">
                                {health.notes}
                            </p>
                        )}
                    </div>
                    <div className="mt-4 flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={testConnection}
                            disabled={testing}
                            title="Validate the saved Connect linkage against Stripe"
                        >
                            {testing ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <PlugZap className="h-3 w-3" />
                            )}
                            Test connection
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleDisconnect}
                            disabled={disconnecting}
                        >
                            {disconnecting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <Unlink className="h-3 w-3" />
                            )}
                            Disconnect
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Per-tenant config (non-secret) */}
            <Card>
                <CardHeader>
                    <CardTitle>Configuration</CardTitle>
                    <CardDescription>
                        These settings stay on your tenant. Currency feeds new
                        Payment Links; success URL is where Stripe redirects after a
                        successful payment.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                    <CardTitle>Enable</CardTitle>
                    <CardDescription>
                        Master switch. When OFF, Craig won't create payment links even
                        though Stripe is connected. Useful as a quick kill-switch
                        without disconnecting.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                        <div>
                            <div className="font-medium">
                                {enabled ? 'Stripe is ON' : 'Stripe is OFF'}
                            </div>
                            <p className="text-xs text-slate-600">
                                Toggling does not affect already-issued payment links.
                            </p>
                        </div>
                        <Switch
                            checked={enabled}
                            onCheckedChange={toggleEnabled}
                            aria-label="Toggle Stripe"
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
