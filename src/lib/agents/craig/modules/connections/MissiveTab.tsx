'use client';
import { useEffect, useMemo, useState } from 'react';
import {
    Mail,
    Copy,
    Check,
    Eye,
    EyeOff,
    RefreshCw,
    KeyRound,
    Webhook,
    AtSign,
} from 'lucide-react';
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
import { FormField } from '@/components/blocks/FormField';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/blocks/ErrorState';

// Keys this tab owns. Stored as per-tenant Settings rows on Craig's side;
// edited via the same `PATCH /admin/api/orgs/:slug/settings/:key` endpoint
// everything else uses.
const MISSIVE_KEYS = [
    'missive_enabled',
    'missive_api_token',
    'missive_webhook_secret',
    'missive_from_address',
    'missive_from_name',
] as const;
type MissiveKey = (typeof MISSIVE_KEYS)[number];

const EMPTY_DRAFTS: Record<MissiveKey, string> = {
    missive_enabled: 'false',
    missive_api_token: '',
    missive_webhook_secret: '',
    missive_from_address: '',
    missive_from_name: '',
};

/**
 * Cryptographically-random secret used when the user clicks "Regenerate".
 * 32 bytes of entropy, URL-safe base64. Matches the V9 seed's
 * secrets.token_urlsafe(32) on the server side.
 */
function randomSecret(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

export function MissiveTab({ organizationSlug, agentApiBaseUrl, apiFetch }: AgentModuleProps) {
    const [settings, setSettings] = useState<Record<MissiveKey, CraigSetting | null> | null>(null);
    const [drafts, setDrafts] = useState<Record<MissiveKey, string>>(EMPTY_DRAFTS);
    const [saving, setSaving] = useState<MissiveKey | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<'url' | 'secret' | null>(null);
    const [revealSecret, setRevealSecret] = useState(false);
    const [revealToken, setRevealToken] = useState(false);

    useEffect(() => {
        let cancelled = false;
        apiFetch<{ settings: CraigSetting[] }>(`/admin/api/orgs/${organizationSlug}/settings`)
            .then((d) => {
                if (cancelled) return;
                const bag: Record<MissiveKey, CraigSetting | null> = {
                    missive_enabled: null,
                    missive_api_token: null,
                    missive_webhook_secret: null,
                    missive_from_address: null,
                    missive_from_name: null,
                };
                const draft = { ...EMPTY_DRAFTS };
                for (const s of d.settings) {
                    if ((MISSIVE_KEYS as readonly string[]).includes(s.key)) {
                        bag[s.key as MissiveKey] = s;
                        draft[s.key as MissiveKey] = s.value ?? '';
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

    async function patch(key: MissiveKey, value: string) {
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

    async function save(key: MissiveKey) {
        setSaving(key);
        try {
            await patch(key, drafts[key]);
            toast.success(`${key.replace('missive_', '').replace(/_/g, ' ')} saved`);
        } catch (e) {
            toast.error('Failed: ' + e);
        } finally {
            setSaving(null);
        }
    }

    async function regenerateSecret() {
        if (
            !confirm(
                'Generate a new webhook secret? Any Missive rule still using the old secret will start returning 401 until you update it there too.',
            )
        ) {
            return;
        }
        const next = randomSecret();
        setDrafts((d) => ({ ...d, missive_webhook_secret: next }));
        try {
            await patch('missive_webhook_secret', next);
            toast.success('New secret generated — update it in your Missive rule');
            setRevealSecret(true);
        } catch (e) {
            toast.error('Failed: ' + e);
        }
    }

    async function toggleEnabled(next: boolean) {
        const value = next ? 'true' : 'false';
        setDrafts((d) => ({ ...d, missive_enabled: value }));
        try {
            await patch('missive_enabled', value);
            toast.success(next ? 'Missive connection enabled' : 'Missive connection disabled');
        } catch (e) {
            // revert on error
            setDrafts((d) => ({ ...d, missive_enabled: next ? 'false' : 'true' }));
            toast.error('Failed: ' + e);
        }
    }

    async function copyTo(kind: 'url' | 'secret', value: string) {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(kind);
            toast.success('Copied');
            setTimeout(() => setCopied(null), 1600);
        } catch (e) {
            toast.error('Clipboard blocked: ' + e);
        }
    }

    const webhookUrl = `${agentApiBaseUrl}/webhook/missive/${organizationSlug}`;

    const enabled = drafts.missive_enabled === 'true';
    const hasToken = !!drafts.missive_api_token.trim();
    const hasFromAddress = !!drafts.missive_from_address.trim();
    const hasSecret = !!drafts.missive_webhook_secret.trim();
    const readyToEnable = hasToken && hasFromAddress && hasSecret;

    // Short summary for the status card. Keeps the dirty-state logic predictable.
    const savedEnabled = useMemo(
        () => settings?.missive_enabled?.value === 'true',
        [settings],
    );

    if (error) return <ErrorState description={error} />;
    if (settings === null) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-40" />
                <Skeleton className="h-40" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Status card */}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                                <Mail className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle>Missive email</CardTitle>
                                <CardDescription>
                                    Inbound customer email → Craig drafts a reply → Justin
                                    reviews in Missive before sending.
                                </CardDescription>
                            </div>
                        </div>
                        <Badge variant={savedEnabled ? 'success' : 'secondary'}>
                            {savedEnabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-3">
                        <div>
                            <div className="text-sm font-semibold text-slate-900">
                                Enable Missive connection
                            </div>
                            <div className="text-xs text-slate-500">
                                {readyToEnable
                                    ? 'Token, secret, and from-address are all set — ready to go.'
                                    : 'Fill in the token, from-address, and secret below before enabling.'}
                            </div>
                        </div>
                        <Switch
                            checked={enabled}
                            disabled={!readyToEnable}
                            onCheckedChange={toggleEnabled}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Step 1 — API token */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-slate-500" />
                        <CardTitle className="text-sm">1. Paste your Missive API token</CardTitle>
                    </div>
                    <CardDescription>
                        In Missive: click your avatar (bottom-left) → <strong>Integrations</strong>
                        {' → '}<strong>API</strong> → <strong>Create token</strong>. Missive only
                        shows the token once — copy it immediately and paste it here.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <FormField label="API token" description="Stored server-side, never shown to customers.">
                        <div className="flex items-center gap-2">
                            <Input
                                type={revealToken ? 'text' : 'password'}
                                value={drafts.missive_api_token}
                                onChange={(e) =>
                                    setDrafts((d) => ({ ...d, missive_api_token: e.target.value }))
                                }
                                placeholder="missive_pat-..."
                                className="font-mono text-xs"
                                autoComplete="off"
                                spellCheck={false}
                            />
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setRevealToken((v) => !v)}
                                aria-label={revealToken ? 'Hide token' : 'Show token'}
                            >
                                {revealToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button
                                onClick={() => save('missive_api_token')}
                                disabled={
                                    saving === 'missive_api_token' ||
                                    drafts.missive_api_token ===
                                        (settings.missive_api_token?.value ?? '')
                                }
                            >
                                {saving === 'missive_api_token' ? 'Saving\u2026' : 'Save'}
                            </Button>
                        </div>
                    </FormField>
                </CardContent>
            </Card>

            {/* Step 2 — Webhook URL + secret */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Webhook className="h-4 w-4 text-slate-500" />
                        <CardTitle className="text-sm">2. Configure the webhook in Missive</CardTitle>
                    </div>
                    <CardDescription>
                        In Missive: <strong>Settings</strong> → <strong>Rules</strong> →{' '}
                        <strong>New rule</strong>. Condition:{' '}
                        <em>Received in inbox</em> → the inbox you want Craig watching. Action:{' '}
                        <em>Webhook</em>. Paste the URL and secret below.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField label="Webhook URL" description="Missive POSTs incoming emails here. HTTPS only.">
                        <div className="flex items-center gap-2">
                            <Input
                                readOnly
                                value={webhookUrl}
                                className="font-mono text-xs bg-slate-50"
                            />
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => copyTo('url', webhookUrl)}
                            >
                                {copied === 'url' ? (
                                    <Check className="h-3.5 w-3.5" />
                                ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                )}
                                {copied === 'url' ? 'Copied' : 'Copy'}
                            </Button>
                        </div>
                    </FormField>

                    <FormField
                        label="Shared secret (HMAC-SHA256)"
                        description="Paste this into the Missive rule's webhook action. Never share publicly."
                    >
                        <div className="flex items-center gap-2">
                            <Input
                                readOnly
                                type={revealSecret ? 'text' : 'password'}
                                value={drafts.missive_webhook_secret}
                                placeholder="(auto-generated on first deploy)"
                                className="font-mono text-xs bg-slate-50"
                            />
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setRevealSecret((v) => !v)}
                                aria-label={revealSecret ? 'Hide' : 'Show'}
                            >
                                {revealSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                    copyTo('secret', drafts.missive_webhook_secret)
                                }
                                disabled={!hasSecret}
                            >
                                {copied === 'secret' ? (
                                    <Check className="h-3.5 w-3.5" />
                                ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                )}
                                {copied === 'secret' ? 'Copied' : 'Copy'}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={regenerateSecret}
                                title="Rotate the secret"
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Regenerate
                            </Button>
                        </div>
                    </FormField>
                </CardContent>
            </Card>

            {/* Step 3 — Reply identity */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <AtSign className="h-4 w-4 text-slate-500" />
                        <CardTitle className="text-sm">3. Reply identity</CardTitle>
                    </div>
                    <CardDescription>
                        Who Craig&apos;s draft replies are attributed to in the Missive thread.
                        Usually the same address as the inbox you&apos;re watching.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField
                        label="From address"
                        description="The email address on the draft's From field. Should be an inbox Missive can send from."
                    >
                        <div className="flex items-center gap-2">
                            <Input
                                value={drafts.missive_from_address}
                                onChange={(e) =>
                                    setDrafts((d) => ({
                                        ...d,
                                        missive_from_address: e.target.value,
                                    }))
                                }
                                placeholder="info@just-print.ie"
                                className="font-mono text-xs"
                            />
                            <Button
                                onClick={() => save('missive_from_address')}
                                disabled={
                                    saving === 'missive_from_address' ||
                                    drafts.missive_from_address ===
                                        (settings.missive_from_address?.value ?? '')
                                }
                            >
                                {saving === 'missive_from_address' ? 'Saving\u2026' : 'Save'}
                            </Button>
                        </div>
                    </FormField>

                    <FormField
                        label="Display name"
                        description="How the sender name appears. Shows up in the recipient's inbox."
                    >
                        <div className="flex items-center gap-2">
                            <Input
                                value={drafts.missive_from_name}
                                onChange={(e) =>
                                    setDrafts((d) => ({ ...d, missive_from_name: e.target.value }))
                                }
                                placeholder="Craig @ Just Print"
                            />
                            <Button
                                onClick={() => save('missive_from_name')}
                                disabled={
                                    saving === 'missive_from_name' ||
                                    drafts.missive_from_name ===
                                        (settings.missive_from_name?.value ?? '')
                                }
                            >
                                {saving === 'missive_from_name' ? 'Saving\u2026' : 'Save'}
                            </Button>
                        </div>
                    </FormField>
                </CardContent>
            </Card>

            {/* Help footer */}
            <Card>
                <CardContent className="pt-6">
                    <div className="text-xs text-slate-600 space-y-2">
                        <div className="font-semibold">Once everything above is green:</div>
                        <ol className="list-decimal ml-5 space-y-1">
                            <li>Flip the toggle at the top to <strong>Enabled</strong>.</li>
                            <li>
                                Send a test email to the watched inbox from any outside address.
                            </li>
                            <li>
                                Within 15 seconds you should see a draft reply in the Missive
                                thread, and the conversation will show up in the{' '}
                                <strong>Conversations</strong> tab with channel{' '}
                                <code>missive</code>.
                            </li>
                        </ol>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
