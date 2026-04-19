'use client';
import { useEffect, useMemo, useState } from 'react';
import {
    Globe,
    Copy,
    Check,
    ExternalLink,
    Palette,
    MessageSquareText,
    Plus,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AgentModuleProps } from '@/types/agent';
import type { CraigSetting } from '../../api';
import type { WidgetStripeMode } from '../../api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FormField } from '@/components/blocks/FormField';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/blocks/ErrorState';

// Keys we manage from this tab. Scalar strings + two V5 keys
// (widget_accents JSON array, widget_stripe_mode enum).
const SCALAR_KEYS = [
    'widget_primary_color',
    'widget_logo_url',
    'widget_greeting',
    'widget_font',
    // Legacy 3-slot accents — read for backwards compat when widget_accents
    // isn't set yet, but never exposed as editable fields any more.
    'widget_accent_pink',
    'widget_accent_yellow',
    'widget_accent_blue',
] as const;
type ScalarKey = (typeof SCALAR_KEYS)[number];

const ACCENTS_KEY = 'widget_accents';
const STRIPE_MODE_KEY = 'widget_stripe_mode';

const LABELS: Record<ScalarKey, string> = {
    widget_primary_color: 'Primary color',
    widget_logo_url: 'Logo URL',
    widget_greeting: 'Opening greeting',
    widget_font: 'Font (Google Fonts name)',
    widget_accent_pink: 'Accent 1 (legacy)',
    widget_accent_yellow: 'Accent 2 (legacy)',
    widget_accent_blue: 'Accent 3 (legacy)',
};

const HINTS: Partial<Record<ScalarKey, string>> = {
    widget_primary_color: 'Hex, e.g. #040f2a. Used on the chat bubble, header, and action buttons.',
    widget_logo_url: 'Public URL to your logo — shown in the widget header. Leave empty to use a letter placeholder.',
    widget_greeting: 'The first message the customer sees when they open the chat.',
    widget_font: "Any Google Font family. Leave as 'Poppins' if unsure.",
};

// Just Print's tiger — the default avatar the live widget falls back to when
// no `widget_logo_url` has been explicitly set. Kept in sync with static/widget.js.
const DEFAULT_LOGO_URL =
    'https://just-print.ie/wp-content/themes/just-print/assets/img/tiger_760.png';

const STRIPE_MODES: { value: WidgetStripeMode; label: string; help: string }[] = [
    { value: 'sections', label: 'Sections', help: 'Solid bands, one per color' },
    { value: 'gradient', label: 'Gradient', help: 'Smooth blend between colors' },
    { value: 'solid', label: 'Solid', help: 'Single color (the first accent)' },
];

const FALLBACK_ACCENTS = ['#e30686', '#feea03', '#3e8fcd', '#040f2a'];

function parseAccents(raw: string | undefined): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.filter((v): v is string => typeof v === 'string' && !!v.trim());
        }
    } catch {
        // fall through
    }
    return [];
}

function buildStripeBackground(accents: string[], mode: WidgetStripeMode, primary: string): string {
    const colors = accents.length ? accents : [primary];
    if (mode === 'solid') return colors[0];
    if (mode === 'gradient') {
        if (colors.length === 1) return colors[0];
        return `linear-gradient(90deg, ${colors.join(', ')})`;
    }
    // sections
    if (colors.length === 1) return colors[0];
    const step = 100 / colors.length;
    const stops = colors.map((c, i) => `${c} ${(i * step).toFixed(4)}% ${((i + 1) * step).toFixed(4)}%`);
    return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/**
 * Widget tab — status + embed snippet + live customization of the widget's
 * branding/greeting via the existing `PATCH /settings/:key` endpoint. Accents
 * and stripe rendering mode are dynamic (any number of colors).
 */
export function WidgetTab({ organizationSlug, agentApiBaseUrl, apiFetch }: AgentModuleProps) {
    const [settings, setSettings] = useState<Record<string, CraigSetting | null> | null>(null);
    const [drafts, setDrafts] = useState<Record<ScalarKey, string>>({
        widget_primary_color: '',
        widget_logo_url: '',
        widget_greeting: '',
        widget_font: '',
        widget_accent_pink: '',
        widget_accent_yellow: '',
        widget_accent_blue: '',
    });
    const [accentsDraft, setAccentsDraft] = useState<string[]>([]);
    const [stripeModeDraft, setStripeModeDraft] = useState<WidgetStripeMode>('sections');
    const [saving, setSaving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let cancelled = false;
        apiFetch<{ settings: CraigSetting[] }>(`/admin/api/orgs/${organizationSlug}/settings`)
            .then((d) => {
                if (cancelled) return;
                const bag: Record<string, CraigSetting | null> = {};
                const draft: Record<ScalarKey, string> = {
                    widget_primary_color: '',
                    widget_logo_url: '',
                    widget_greeting: '',
                    widget_font: '',
                    widget_accent_pink: '',
                    widget_accent_yellow: '',
                    widget_accent_blue: '',
                };
                for (const s of d.settings) {
                    bag[s.key] = s;
                    if ((SCALAR_KEYS as readonly string[]).includes(s.key)) {
                        draft[s.key as ScalarKey] = s.value ?? '';
                    }
                }
                setSettings(bag);
                setDrafts(draft);

                // Initialize accents draft: prefer widget_accents JSON, else
                // fall back to legacy pink/yellow/blue + primary, else a
                // sensible default.
                const fromJson = parseAccents(bag[ACCENTS_KEY]?.value);
                let initialAccents = fromJson;
                if (initialAccents.length === 0) {
                    const legacy = [
                        draft.widget_accent_pink,
                        draft.widget_accent_yellow,
                        draft.widget_accent_blue,
                        draft.widget_primary_color,
                    ].filter(Boolean);
                    initialAccents = legacy.length > 0 ? legacy : FALLBACK_ACCENTS;
                }
                setAccentsDraft(initialAccents);

                const savedMode = bag[STRIPE_MODE_KEY]?.value as WidgetStripeMode | undefined;
                setStripeModeDraft(
                    savedMode && STRIPE_MODES.some((m) => m.value === savedMode)
                        ? savedMode
                        : 'sections',
                );
            })
            .catch((e) => !cancelled && setError(String(e)));
        return () => {
            cancelled = true;
        };
    }, [organizationSlug, apiFetch]);

    /** PATCH one setting row. If the row doesn't exist yet the admin API creates it. */
    async function patchSetting(key: string, value: string, valueType: 'string' | 'json' = 'string') {
        const { setting } = await apiFetch<{ setting: CraigSetting }>(
            `/admin/api/orgs/${organizationSlug}/settings/${key}`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value, value_type: valueType }),
            },
        );
        setSettings((prev) => prev && { ...prev, [key]: setting });
        return setting;
    }

    async function saveScalar(key: ScalarKey) {
        setSaving(key);
        try {
            await patchSetting(key, drafts[key]);
            toast.success(`${LABELS[key]} saved`);
        } catch (e) {
            toast.error('Failed: ' + e);
        } finally {
            setSaving(null);
        }
    }

    async function saveStripe() {
        setSaving('stripe');
        try {
            await Promise.all([
                patchSetting(ACCENTS_KEY, JSON.stringify(accentsDraft), 'json'),
                patchSetting(STRIPE_MODE_KEY, stripeModeDraft),
            ]);
            toast.success('Stripe updated');
        } catch (e) {
            toast.error('Failed: ' + e);
        } finally {
            setSaving(null);
        }
    }

    const embedSnippet =
        `<script src="${agentApiBaseUrl}/widget.js" data-client="${organizationSlug}" defer></script>`;

    async function copyEmbed() {
        try {
            await navigator.clipboard.writeText(embedSnippet);
            setCopied(true);
            toast.success('Embed snippet copied');
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            toast.error('Clipboard blocked: ' + e);
        }
    }

    const { savedAccents, savedStripeMode, savedAccentsRaw, savedStripeRaw } = useMemo(() => {
        if (!settings) {
            return {
                savedAccents: FALLBACK_ACCENTS,
                savedStripeMode: 'sections' as WidgetStripeMode,
                savedAccentsRaw: '',
                savedStripeRaw: 'sections',
            };
        }
        const fromJson = parseAccents(settings[ACCENTS_KEY]?.value);
        let accents = fromJson;
        if (accents.length === 0) {
            const legacy = [
                settings.widget_accent_pink?.value,
                settings.widget_accent_yellow?.value,
                settings.widget_accent_blue?.value,
                settings.widget_primary_color?.value,
            ].filter((x): x is string => !!x);
            accents = legacy.length > 0 ? legacy : FALLBACK_ACCENTS;
        }
        const mode = (settings[STRIPE_MODE_KEY]?.value as WidgetStripeMode) || 'sections';
        return {
            savedAccents: accents,
            savedStripeMode: STRIPE_MODES.some((m) => m.value === mode) ? mode : 'sections',
            savedAccentsRaw: settings[ACCENTS_KEY]?.value ?? '',
            savedStripeRaw: settings[STRIPE_MODE_KEY]?.value ?? 'sections',
        };
    }, [settings]);

    if (error) return <ErrorState description={error} />;
    if (settings === null) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-32" />
                <Skeleton className="h-40" />
            </div>
        );
    }

    // Currently-saved values (not the editable drafts) — the live widget state.
    const savedPrimary = settings.widget_primary_color?.value || '#040f2a';
    const savedFont = settings.widget_font?.value || 'Poppins';
    const savedLogo = settings.widget_logo_url?.value || DEFAULT_LOGO_URL;
    const isDefaultLogo = !settings.widget_logo_url?.value;
    const savedGreeting =
        settings.widget_greeting?.value || 'Hey — Craig here. What are you looking to print?';

    const savedStripeBg = buildStripeBackground(savedAccents, savedStripeMode, savedPrimary);
    const draftStripeBg = buildStripeBackground(
        accentsDraft.length ? accentsDraft : [drafts.widget_primary_color || '#040f2a'],
        stripeModeDraft,
        drafts.widget_primary_color || '#040f2a',
    );

    // Normalize both sides so whitespace / re-ordering in the stored JSON
    // doesn't make the "Save" button look dirty when nothing actually changed.
    const savedAccentsNormalized = JSON.stringify(parseAccents(savedAccentsRaw));
    const stripeDirty =
        JSON.stringify(accentsDraft) !== savedAccentsNormalized ||
        stripeModeDraft !== (savedStripeRaw || 'sections');

    return (
        <div className="space-y-4">
            {/* Currently in use — live preview */}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div
                                className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                                style={{ background: savedPrimary }}
                            >
                                <Globe className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle>Currently in use</CardTitle>
                                <CardDescription>
                                    What customers see right now when they open the widget.
                                </CardDescription>
                            </div>
                        </div>
                        <Badge variant="success">Enabled</Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Mini preview: header bar + greeting bubble */}
                    <div
                        className="rounded-lg overflow-hidden border border-slate-200"
                        style={{ fontFamily: `'${savedFont}', sans-serif` }}
                    >
                        <div
                            className="relative flex items-center gap-3 p-3 text-white"
                            style={{ background: savedPrimary }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={savedLogo}
                                alt=""
                                className="h-9 w-9 rounded-full object-cover border-2 border-white/20 bg-white/10"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.visibility = 'hidden';
                                }}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold truncate">
                                    {organizationSlug}
                                </div>
                                <div className="text-[10px] opacity-70">Craig · AI</div>
                            </div>
                            <div
                                className="absolute left-0 right-0 bottom-0 h-[3px]"
                                style={{ background: savedStripeBg }}
                            />
                        </div>
                        <div className="bg-slate-50 p-4">
                            <div className="inline-block bg-white rounded-2xl rounded-bl-md shadow-sm px-3 py-2 text-sm text-slate-800 max-w-[85%]">
                                {savedGreeting}
                            </div>
                        </div>
                    </div>

                    {/* Swatches (one per accent) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <Swatch label="Primary" color={savedPrimary} />
                        {savedAccents.map((c, i) => (
                            <Swatch key={`${c}-${i}`} label={`Accent ${i + 1}`} color={c} />
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center text-xs text-slate-600">
                        <Badge variant="secondary">Font: {savedFont}</Badge>
                        <Badge variant="secondary">Logo: {isDefaultLogo ? 'default' : 'custom'}</Badge>
                        <Badge variant="secondary">Stripe: {savedStripeMode}</Badge>
                        <Badge variant="secondary">
                            Greeting: {savedGreeting.length} chars
                        </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                        <Button asChild size="sm">
                            <a href={agentApiBaseUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open live widget
                            </a>
                        </Button>
                        <span className="text-[10px] text-slate-500 self-center font-mono truncate">
                            {agentApiBaseUrl}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Embed snippet */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Install on your site</CardTitle>
                    <CardDescription>
                        Paste this one line just before <code>&lt;/body&gt;</code>. The{' '}
                        <code>data-client</code> attribute tells Craig which tenant&apos;s catalog to use.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="relative">
                        <pre className="bg-slate-950 text-slate-100 rounded-md p-3 text-[11px] overflow-x-auto font-mono">
                            <code>{embedSnippet}</code>
                        </pre>
                        <Button
                            size="sm"
                            variant="secondary"
                            className="absolute top-2 right-2"
                            onClick={copyEmbed}
                        >
                            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied ? 'Copied' : 'Copy'}
                        </Button>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1.5">
                        <div className="font-semibold">WordPress install:</div>
                        <ul className="list-disc ml-5 space-y-1 text-slate-600">
                            <li>Easiest: install the{' '}
                                <a
                                    href="https://wordpress.org/plugins/header-footer-code-manager/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline"
                                >
                                    Header Footer Code Manager
                                </a>{' '}
                                plugin and paste the snippet into a new Footer snippet.
                            </li>
                            <li>
                                If using Elementor: add a <em>Custom HTML</em> widget to the footer
                                template and paste.
                            </li>
                            <li>
                                If editing theme files directly: add it right before the closing{' '}
                                <code>&lt;/body&gt;</code> tag of your theme&apos;s <code>footer.php</code>.
                            </li>
                        </ul>
                    </div>
                </CardContent>
            </Card>

            {/* Branding (scalar fields) */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-slate-500" />
                        <CardTitle className="text-sm">Branding</CardTitle>
                    </div>
                    <CardDescription>
                        Changes take effect the next time a customer opens the widget.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField label={LABELS.widget_primary_color} description={HINTS.widget_primary_color}>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={drafts.widget_primary_color || '#040f2a'}
                                onChange={(e) =>
                                    setDrafts((d) => ({ ...d, widget_primary_color: e.target.value }))
                                }
                                className="h-9 w-12 cursor-pointer rounded-md border border-slate-200"
                            />
                            <Input
                                value={drafts.widget_primary_color}
                                onChange={(e) =>
                                    setDrafts((d) => ({ ...d, widget_primary_color: e.target.value }))
                                }
                                className="flex-1 font-mono text-xs"
                                placeholder="#040f2a"
                            />
                            <Button
                                onClick={() => saveScalar('widget_primary_color')}
                                disabled={
                                    saving === 'widget_primary_color' ||
                                    drafts.widget_primary_color === settings.widget_primary_color?.value
                                }
                            >
                                {saving === 'widget_primary_color' ? 'Saving\u2026' : 'Save'}
                            </Button>
                        </div>
                    </FormField>

                    <FormField label={LABELS.widget_logo_url} description={HINTS.widget_logo_url}>
                        <div className="flex items-center gap-2">
                            <Input
                                value={drafts.widget_logo_url}
                                onChange={(e) =>
                                    setDrafts((d) => ({ ...d, widget_logo_url: e.target.value }))
                                }
                                placeholder="https://example.com/logo.png"
                            />
                            {drafts.widget_logo_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={drafts.widget_logo_url}
                                    alt=""
                                    className="h-9 w-9 rounded-md object-cover border border-slate-200"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            )}
                            <Button
                                onClick={() => saveScalar('widget_logo_url')}
                                disabled={
                                    saving === 'widget_logo_url' ||
                                    drafts.widget_logo_url === (settings.widget_logo_url?.value ?? '')
                                }
                            >
                                {saving === 'widget_logo_url' ? 'Saving\u2026' : 'Save'}
                            </Button>
                        </div>
                    </FormField>

                    <FormField label={LABELS.widget_font} description={HINTS.widget_font}>
                        <div className="flex items-center gap-2">
                            <Input
                                value={drafts.widget_font}
                                onChange={(e) => setDrafts((d) => ({ ...d, widget_font: e.target.value }))}
                                placeholder="Poppins"
                            />
                            <Button
                                onClick={() => saveScalar('widget_font')}
                                disabled={
                                    saving === 'widget_font' ||
                                    drafts.widget_font === settings.widget_font?.value
                                }
                            >
                                {saving === 'widget_font' ? 'Saving\u2026' : 'Save'}
                            </Button>
                        </div>
                    </FormField>
                </CardContent>
            </Card>

            {/* Stripe: dynamic accents + render mode */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-slate-500" />
                        <CardTitle className="text-sm">Stripe & accents</CardTitle>
                    </div>
                    <CardDescription>
                        The stripe under the widget header + quote cards + typing dots. Add as many
                        colors as you like, pick how they&apos;re painted.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    {/* Mode selector */}
                    <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Mode
                        </Label>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                            {STRIPE_MODES.map((m) => {
                                const active = stripeModeDraft === m.value;
                                return (
                                    <button
                                        key={m.value}
                                        type="button"
                                        onClick={() => setStripeModeDraft(m.value)}
                                        className={`text-left rounded-md border p-2.5 transition ${
                                            active
                                                ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="text-sm font-semibold text-slate-900">
                                            {m.label}
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                            {m.help}
                                        </div>
                                        <div
                                            className="mt-2 h-1.5 rounded-full"
                                            style={{
                                                background: buildStripeBackground(
                                                    accentsDraft.length
                                                        ? accentsDraft
                                                        : [drafts.widget_primary_color || '#040f2a'],
                                                    m.value,
                                                    drafts.widget_primary_color || '#040f2a',
                                                ),
                                            }}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Accent list */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Colors ({accentsDraft.length})
                            </Label>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                    setAccentsDraft((a) => [...a, '#6366f1'])
                                }
                                disabled={accentsDraft.length >= 12}
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add color
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {accentsDraft.length === 0 && (
                                <div className="text-xs text-slate-500 italic">
                                    No colors — stripe will use the primary color.
                                </div>
                            )}
                            {accentsDraft.map((color, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="w-6 text-center text-xs font-mono text-slate-400">
                                        {i + 1}
                                    </span>
                                    <input
                                        type="color"
                                        value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#000000'}
                                        onChange={(e) =>
                                            setAccentsDraft((a) =>
                                                a.map((c, j) => (j === i ? e.target.value : c)),
                                            )
                                        }
                                        className="h-9 w-12 cursor-pointer rounded-md border border-slate-200"
                                    />
                                    <Input
                                        value={color}
                                        onChange={(e) =>
                                            setAccentsDraft((a) =>
                                                a.map((c, j) => (j === i ? e.target.value : c)),
                                            )
                                        }
                                        className="flex-1 font-mono text-xs"
                                        placeholder="#000000"
                                    />
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() =>
                                            setAccentsDraft((a) => a.filter((_, j) => j !== i))
                                        }
                                        aria-label={`Remove color ${i + 1}`}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Live preview of the stripe using drafts */}
                    <div>
                        <Label>Preview</Label>
                        <div
                            className="mt-1 h-3 rounded-full border border-slate-200"
                            style={{ background: draftStripeBg }}
                        />
                    </div>

                    <div className="flex justify-end">
                        <Button
                            onClick={saveStripe}
                            disabled={saving === 'stripe' || !stripeDirty}
                        >
                            {saving === 'stripe' ? 'Saving\u2026' : 'Save stripe'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Greeting */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <MessageSquareText className="h-4 w-4 text-slate-500" />
                        <CardTitle className="text-sm">Opening greeting</CardTitle>
                    </div>
                    <CardDescription>{HINTS.widget_greeting}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea
                        value={drafts.widget_greeting}
                        onChange={(e) => setDrafts((d) => ({ ...d, widget_greeting: e.target.value }))}
                        rows={3}
                    />
                    <div className="mt-3 flex justify-end">
                        <Button
                            onClick={() => saveScalar('widget_greeting')}
                            disabled={
                                saving === 'widget_greeting' ||
                                drafts.widget_greeting === settings.widget_greeting?.value
                            }
                        >
                            {saving === 'widget_greeting' ? 'Saving\u2026' : 'Save greeting'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

/** Tiny color swatch used in the "Currently in use" summary card. */
function Swatch({ label, color }: { label: string; color: string }) {
    return (
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2">
            <div
                className="h-6 w-6 rounded shrink-0 border border-slate-200"
                style={{ background: color }}
            />
            <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {label}
                </div>
                <div className="font-mono text-[10px] text-slate-700 truncate">{color}</div>
            </div>
        </div>
    );
}
