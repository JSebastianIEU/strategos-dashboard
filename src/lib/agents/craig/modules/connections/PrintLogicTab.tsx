'use client';
import { useEffect, useState } from 'react';
import { Printer, Eye, EyeOff, Loader2, PlugZap, FlaskConical, X } from 'lucide-react';
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
 * Tenant-side PrintLogic configuration. Mirrors MissiveTab's shape but
 * for the 3 keys that drive the PrintLogic integration:
 *
 *   - printlogic_api_key  (string, secret)
 *   - printlogic_dry_run  ('true' | 'false') — SAFETY DEFAULT 'true'
 *   - printlogic_firm_id  (optional, for multi-firm PrintLogic accounts)
 *
 * The "live / dry-run / unconfigured" pill is driven by the
 * /integrations/status endpoint (refreshed every 30s while open).
 */

const PL_KEYS = [
    'printlogic_api_key',
    'printlogic_dry_run',
    'printlogic_firm_id',
] as const;
type PLKey = (typeof PL_KEYS)[number];

const EMPTY: Record<PLKey, string> = {
    printlogic_api_key: '',
    printlogic_dry_run: 'true',
    printlogic_firm_id: '',
};

interface IntegrationHealth {
    configured: boolean;
    enabled: boolean;
    health: 'green' | 'yellow' | 'red' | 'unknown';
    dry_run?: boolean;
    last_success_at?: string | null;
    last_error?: string | null;
    notes?: string | null;
}

interface TestOrder {
    present: boolean;
    order_id?: string;
    order_number?: string;
    customer_id?: string;
    marker?: string;
    created_at?: string;
    status?: 'open' | 'cancelled';
    dry_run?: boolean;
}

export function PrintLogicTab({ organizationSlug, apiFetch }: AgentModuleProps) {
    const [settings, setSettings] = useState<Record<PLKey, CraigSetting | null> | null>(null);
    const [drafts, setDrafts] = useState<Record<PLKey, string>>(EMPTY);
    const [saving, setSaving] = useState<PLKey | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [revealKey, setRevealKey] = useState(false);
    const [health, setHealth] = useState<IntegrationHealth | null>(null);
    const [testing, setTesting] = useState(false);
    const [testOrder, setTestOrder] = useState<TestOrder | null>(null);
    const [creatingTestOrder, setCreatingTestOrder] = useState(false);
    const [cancellingTestOrder, setCancellingTestOrder] = useState(false);

    async function loadTestOrder() {
        try {
            const data = await apiFetch<TestOrder>(
                `/admin/api/orgs/${organizationSlug}/integrations/printlogic/test-order`,
            );
            setTestOrder(data);
        } catch {
            /* swallow — card just hides */
        }
    }

    async function createTestOrder() {
        setCreatingTestOrder(true);
        try {
            const res = await apiFetch<{
                ok: boolean;
                dry_run: boolean;
                order_id?: string;
                order_number?: string;
                customer_id?: string;
                marker?: string;
                created_at?: string;
                error?: string;
            }>(
                `/admin/api/orgs/${organizationSlug}/integrations/printlogic/test-order`,
                { method: 'POST' },
            );
            if (!res.ok) {
                toast.error(`Test order failed: ${res.error ?? 'unknown'}`);
                return;
            }
            const tag = res.dry_run ? 'DRY-RUN' : 'LIVE';
            toast.success(
                `[${tag}] Test order created — order_number=${res.order_number}`,
            );
            await loadTestOrder();
        } catch (e) {
            toast.error('Test order failed: ' + e);
        } finally {
            setCreatingTestOrder(false);
        }
    }

    async function cancelTestOrder() {
        setCancellingTestOrder(true);
        try {
            const res = await apiFetch<{
                ok: boolean;
                dry_run?: boolean;
                order_number?: string;
                error?: string;
            }>(
                `/admin/api/orgs/${organizationSlug}/integrations/printlogic/test-order/cancel`,
                { method: 'POST' },
            );
            if (!res.ok) {
                toast.error(`Cancel failed: ${res.error ?? 'unknown'}`);
                return;
            }
            toast.success(
                res.dry_run
                    ? `Dry-run pointer cleared (no real order to cancel)`
                    : `Order ${res.order_number} marked Cancelled in PrintLogic`,
            );
            await loadTestOrder();
        } catch (e) {
            toast.error('Cancel failed: ' + e);
        } finally {
            setCancellingTestOrder(false);
        }
    }

    async function dismissTestOrderCard() {
        try {
            await apiFetch(
                `/admin/api/orgs/${organizationSlug}/integrations/printlogic/test-order/clear`,
                { method: 'POST' },
            );
            setTestOrder({ present: false });
        } catch (e) {
            toast.error('Dismiss failed: ' + e);
        }
    }

    async function testConnection() {
        setTesting(true);
        try {
            const res = await apiFetch<{ ok: boolean; message: string }>(
                `/admin/api/orgs/${organizationSlug}/integrations/printlogic/test`,
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

    // Load settings once
    useEffect(() => {
        let cancelled = false;
        apiFetch<{ settings: CraigSetting[] }>(`/admin/api/orgs/${organizationSlug}/settings`)
            .then((d) => {
                if (cancelled) return;
                const bag: Record<PLKey, CraigSetting | null> = {
                    printlogic_api_key: null,
                    printlogic_dry_run: null,
                    printlogic_firm_id: null,
                };
                const draft = { ...EMPTY };
                for (const s of d.settings) {
                    if ((PL_KEYS as readonly string[]).includes(s.key)) {
                        bag[s.key as PLKey] = s;
                        draft[s.key as PLKey] = s.value ?? '';
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

    // Load last test order on mount + when api_key changes
    useEffect(() => {
        loadTestOrder();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organizationSlug]);

    // Poll health every 30s while tab is open
    useEffect(() => {
        let cancelled = false;
        async function fetchHealth() {
            try {
                const data = await apiFetch<{ printlogic: IntegrationHealth }>(
                    `/admin/api/orgs/${organizationSlug}/integrations/status`,
                );
                if (!cancelled) setHealth(data.printlogic);
            } catch {
                /* swallow — pill just goes unknown */
            }
        }
        fetchHealth();
        const t = setInterval(fetchHealth, 30_000);
        return () => {
            cancelled = true;
            clearInterval(t);
        };
    }, [organizationSlug, apiFetch]);

    async function patch(key: PLKey, value: string): Promise<CraigSetting> {
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

    async function save(key: PLKey) {
        setSaving(key);
        try {
            await patch(key, drafts[key]);
            toast.success(`${key.replace('printlogic_', '')} saved`);
        } catch (e) {
            toast.error('Failed: ' + e);
        } finally {
            setSaving(null);
        }
    }

    async function toggleDryRun(next: boolean) {
        // Inverted UI: switch ON = "live mode" (dry_run=false), OFF = dry_run=true
        const value = next ? 'false' : 'true';
        const prev = drafts.printlogic_dry_run;
        setDrafts((d) => ({ ...d, printlogic_dry_run: value }));
        try {
            await patch('printlogic_dry_run', value);
            toast.success(
                next
                    ? 'LIVE mode enabled — pushes will hit real PrintLogic. Stage 3 ceremony required first.'
                    : 'Dry-run mode restored — pushes return synthetic DRY-xxxx ids only.',
            );
        } catch (e) {
            setDrafts((d) => ({ ...d, printlogic_dry_run: prev }));
            toast.error('Failed: ' + e);
        }
    }

    if (error) return <ErrorState description={error} />;
    if (settings === null) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-32" />
            </div>
        );
    }

    const dryRun = drafts.printlogic_dry_run !== 'false';
    const hasKey = !!drafts.printlogic_api_key.trim();
    const SECRET_MASK = '********';
    const isMasked = (v: string) => v === SECRET_MASK;
    const clearIfMaskedKey = () => {
        if (isMasked(drafts.printlogic_api_key)) {
            setDrafts((d) => ({ ...d, printlogic_api_key: '' }));
        }
    };

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
                                <Printer className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle>PrintLogic order push</CardTitle>
                                <CardDescription>
                                    Push confirmed quotes straight into Just Print's
                                    PrintLogic. Default is dry-run — no real orders
                                    until a supervised ceremony with Justin.
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
                                disabled={testing || !hasKey}
                                title="Read-only validation of the api_key + firm binding"
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
                            <div className="text-slate-500">Configured</div>
                            <div className="font-medium">{hasKey ? 'Yes' : 'No api_key set'}</div>
                        </div>
                        <div className="text-sm">
                            <div className="text-slate-500">Mode</div>
                            <div className="font-medium">
                                {dryRun ? 'Dry-run (safe)' : 'LIVE — real pushes'}
                            </div>
                        </div>
                        <div className="text-sm sm:col-span-2">
                            <div className="text-slate-500">Last successful push</div>
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

            {/* Test-order probe — create + cancel a sentinel PrintLogic order */}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                                <FlaskConical className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle>Test order probe</CardTitle>
                                <CardDescription>
                                    Push a sentinel order tagged{' '}
                                    <code>[CRAIG-PROBE-DELETE-ME]</code> to validate
                                    the full create→cancel cycle. In dry-run mode this
                                    returns a synthetic <code>DRY-xxxx</code> id without
                                    contacting PrintLogic. In live mode it creates a real
                                    order — cancel it immediately after the demo.
                                </CardDescription>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {testOrder?.present ? (
                        <div className="rounded-lg border bg-slate-50 p-4 space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-medium">
                                    Last test order
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant={testOrder.dry_run ? 'secondary' : 'warning'}>
                                        {testOrder.dry_run ? 'Dry-run' : 'LIVE'}
                                    </Badge>
                                    <Badge variant={testOrder.status === 'cancelled' ? 'success' : 'secondary'}>
                                        {testOrder.status === 'cancelled' ? 'Cancelled' : 'Open'}
                                    </Badge>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                                <div>
                                    <span className="text-slate-500">order_number: </span>
                                    <code className="font-mono">{testOrder.order_number}</code>
                                </div>
                                <div>
                                    <span className="text-slate-500">order_id: </span>
                                    <code className="font-mono">{testOrder.order_id}</code>
                                </div>
                                <div>
                                    <span className="text-slate-500">customer_id: </span>
                                    <code className="font-mono">{testOrder.customer_id || '—'}</code>
                                </div>
                                <div>
                                    <span className="text-slate-500">created: </span>
                                    {testOrder.created_at
                                        ? new Date(testOrder.created_at).toLocaleString('en-IE')
                                        : '—'}
                                </div>
                                {testOrder.marker && (
                                    <div className="sm:col-span-2">
                                        <span className="text-slate-500">marker: </span>
                                        <code className="font-mono">{testOrder.marker}</code>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2 pt-2">
                                {testOrder.status !== 'cancelled' && (
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={cancelTestOrder}
                                        disabled={cancellingTestOrder}
                                    >
                                        {cancellingTestOrder ? (
                                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                        ) : (
                                            <X className="mr-1 h-3 w-3" />
                                        )}
                                        Cancel order
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={dismissTestOrderCard}
                                    disabled={cancellingTestOrder || creatingTestOrder}
                                    title="Clear from the dashboard (does not touch PrintLogic)"
                                >
                                    Dismiss
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={createTestOrder}
                                    disabled={creatingTestOrder || !hasKey}
                                >
                                    {creatingTestOrder ? (
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    ) : (
                                        <FlaskConical className="mr-1 h-3 w-3" />
                                    )}
                                    Create another
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-4">
                            <div className="text-sm text-slate-600">
                                No test order on file.{' '}
                                {dryRun
                                    ? 'Will return a synthetic DRY-xxxx id.'
                                    : 'Will create a REAL PrintLogic order — cancel after the demo.'}
                            </div>
                            <Button
                                size="sm"
                                onClick={createTestOrder}
                                disabled={creatingTestOrder || !hasKey}
                            >
                                {creatingTestOrder ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                    <FlaskConical className="mr-1 h-3 w-3" />
                                )}
                                Create test order
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Settings form */}
            <Card>
                <CardHeader>
                    <CardTitle>Credentials</CardTitle>
                    <CardDescription>
                        Get the API key from Alexander at Wildcard, or from PrintLogic's API
                        settings if Justin manages it directly.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* api_key */}
                    <div className="space-y-1.5">
                        <Label htmlFor="printlogic_api_key">PrintLogic API key</Label>
                        <div className="flex gap-2">
                            <Input
                                id="printlogic_api_key"
                                type={revealKey ? 'text' : 'password'}
                                value={drafts.printlogic_api_key}
                                onChange={(e) =>
                                    setDrafts((d) => ({
                                        ...d,
                                        printlogic_api_key: e.target.value,
                                    }))
                                }
                                onFocus={clearIfMaskedKey}
                                placeholder={
                                    isMasked(drafts.printlogic_api_key)
                                        ? 'Configured — type to replace'
                                        : 'paste the API key here'
                                }
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setRevealKey((r) => !r)}
                                title={revealKey ? 'Hide' : 'Show'}
                            >
                                {revealKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button
                                onClick={() => save('printlogic_api_key')}
                                disabled={saving === 'printlogic_api_key'}
                            >
                                {saving === 'printlogic_api_key' ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    'Save'
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* firm_id */}
                    <div className="space-y-1.5">
                        <Label htmlFor="printlogic_firm_id">Firm id (optional)</Label>
                        <div className="flex gap-2">
                            <Input
                                id="printlogic_firm_id"
                                value={drafts.printlogic_firm_id}
                                onChange={(e) =>
                                    setDrafts((d) => ({
                                        ...d,
                                        printlogic_firm_id: e.target.value,
                                    }))
                                }
                                placeholder="leave blank unless using a multi-firm account"
                            />
                            <Button
                                onClick={() => save('printlogic_firm_id')}
                                disabled={saving === 'printlogic_firm_id'}
                            >
                                Save
                            </Button>
                        </div>
                    </div>

                    {/* dry_run switch */}
                    <div className="flex items-start justify-between gap-4 rounded-lg border bg-amber-50 p-4">
                        <div>
                            <div className="font-medium">Live mode</div>
                            <p className="text-xs text-slate-600">
                                When OFF, pushes return synthetic <code>DRY-xxxx</code> ids
                                without touching PrintLogic. <strong>Only flip ON</strong>{' '}
                                during a supervised ceremony — every push from this point
                                creates a real order.
                            </p>
                        </div>
                        <Switch
                            checked={!dryRun}
                            onCheckedChange={toggleDryRun}
                            aria-label="Toggle live mode"
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
