/**
 * In-memory CRUD store for demo mode.
 *
 * Mutations persist for the lifetime of the Node process — server restarts
 * reset to seed data. The dashboard uses this via the agent-proxy when
 * Supabase credentials are placeholders.
 *
 * Routes a {path, method, body} triple to the right handler, mirroring the
 * shape of Craig's real /admin/api/* endpoints.
 */

import type {
    CraigCategory,
    CraigConversation,
    CraigConversationDetail,
    CraigMetrics,
    CraigPriceTier,
    CraigProduct,
    CraigQuote,
    CraigSetting,
    CraigSurcharge,
    CraigTaxRate,
    QuoteStatus,
} from './agents/craig/api';
import type { Organization, OrganizationTheme } from '@/types/organization';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

// ---------------------------------------------------------------------------
// Demo clients (extendable by the Strategos admin CRUD)
// ---------------------------------------------------------------------------

export interface DemoClientRecord {
    slug: string;
    name: string;
    theme: OrganizationTheme;
    enable_craig: boolean;
}

const JUST_PRINT_CLIENT: DemoClientRecord = {
    slug: 'just-print',
    name: 'Just Print',
    theme: {
        primary_color: '#040f2a',
        accent_colors: ['#e30686', '#feea03', '#3e8fcd', '#c4cf00'],
        logo_url:
            'https://just-print.ie/wp-content/themes/just-print/assets/img/tiger_760.png',
        font: 'Poppins',
    },
    enable_craig: true,
};

const ACME_CLIENT: DemoClientRecord = {
    slug: 'acme-inbox',
    name: 'ACME Retail (demo)',
    theme: { primary_color: '#14b8a6', font: 'Inter' },
    enable_craig: false,
};

const demoClients: DemoClientRecord[] = [JUST_PRINT_CLIENT, ACME_CLIENT];

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

let nextProductId = 100;
let nextTierId = 1000;
let nextTaxId = 100;
let nextSurchargeId = 100;

// Category rows — first-class entities. Seeded from the initial product list.
interface DemoCategory {
    slug: string;
    name: string;
    description: string | null;
    icon: string | null;
    sort_order: number;
}

const categoryRows: DemoCategory[] = [
    { slug: 'small_format', name: 'Small Format', description: 'Business cards, flyers, compliment slips', icon: null, sort_order: 10 },
    { slug: 'large_format', name: 'Large Format', description: 'Banners, boards, signage', icon: null, sort_order: 20 },
    { slug: 'booklet', name: 'Booklet', description: 'Saddle-stitch and perfect-bound booklets', icon: null, sort_order: 30 },
];

const products: CraigProduct[] = [
    {
        id: 1,
        key: 'business_cards',
        name: 'Business Cards',
        category: 'small_format',
        description: 'Standard 85x55mm business cards',
        notes: 'Double-sided no extra charge. Soft-touch +25%.',
        pricing_unit: '100 cards',
        price_per: '100 cards',
        pricing_strategy: 'tiered',
        metric_unit: null,
        image_url: null,
        double_sided_surcharge: false,
        unit_price: null,
        bulk_price: null,
        bulk_threshold: null,
        min_qty: 100,
        tiers: [
            { id: 11, spec_key: '', quantity: 100, price: 30.0 },
            { id: 12, spec_key: '', quantity: 250, price: 60.0 },
            { id: 13, spec_key: '', quantity: 500, price: 38.0 },
            { id: 14, spec_key: '', quantity: 1000, price: 30.0 },
            { id: 15, spec_key: '', quantity: 2500, price: 24.0 },
        ],
    },
    {
        id: 2,
        key: 'flyers_a5',
        name: 'Flyers — A5',
        category: 'small_format',
        description: 'A5 flyers, 150gsm gloss',
        notes: 'Double-sided +20%.',
        pricing_unit: '100 flyers',
        price_per: '100 flyers',
        pricing_strategy: 'tiered',
        metric_unit: null,
        image_url: null,
        double_sided_surcharge: true,
        unit_price: null,
        bulk_price: null,
        bulk_threshold: null,
        min_qty: 100,
        tiers: [
            { id: 21, spec_key: '', quantity: 100, price: 45.0 },
            { id: 22, spec_key: '', quantity: 250, price: 30.0 },
            { id: 23, spec_key: '', quantity: 500, price: 22.0 },
            { id: 24, spec_key: '', quantity: 1000, price: 14.5 },
            { id: 25, spec_key: '', quantity: 2500, price: 10.0 },
        ],
    },
    {
        id: 3,
        key: 'roller_banners',
        name: 'Roller Banners',
        category: 'large_format',
        description: '850x2000mm roller / pull-up banner',
        notes: null,
        pricing_unit: 'per banner',
        price_per: 'per banner',
        pricing_strategy: 'bulk_break',
        metric_unit: null,
        image_url: null,
        double_sided_surcharge: false,
        unit_price: 120,
        bulk_price: 110,
        bulk_threshold: 5,
        min_qty: 1,
        tiers: [],
    },
    {
        id: 4,
        key: 'pvc_banners',
        name: 'PVC Banners',
        category: 'large_format',
        description: 'Custom PVC banners — priced per square metre.',
        notes: null,
        pricing_unit: 'per sq/m',
        price_per: 'per sq/m',
        pricing_strategy: 'per_unit_metric',
        metric_unit: 'sq m',
        image_url: null,
        double_sided_surcharge: false,
        unit_price: 28,
        bulk_price: 23,
        bulk_threshold: 10,
        min_qty: 1,
        tiers: [],
    },
];

const settings: CraigSetting[] = [
    {
        key: 'artwork_rate_eur',
        value: '65.0',
        value_type: 'float',
        description: 'Hourly rate for artwork / design (ex VAT, service rate)',
    },
    {
        key: 'standard_turnaround',
        value: '3-5 working days',
        value_type: 'string',
        description: 'Default turnaround mentioned in quotes',
    },
    {
        key: 'widget_primary_color',
        value: '#040f2a',
        value_type: 'string',
        description: 'Main brand color used by the widget (header, buttons, focus ring).',
    },
    {
        key: 'widget_logo_url',
        value: 'https://just-print.ie/wp-content/themes/just-print/assets/img/tiger_760.png',
        value_type: 'string',
        description: 'Public URL to the widget avatar / header logo.',
    },
    {
        key: 'widget_font',
        value: 'Poppins',
        value_type: 'string',
        description: 'Google Fonts family the widget loads.',
    },
    {
        key: 'widget_greeting',
        value: 'Hey — Craig here. What are you looking to print?',
        value_type: 'string',
        description: 'Opening line the widget shows when a customer opens the chat.',
    },
    {
        key: 'widget_accents',
        value: '["#e30686", "#feea03", "#3e8fcd", "#040f2a"]',
        value_type: 'json',
        description: 'Ordered list of hex colors used by the widget rainbow stripe. Any length.',
    },
    {
        key: 'widget_stripe_mode',
        value: 'sections',
        value_type: 'string',
        description: "How the stripe is rendered: 'sections', 'gradient', or 'solid'.",
    },
    // Missive connection — demo values so MissiveTab renders without 404s.
    {
        key: 'missive_enabled',
        value: 'false',
        value_type: 'string',
        description: 'Kill switch for the Missive channel.',
    },
    {
        key: 'missive_api_token',
        value: '',
        value_type: 'string',
        description: 'Bearer token for POST /v1/drafts. Set via the MissiveTab.',
    },
    {
        key: 'missive_webhook_secret',
        value: 'demo-secret-replace-in-prod',
        value_type: 'string',
        description: 'Shared HMAC secret. Auto-generated per tenant in real deploys.',
    },
    {
        key: 'missive_from_address',
        value: 'sebastian@strategos-ai.com',
        value_type: 'string',
        description: 'Address the draft reply is attributed to.',
    },
    {
        key: 'missive_from_name',
        value: 'Craig @ Just Print',
        value_type: 'string',
        description: 'Display name on the draft reply.',
    },
];

const taxRates: CraigTaxRate[] = [
    { id: 1, name: 'standard', rate: 0.23, description: 'Standard Irish VAT', is_default: true },
    { id: 2, name: 'reduced', rate: 0.135, description: 'Reduced VAT for printed matter', is_default: false },
    { id: 3, name: 'zero', rate: 0.0, description: 'Zero-rated', is_default: false },
];

const categoryTaxMap: Array<{ category: string; tax_rate_id: number }> = [
    { category: 'small_format', tax_rate_id: 2 },
    { category: 'booklet', tax_rate_id: 2 },
    { category: 'large_format', tax_rate_id: 1 },
];

const surcharges: CraigSurcharge[] = [
    {
        id: 1,
        name: 'double_sided',
        multiplier: 0.2,
        kind: 'multiplier',
        applies_to_category: 'small_format',
        description: 'Double-sided printing surcharge (+20%)',
    },
    {
        id: 2,
        name: 'soft_touch',
        multiplier: 0.25,
        kind: 'multiplier',
        applies_to_category: null,
        description: 'Soft-touch finish surcharge (+25%)',
    },
    {
        id: 3,
        name: 'triplicate',
        multiplier: 0.1,
        kind: 'multiplier',
        applies_to_category: null,
        description: 'Triplicate (NCR pads) surcharge (+10%)',
    },
];

const quotes: CraigQuote[] = [
    {
        id: 1,
        conversation_id: 101,
        product_key: 'business_cards',
        specs: { product_key: 'business_cards', quantity: 500, double_sided: true, finish: 'soft-touch' },
        base_price: 190.0,
        surcharges: ['Soft-touch finish: +25%'],
        final_price_ex_vat: 237.5,
        vat_amount: 32.06,
        final_price_inc_vat: 269.56,
        artwork_cost: 0,
        total: 269.56,
        status: 'pending_approval',
        approved_by: null,
        notes: null,
        created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
    {
        id: 2,
        conversation_id: 102,
        product_key: 'flyers_a5',
        specs: { product_key: 'flyers_a5', quantity: 1000, double_sided: true, finish: 'gloss' },
        base_price: 145.0,
        surcharges: ['Double-sided: +20%'],
        final_price_ex_vat: 174.0,
        vat_amount: 23.49,
        final_price_inc_vat: 197.49,
        artwork_cost: 0,
        total: 197.49,
        status: 'pending_approval',
        approved_by: null,
        notes: null,
        created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    },
    {
        id: 3,
        conversation_id: 103,
        product_key: 'roller_banners',
        specs: { product_key: 'roller_banners', quantity: 1 },
        base_price: 120.0,
        surcharges: [],
        final_price_ex_vat: 120.0,
        vat_amount: 27.6,
        final_price_inc_vat: 147.6,
        artwork_cost: 0,
        total: 147.6,
        status: 'approved',
        approved_by: 'demo@strategosai.example',
        notes: null,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
        id: 4,
        conversation_id: 104,
        product_key: 'flyers_a5',
        specs: { product_key: 'flyers_a5', quantity: 500, double_sided: false, finish: 'gloss' },
        base_price: 110.0,
        surcharges: [],
        final_price_ex_vat: 110.0,
        vat_amount: 14.85,
        final_price_inc_vat: 124.85,
        artwork_cost: 0,
        total: 124.85,
        status: 'sent',
        approved_by: 'demo@strategosai.example',
        notes: null,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    },
    {
        id: 5,
        conversation_id: 105,
        product_key: 'business_cards',
        specs: { product_key: 'business_cards', quantity: 250, double_sided: false, finish: 'gloss' },
        base_price: 150.0,
        surcharges: [],
        final_price_ex_vat: 150.0,
        vat_amount: 20.25,
        final_price_inc_vat: 170.25,
        artwork_cost: 0,
        total: 170.25,
        status: 'rejected',
        approved_by: 'demo@strategosai.example',
        notes: 'Customer wanted soft-touch but cancelled.',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    },
];

const conversations: CraigConversation[] = [
    {
        id: 101,
        external_id: null,
        channel: 'web',
        customer_name: "Sarah O'Connor",
        customer_email: 'sarah@acme.ie',
        customer_phone: null,
        status: 'quoted',
        message_count: 6,
        last_message_preview: "Here's your quote!",
        last_message_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
        id: 102,
        external_id: '+353871234567',
        channel: 'whatsapp',
        customer_name: 'Marco D.',
        customer_email: null,
        customer_phone: '+353871234567',
        status: 'quoted',
        message_count: 4,
        last_message_preview: 'Sounds good — send the PDF.',
        last_message_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
    {
        id: 103,
        external_id: 'sarah@kingscourt.ie',
        channel: 'email',
        customer_name: 'Sarah Walsh',
        customer_email: 'sarah@kingscourt.ie',
        customer_phone: null,
        status: 'quoted',
        message_count: 3,
        last_message_preview: 'Banner quote attached.',
        last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(),
    },
    {
        id: 104,
        external_id: null,
        channel: 'web',
        customer_name: null,
        customer_email: null,
        customer_phone: null,
        status: 'quoted',
        message_count: 4,
        last_message_preview: 'Thanks!',
        last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 49).toISOString(),
    },
    {
        id: 105,
        external_id: null,
        channel: 'web',
        customer_name: 'John Murphy',
        customer_email: 'john@example.com',
        customer_phone: null,
        status: 'closed',
        message_count: 8,
        last_message_preview: 'Maybe next time, thanks.',
        last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 73).toISOString(),
    },
];

const conversationMessages: Record<number, Array<{ role: string; content: string }>> = {
    101: [
        { role: 'user', content: 'Hi, how much for 500 business cards?' },
        { role: 'assistant', content: "Hey! Craig here, I handle pricing at Just Print 🖨️\n\nJust to confirm — 500 business cards, single-sided or double-sided? And what finish — gloss, matte, or soft-touch?" },
        { role: 'user', content: 'double sided soft touch please' },
        { role: 'assistant', content: 'Nice one! That comes to €269.56 for 500 double-sided business cards with soft-touch finish 👍\n\nWant me to put together the full quote for you? 📋' },
        { role: 'user', content: 'yes please' },
        { role: 'assistant', content: "Here's your quote! 📋" },
    ],
    102: [
        { role: 'user', content: '1000 a5 flyers double sided' },
        { role: 'assistant', content: "Just to confirm — 1000 A5 flyers, double-sided, gloss finish? 👍" },
        { role: 'user', content: 'yes' },
        { role: 'assistant', content: '€197.49. Sounds good — send the PDF.' },
    ],
    103: [
        { role: 'user', content: 'Hi, can I get a quote for 1 roller banner?' },
        { role: 'assistant', content: "Sure — that's €147.60 for one roller banner. Want the PDF?" },
        { role: 'user', content: 'yes please' },
    ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function humanize(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildCategories(): CraigCategory[] {
    const counts = new Map<string, number>();
    for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    const taxMap = new Map(categoryTaxMap.map((m) => [m.category, m.tax_rate_id]));

    return categoryRows
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .map((c) => {
            const taxRateId = taxMap.get(c.slug);
            const taxRate = taxRates.find((t) => t.id === taxRateId);
            return {
                slug: c.slug,
                name: c.name,
                description: c.description,
                icon: c.icon,
                sort_order: c.sort_order,
                product_count: counts.get(c.slug) ?? 0,
                tax_rate_name: taxRate?.name ?? null,
            };
        });
}

function computeMetrics(from: string, to: string): CraigMetrics {
    const start = new Date(from).getTime();
    const end = new Date(to).getTime();
    const inRange = quotes.filter((q) => {
        if (!q.created_at) return false;
        const t = new Date(q.created_at).getTime();
        return t >= start && t <= end;
    });

    const totalsValue = inRange.reduce((s, q) => s + q.total, 0);
    const approved = inRange.filter((q) => ['approved', 'sent', 'accepted'].includes(q.status)).length;
    const approvalRate = inRange.length ? approved / inRange.length : 0;

    const channelMap = new Map<string, { count: number; value: number }>();
    for (const q of inRange) {
        const conv = conversations.find((c) => c.id === q.conversation_id);
        const channel = conv?.channel ?? 'unknown';
        const cur = channelMap.get(channel) ?? { count: 0, value: 0 };
        cur.count += 1;
        cur.value += q.total;
        channelMap.set(channel, cur);
    }

    const statusMap = new Map<string, { count: number; value: number }>();
    for (const q of inRange) {
        const cur = statusMap.get(q.status) ?? { count: 0, value: 0 };
        cur.count += 1;
        cur.value += q.total;
        statusMap.set(q.status, cur);
    }

    const productMap = new Map<string, { count: number; value: number }>();
    for (const q of inRange) {
        const cur = productMap.get(q.product_key) ?? { count: 0, value: 0 };
        cur.count += 1;
        cur.value += q.total;
        productMap.set(q.product_key, cur);
    }

    // Synthetic by-day series — fill 14 days even if quotes don't span them
    const byDay: CraigMetrics['by_day'] = [];
    const oneDay = 1000 * 60 * 60 * 24;
    for (let i = 13; i >= 0; i--) {
        const day = new Date(Date.now() - oneDay * i);
        const dateStr = day.toISOString().slice(0, 10);
        const dayQuotes = inRange.filter(
            (q) => q.created_at && q.created_at.startsWith(dateStr),
        );
        // Synthetic spread to make the chart interesting in demo mode:
        const synthetic = Math.round(2 + Math.sin(i / 2) * 1.5 + (i % 3 === 0 ? 1 : 0));
        const count = dayQuotes.length || synthetic;
        const value =
            dayQuotes.reduce((s, q) => s + q.total, 0) || synthetic * 75 + (i % 4) * 30;
        byDay.push({ date: dateStr, count, value: Math.round(value * 100) / 100 });
    }

    return {
        from,
        to,
        totals: {
            quotes_count: inRange.length || 14,
            quotes_value: Math.round(totalsValue * 100) / 100 || 1820.45,
            conversations_count: conversations.filter((c) => {
                if (!c.created_at) return false;
                const t = new Date(c.created_at).getTime();
                return t >= start && t <= end;
            }).length || 9,
            approval_rate: approvalRate || 0.42,
        },
        by_channel:
            channelMap.size > 0
                ? Array.from(channelMap.entries()).map(([channel, v]) => ({
                      channel,
                      count: v.count,
                      value: Math.round(v.value * 100) / 100,
                  }))
                : [
                      { channel: 'web', count: 8, value: 985.4 },
                      { channel: 'whatsapp', count: 4, value: 540.0 },
                      { channel: 'email', count: 2, value: 295.05 },
                  ],
        by_status:
            statusMap.size > 0
                ? Array.from(statusMap.entries()).map(([status, v]) => ({
                      status,
                      count: v.count,
                      value: Math.round(v.value * 100) / 100,
                  }))
                : [
                      { status: 'pending_approval', count: 6, value: 760.2 },
                      { status: 'approved', count: 3, value: 442.5 },
                      { status: 'sent', count: 4, value: 530.0 },
                      { status: 'rejected', count: 1, value: 87.75 },
                  ],
        top_products:
            productMap.size > 0
                ? Array.from(productMap.entries())
                      .sort((a, b) => b[1].count - a[1].count)
                      .slice(0, 10)
                      .map(([product_key, v]) => ({
                          product_key,
                          count: v.count,
                          value: Math.round(v.value * 100) / 100,
                      }))
                : [
                      { product_key: 'business_cards', count: 5, value: 720.5 },
                      { product_key: 'flyers_a5', count: 4, value: 545.4 },
                      { product_key: 'roller_banners', count: 3, value: 442.8 },
                      { product_key: 'pvc_banners', count: 2, value: 388.0 },
                  ],
        by_day: byDay,
    };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

class DemoStore {
    handle(path: string, method: Method, body: unknown): unknown {
        // /admin/api/me
        if (path === '/admin/api/me') {
            return { email: 'demo@strategosai.example', org_slug: 'just-print', role: 'client_owner' };
        }

        // strip /admin/api/orgs/<slug>/
        const m = path.match(/^\/admin\/api\/orgs\/[^/]+\/(.+?)(\?.*)?$/);
        if (!m) return {};
        const sub = m[1];
        const query = new URLSearchParams(m[2]?.slice(1) ?? '');

        if (sub === 'categories' && method === 'GET') return { categories: buildCategories() };
        if (sub === 'categories' && method === 'POST') return this.createCategory(body as Record<string, unknown>);
        const categoryMatch = sub.match(/^categories\/([^/]+)$/);
        if (categoryMatch) {
            const slug = categoryMatch[1];
            if (method === 'PATCH') return this.patchCategory(slug, body as Record<string, unknown>);
            if (method === 'DELETE') return this.deleteCategory(slug);
        }

        if (sub === 'products' && method === 'GET') {
            const cat = query.get('category');
            return { products: cat ? products.filter((p) => p.category === cat) : products };
        }
        if (sub === 'products' && method === 'POST') {
            return this.createProduct(body as Record<string, unknown>);
        }

        const productMatch = sub.match(/^products\/(\d+)$/);
        if (productMatch) {
            const id = Number(productMatch[1]);
            if (method === 'PATCH') return this.patchProduct(id, body as Record<string, unknown>);
            if (method === 'DELETE') return this.deleteProduct(id);
        }

        const tierMatch = sub.match(/^products\/(\d+)\/tiers(\/(\d+))?$/);
        if (tierMatch) {
            const productId = Number(tierMatch[1]);
            const tierId = tierMatch[3] ? Number(tierMatch[3]) : null;
            if (tierId === null && method === 'POST') return this.createTier(productId, body as Record<string, unknown>);
            if (tierId !== null && method === 'PATCH') return this.patchTier(productId, tierId, body as Record<string, unknown>);
            if (tierId !== null && method === 'DELETE') return this.deleteTier(productId, tierId);
        }

        if (sub === 'tax-rates' && method === 'GET') return { tax_rates: taxRates, category_map: categoryTaxMap };
        if (sub === 'tax-rates' && method === 'POST') return this.createTaxRate(body as Record<string, unknown>);
        const taxMatch = sub.match(/^tax-rates\/(\d+)$/);
        if (taxMatch) {
            const id = Number(taxMatch[1]);
            if (method === 'PATCH') return this.patchTaxRate(id, body as Record<string, unknown>);
            if (method === 'DELETE') return this.deleteTaxRate(id);
        }
        if (sub === 'category-tax-map' && method === 'PUT') return this.bulkSetCategoryTaxMap(body as Record<string, unknown>);

        if (sub === 'surcharges' && method === 'GET') return { surcharges };
        if (sub === 'surcharges' && method === 'POST') return this.createSurcharge(body as Record<string, unknown>);
        const surMatch = sub.match(/^surcharges\/(\d+)$/);
        if (surMatch) {
            const id = Number(surMatch[1]);
            if (method === 'PATCH') return this.patchSurcharge(id, body as Record<string, unknown>);
            if (method === 'DELETE') return this.deleteSurcharge(id);
        }

        if (sub.startsWith('quotes')) {
            const quoteIdMatch = sub.match(/^quotes\/(\d+)$/);
            if (quoteIdMatch && method === 'PATCH') {
                return this.patchQuote(Number(quoteIdMatch[1]), body as Record<string, unknown>);
            }
            const status = query.get('status');
            const channel = query.get('channel');
            let filtered = [...quotes];
            if (status) filtered = filtered.filter((q) => q.status === status);
            if (channel) {
                filtered = filtered.filter((q) => {
                    const conv = conversations.find((c) => c.id === q.conversation_id);
                    return conv?.channel === channel;
                });
            }
            return { quotes: filtered };
        }

        if (sub.startsWith('conversations')) {
            const convMatch = sub.match(/^conversations\/(\d+)$/);
            if (convMatch) {
                const cid = Number(convMatch[1]);
                if (method === 'DELETE') {
                    const idx = conversations.findIndex((x) => x.id === cid);
                    if (idx === -1) return { deleted: false };
                    conversations.splice(idx, 1);
                    // Cascade: drop linked quotes + their message thread
                    for (let i = quotes.length - 1; i >= 0; i--) {
                        if (quotes[i].conversation_id === cid) quotes.splice(i, 1);
                    }
                    delete conversationMessages[cid];
                    return { deleted: true, id: cid };
                }
                const c = conversations.find((x) => x.id === cid);
                if (!c) return {};
                const detail: CraigConversationDetail = {
                    ...c,
                    messages: conversationMessages[cid] ?? [],
                    quotes: quotes
                        .filter((q) => q.conversation_id === cid)
                        .map((q) => ({ ...q, pdf_url: `/quotes/${q.id}/pdf` })),
                };
                return { conversation: detail };
            }
            const status = query.get('status');
            const channel = query.get('channel');
            const search = query.get('search')?.toLowerCase();
            let filtered = [...conversations];
            if (status) filtered = filtered.filter((c) => c.status === status);
            if (channel) filtered = filtered.filter((c) => c.channel === channel);
            if (search) {
                filtered = filtered.filter((c) =>
                    [c.customer_name, c.customer_email, c.customer_phone]
                        .filter(Boolean)
                        .some((v) => v!.toLowerCase().includes(search)),
                );
            }
            return { conversations: filtered };
        }

        if (sub === 'settings' && method === 'GET') return { settings };
        const settingMatch = sub.match(/^settings\/(.+)$/);
        if (settingMatch && method === 'PATCH') {
            const key = settingMatch[1];
            const b = body as { value: string; value_type?: string };
            let s = settings.find((x) => x.key === key);
            if (!s) {
                s = {
                    key,
                    value: b.value,
                    value_type: (b.value_type as 'string' | 'float' | 'int' | 'json') ?? 'string',
                    description: null,
                };
                settings.push(s);
            } else {
                s.value = b.value;
            }
            return { setting: s };
        }

        if (sub === 'metrics' && method === 'GET') {
            const from = query.get('from') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const to = query.get('to') ?? new Date().toISOString();
            return computeMetrics(from, to);
        }

        return {};
    }

    private createProduct(body: Record<string, unknown>) {
        const product: CraigProduct = {
            id: nextProductId++,
            key: ((body.key as string) ?? (body.name as string)).toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            name: body.name as string,
            category: body.category as string,
            description: (body.description as string) ?? null,
            notes: (body.notes as string) ?? null,
            pricing_unit: (body.pricing_unit as string) ?? null,
            price_per: (body.price_per as string) ?? null,
            pricing_strategy: (body.pricing_strategy as CraigProduct['pricing_strategy']) ?? 'tiered',
            metric_unit: (body.metric_unit as string) ?? null,
            image_url: (body.image_url as string) ?? null,
            double_sided_surcharge: (body.double_sided_surcharge as boolean) ?? true,
            unit_price: (body.unit_price as number) ?? null,
            bulk_price: (body.bulk_price as number) ?? null,
            bulk_threshold: (body.bulk_threshold as number) ?? null,
            min_qty: (body.min_qty as number) ?? 1,
            tiers: [],
        };
        products.push(product);
        return { product };
    }

    private patchProduct(id: number, body: Record<string, unknown>) {
        const p = products.find((x) => x.id === id);
        if (!p) return {};
        Object.assign(p, body);
        return { product: p };
    }

    private deleteProduct(id: number) {
        const idx = products.findIndex((x) => x.id === id);
        if (idx >= 0) products.splice(idx, 1);
        return {};
    }

    private createTier(productId: number, body: Record<string, unknown>) {
        const p = products.find((x) => x.id === productId);
        if (!p) return {};
        const tier: CraigPriceTier = {
            id: nextTierId++,
            spec_key: (body.spec_key as string) ?? '',
            quantity: body.quantity as number,
            price: body.price as number,
        };
        p.tiers.push(tier);
        p.tiers.sort((a, b) => a.quantity - b.quantity);
        return { product: p };
    }

    private patchTier(productId: number, tierId: number, body: Record<string, unknown>) {
        const p = products.find((x) => x.id === productId);
        if (!p) return {};
        const t = p.tiers.find((x) => x.id === tierId);
        if (!t) return {};
        Object.assign(t, body);
        return { product: p };
    }

    private deleteTier(productId: number, tierId: number) {
        const p = products.find((x) => x.id === productId);
        if (!p) return {};
        const idx = p.tiers.findIndex((x) => x.id === tierId);
        if (idx >= 0) p.tiers.splice(idx, 1);
        return {};
    }

    private createTaxRate(body: Record<string, unknown>) {
        const t: CraigTaxRate = {
            id: nextTaxId++,
            name: body.name as string,
            rate: body.rate as number,
            description: (body.description as string) ?? null,
            is_default: (body.is_default as boolean) ?? false,
        };
        if (t.is_default) for (const r of taxRates) r.is_default = false;
        taxRates.push(t);
        return { tax_rate: t };
    }

    private patchTaxRate(id: number, body: Record<string, unknown>) {
        const t = taxRates.find((x) => x.id === id);
        if (!t) return {};
        if ((body as { is_default?: boolean }).is_default) for (const r of taxRates) r.is_default = false;
        Object.assign(t, body);
        return { tax_rate: t };
    }

    private deleteTaxRate(id: number) {
        const idx = taxRates.findIndex((x) => x.id === id);
        if (idx >= 0 && !taxRates[idx].is_default) taxRates.splice(idx, 1);
        return {};
    }

    private bulkSetCategoryTaxMap(body: Record<string, unknown>) {
        const entries = (body as { entries: Array<{ category: string; tax_rate_id: number }> }).entries;
        for (const entry of entries) {
            const existing = categoryTaxMap.find((m) => m.category === entry.category);
            if (existing) existing.tax_rate_id = entry.tax_rate_id;
            else categoryTaxMap.push(entry);
        }
        return { ok: true };
    }

    private createSurcharge(body: Record<string, unknown>) {
        const s: CraigSurcharge = {
            id: nextSurchargeId++,
            name: body.name as string,
            multiplier: body.multiplier as number,
            kind: (body.kind as 'multiplier' | 'additive') ?? 'multiplier',
            applies_to_category: (body.applies_to_category as string) ?? null,
            description: (body.description as string) ?? null,
        };
        surcharges.push(s);
        return { surcharge: s };
    }

    private patchSurcharge(id: number, body: Record<string, unknown>) {
        const s = surcharges.find((x) => x.id === id);
        if (!s) return {};
        Object.assign(s, body);
        return { surcharge: s };
    }

    private deleteSurcharge(id: number) {
        const idx = surcharges.findIndex((x) => x.id === id);
        if (idx >= 0) surcharges.splice(idx, 1);
        return {};
    }

    private patchQuote(id: number, body: Record<string, unknown>) {
        const q = quotes.find((x) => x.id === id);
        if (!q) return {};
        const newStatus = body.status as QuoteStatus;
        if (newStatus) {
            q.status = newStatus;
            if (newStatus === 'approved' || newStatus === 'rejected') {
                q.approved_by = 'demo@strategosai.example';
            }
        }
        if ('notes' in body) q.notes = (body.notes as string) ?? null;
        return { quote: q };
    }

    // -------------------------------------------------------------------
    // Categories CRUD
    // -------------------------------------------------------------------

    private createCategory(body: Record<string, unknown>) {
        const name = String(body.name ?? '').trim();
        const slug =
            (body.slug as string | undefined)?.trim() ||
            name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        if (!slug || !name) return {};
        if (categoryRows.some((c) => c.slug === slug)) {
            throw new Error(`Category '${slug}' already exists`);
        }
        const c: DemoCategory = {
            slug,
            name,
            description: (body.description as string) || null,
            icon: (body.icon as string) || null,
            sort_order: (body.sort_order as number) ?? 0,
        };
        categoryRows.push(c);
        return { category: { ...c, product_count: 0, tax_rate_name: null } };
    }

    private patchCategory(slug: string, body: Record<string, unknown>) {
        const c = categoryRows.find((x) => x.slug === slug);
        if (!c) return {};
        if ('name' in body) c.name = body.name as string;
        if ('description' in body) c.description = (body.description as string) || null;
        if ('icon' in body) c.icon = (body.icon as string) || null;
        if ('sort_order' in body) c.sort_order = body.sort_order as number;
        return { category: { ...c, product_count: products.filter((p) => p.category === slug).length, tax_rate_name: null } };
    }

    private deleteCategory(slug: string) {
        const count = products.filter((p) => p.category === slug).length;
        if (count > 0) {
            throw new Error(`Category has ${count} products — move them first.`);
        }
        const idx = categoryRows.findIndex((c) => c.slug === slug);
        if (idx >= 0) categoryRows.splice(idx, 1);
        return {};
    }

    // -------------------------------------------------------------------
    // Client CRUD (exposed directly, not routed through the path matcher —
    // called by server actions in app/strategos/clients/actions.ts)
    // -------------------------------------------------------------------

    listDemoClients(): DemoClientRecord[] {
        return demoClients.slice();
    }

    getDemoClient(slug: string): DemoClientRecord | null {
        return demoClients.find((c) => c.slug === slug) ?? null;
    }

    addDemoClient(params: {
        slug: string;
        name: string;
        theme: OrganizationTheme;
        enableCraig: boolean;
    }) {
        if (demoClients.some((c) => c.slug === params.slug)) {
            throw new Error(`Client slug "${params.slug}" already exists`);
        }
        demoClients.push({
            slug: params.slug,
            name: params.name,
            theme: params.theme,
            enable_craig: params.enableCraig,
        });
    }

    updateDemoClient(slug: string, patch: { name?: string; theme?: OrganizationTheme }) {
        const c = demoClients.find((x) => x.slug === slug);
        if (!c) throw new Error(`Client "${slug}" not found`);
        if (patch.name !== undefined) c.name = patch.name;
        if (patch.theme !== undefined) c.theme = { ...c.theme, ...patch.theme };
    }

    toggleDemoClientAgent(slug: string, agentSlug: string, enable: boolean) {
        const c = demoClients.find((x) => x.slug === slug);
        if (!c) throw new Error(`Client "${slug}" not found`);
        if (agentSlug !== 'craig') return; // only Craig supported in demo
        c.enable_craig = enable;
    }
}

export const demoStore = new DemoStore();
