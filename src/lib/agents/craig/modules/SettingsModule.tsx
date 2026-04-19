'use client';
import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Scale, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AgentModuleProps } from '@/types/agent';
import type { CraigSetting } from '../api';
import { PageHeader } from '@/components/blocks/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/blocks/ErrorState';

const SYSTEM_PROMPT_KEY = 'system_prompt';
const BUSINESS_RULES_KEY = 'business_rules';

/**
 * Widget-specific settings live in the Connections tab (cleaner UX), and the
 * structured prompt pieces (personality + business rules) have dedicated
 * sections below — so hide them from the generic key/value list.
 */
const HIDDEN_KEYS = new Set<string>([
    'widget_primary_color',
    'widget_logo_url',
    'widget_greeting',
    'widget_font',
    'widget_accent_pink',
    'widget_accent_yellow',
    'widget_accent_blue',
    'widget_accents',
    'widget_stripe_mode',
    // Missive connection lives under the Connections tab.
    'missive_enabled',
    'missive_api_token',
    'missive_webhook_secret',
    'missive_from_address',
    'missive_from_name',
    SYSTEM_PROMPT_KEY,
    BUSINESS_RULES_KEY,
]);

function parseRules(raw: string | undefined | null): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.filter((r): r is string => typeof r === 'string');
        }
    } catch {
        // ignore
    }
    return [];
}

export function SettingsModule({ organizationSlug, apiFetch }: AgentModuleProps) {
    const [settings, setSettings] = useState<CraigSetting[] | null>(null);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [rulesDraft, setRulesDraft] = useState<string[]>([]);
    const [newRule, setNewRule] = useState('');
    const [saving, setSaving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [savedKey, setSavedKey] = useState<string | null>(null);

    useEffect(() => {
        apiFetch<{ settings: CraigSetting[] }>(`/admin/api/orgs/${organizationSlug}/settings`)
            .then((d) => {
                setSettings(d.settings);
                setDrafts(Object.fromEntries(d.settings.map((s) => [s.key, s.value])));
                const existingRules = d.settings.find((s) => s.key === BUSINESS_RULES_KEY);
                setRulesDraft(parseRules(existingRules?.value));
            })
            .catch((e) => setError(String(e)));
    }, [organizationSlug, apiFetch]);

    /** PATCH a setting. Backend upserts, so missing rows get created. */
    async function patchSetting(
        key: string,
        value: string,
        valueType: 'string' | 'float' | 'int' | 'json' = 'string',
    ) {
        const { setting } = await apiFetch<{ setting: CraigSetting }>(
            `/admin/api/orgs/${organizationSlug}/settings/${key}`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value, value_type: valueType }),
            },
        );
        setSettings((list) => {
            if (!list) return list;
            if (list.some((s) => s.key === key)) {
                return list.map((s) => (s.key === key ? setting : s));
            }
            return [...list, setting];
        });
        return setting;
    }

    async function saveScalar(key: string) {
        setSaving(key);
        try {
            const existing = settings?.find((s) => s.key === key);
            const vt = (existing?.value_type ?? 'string') as 'string' | 'float' | 'int' | 'json';
            await patchSetting(key, drafts[key] ?? '', vt);
            setSavedKey(key);
            toast.success(`${key.replace(/_/g, ' ')} saved`);
            setTimeout(() => setSavedKey(null), 1500);
        } catch (e) {
            toast.error('Failed: ' + e);
        } finally {
            setSaving(null);
        }
    }

    async function saveRules() {
        setSaving(BUSINESS_RULES_KEY);
        try {
            await patchSetting(BUSINESS_RULES_KEY, JSON.stringify(rulesDraft), 'json');
            setSavedKey(BUSINESS_RULES_KEY);
            toast.success('Business rules saved');
            setTimeout(() => setSavedKey(null), 1500);
        } catch (e) {
            toast.error('Failed: ' + e);
        } finally {
            setSaving(null);
        }
    }

    const savedRulesNormalized = useMemo(() => {
        const saved = parseRules(settings?.find((s) => s.key === BUSINESS_RULES_KEY)?.value);
        return JSON.stringify(saved);
    }, [settings]);
    const rulesDirty = JSON.stringify(rulesDraft) !== savedRulesNormalized;

    if (error) return <ErrorState description={error} />;
    if (settings === null) {
        return (
            <div className="space-y-4 max-w-3xl">
                <Skeleton className="h-64" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
            </div>
        );
    }

    const systemPrompt = settings.find((s) => s.key === SYSTEM_PROMPT_KEY);
    const regularSettings = settings.filter((s) => !HIDDEN_KEYS.has(s.key));

    function addRule() {
        const t = newRule.trim();
        if (!t) return;
        setRulesDraft((r) => [...r, t]);
        setNewRule('');
    }

    return (
        <div>
            <PageHeader
                title="Settings"
                description="Craig's personality, the extra business rules he always follows, and the pricing knobs."
            />

            <div className="space-y-6 max-w-3xl">
                {/* Assistant personality */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-slate-500" />
                            <CardTitle className="text-base">Assistant personality</CardTitle>
                        </div>
                        <CardDescription>
                            The personality, tone, and conversation style Craig uses. The live
                            product catalog (products, finishes, quantities, surcharges) is read
                            straight from your database and appended automatically — don&apos;t
                            hand-maintain it here. Add specific business rules below instead.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {systemPrompt ? (
                            <>
                                <Label htmlFor="system-prompt-textarea">Prompt</Label>
                                <Textarea
                                    id="system-prompt-textarea"
                                    value={drafts[SYSTEM_PROMPT_KEY] ?? ''}
                                    onChange={(e) =>
                                        setDrafts((d) => ({ ...d, [SYSTEM_PROMPT_KEY]: e.target.value }))
                                    }
                                    rows={18}
                                    className="mt-1 font-mono text-xs leading-relaxed"
                                />
                                <div className="mt-3 flex items-center justify-between">
                                    <div className="text-xs text-slate-500">
                                        {(drafts[SYSTEM_PROMPT_KEY] ?? '').length.toLocaleString()} characters
                                    </div>
                                    <Button
                                        onClick={() => saveScalar(SYSTEM_PROMPT_KEY)}
                                        disabled={
                                            saving === SYSTEM_PROMPT_KEY ||
                                            drafts[SYSTEM_PROMPT_KEY] === systemPrompt.value
                                        }
                                    >
                                        {saving === SYSTEM_PROMPT_KEY
                                            ? 'Saving\u2026'
                                            : savedKey === SYSTEM_PROMPT_KEY
                                              ? 'Saved \u2713'
                                              : 'Save personality'}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="text-sm text-slate-500">
                                No <code>system_prompt</code> row found for this tenant. Run the V4
                                seed migration on Craig&apos;s DB to initialize it.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Business rules — dynamic list, joined into the system prompt at runtime */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Scale className="h-4 w-4 text-slate-500" />
                            <CardTitle className="text-base">Business rules</CardTitle>
                        </div>
                        <CardDescription>
                            Plain-English rules Craig reads on every turn (on top of personality +
                            catalog). Great for edge cases: &quot;Always suggest soft-touch for
                            business cards&quot;, &quot;Never quote rush jobs&quot;, &quot;Round
                            quotes up to the nearest €5&quot;, etc.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {rulesDraft.length === 0 && (
                            <div className="text-xs text-slate-500 italic">
                                No extra rules yet. Add one below to override or extend Craig&apos;s defaults.
                            </div>
                        )}
                        {rulesDraft.map((rule, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <span className="mt-2.5 w-6 text-center text-xs font-mono text-slate-400">
                                    {i + 1}
                                </span>
                                <Textarea
                                    value={rule}
                                    onChange={(e) =>
                                        setRulesDraft((r) =>
                                            r.map((x, j) => (j === i ? e.target.value : x)),
                                        )
                                    }
                                    rows={2}
                                    className="flex-1 text-sm"
                                />
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="mt-1"
                                    onClick={() => setRulesDraft((r) => r.filter((_, j) => j !== i))}
                                    aria-label={`Remove rule ${i + 1}`}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}

                        {/* Add-rule row */}
                        <div className="flex items-center gap-2 pt-1">
                            <Input
                                value={newRule}
                                onChange={(e) => setNewRule(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addRule();
                                    }
                                }}
                                placeholder="Type a new rule and press Enter…"
                                className="flex-1"
                            />
                            <Button variant="outline" onClick={addRule} disabled={!newRule.trim()}>
                                <Plus className="h-3.5 w-3.5" />
                                Add
                            </Button>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button
                                onClick={saveRules}
                                disabled={saving === BUSINESS_RULES_KEY || !rulesDirty}
                            >
                                {saving === BUSINESS_RULES_KEY
                                    ? 'Saving\u2026'
                                    : savedKey === BUSINESS_RULES_KEY
                                      ? 'Saved \u2713'
                                      : 'Save rules'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Remaining scalar settings — numeric knobs like artwork_rate_eur, turnaround, etc. */}
                {regularSettings.length > 0 && (
                    <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
                            Pricing & operations
                        </h2>
                        <div className="space-y-4">
                            {regularSettings.map((s) => (
                                <Card key={s.key}>
                                    <CardHeader>
                                        <CardTitle className="text-sm capitalize">
                                            {s.key.replace(/_/g, ' ')}
                                        </CardTitle>
                                        {s.description && (
                                            <CardDescription>{s.description}</CardDescription>
                                        )}
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-end gap-3">
                                            <div className="flex-1">
                                                <Label htmlFor={`setting-${s.key}`}>Value</Label>
                                                <Input
                                                    id={`setting-${s.key}`}
                                                    value={drafts[s.key] ?? ''}
                                                    onChange={(e) =>
                                                        setDrafts({ ...drafts, [s.key]: e.target.value })
                                                    }
                                                    disabled={saving === s.key}
                                                />
                                                <div className="mt-1 text-[10px] text-slate-400">
                                                    Type: {s.value_type}
                                                </div>
                                            </div>
                                            <Button
                                                onClick={() => saveScalar(s.key)}
                                                disabled={saving === s.key || drafts[s.key] === s.value}
                                            >
                                                {saving === s.key
                                                    ? 'Saving\u2026'
                                                    : savedKey === s.key
                                                      ? 'Saved \u2713'
                                                      : 'Save'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
