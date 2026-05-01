/**
 * Craig API types — mirror the JSON shapes returned by Craig's /admin/api/*.
 * Single source of truth shared by all modules.
 */

export type QuoteStatus =
    | 'pending_approval'
    | 'approved'
    | 'sent'
    | 'accepted'
    | 'rejected';

export interface CraigQuote {
    id: number;
    conversation_id: number | null;
    product_key: string;
    specs: Record<string, unknown>;
    base_price: number;
    surcharges: string[];
    final_price_ex_vat: number;
    vat_amount: number;
    final_price_inc_vat: number;
    artwork_cost: number;
    total: number;
    status: QuoteStatus;
    approved_by: string | null;
    notes: string | null;
    created_at: string | null;
    /** Populated on conversation detail responses — relative path under the agent API base. */
    pdf_url?: string;
    // PrintLogic integration state
    /** Real PrintLogic id, OR a synthetic 'DRY-XXXX' when the tenant is in dry-run. Null = never pushed. */
    printlogic_order_id?: string | null;
    printlogic_customer_id?: string | null;
    printlogic_pushed_at?: string | null;
    printlogic_last_error?: string | null;
    printlogic_push_attempts?: number;
    // Stripe payment link state (Phase B). Null when no link has been created
    // OR when stripe_enabled=false for this tenant.
    stripe_payment_link_id?: string | null;
    stripe_payment_link_url?: string | null;
    /** 'unpaid' | 'paid' | 'refunded' | 'failed' | null */
    stripe_payment_status?: string | null;
    stripe_paid_at?: string | null;
    stripe_last_error?: string | null;
    // Missive outbound draft state (Phase C/D). Populated when "Approve"
    // fires on the dashboard — server creates a Missive draft to the
    // customer with the PDF attached + the Stripe payment link inline.
    missive_draft_id?: string | null;
    missive_drafted_at?: string | null;
    missive_last_error?: string | null;
    /** When the customer said "yes" in the chat (LLM confirm_order). Null = never. */
    client_confirmed_at?: string | null;
    // Phase F — shipping line item + customer-uploaded artwork (singular, deprecated)
    shipping_cost_ex_vat?: number;
    shipping_cost_inc_vat?: number;
    artwork_file_url?: string | null;
    artwork_file_name?: string | null;
    artwork_file_size?: number | null;
    // Phase G — multi-file artwork. URLs point to the authenticated
    // proxy endpoint, NOT direct GCS, so the dashboard can fetch +
    // render previews without 403s.
    artwork_files?: Array<CraigArtworkFile>;
}

export interface CraigArtworkFile {
    /** Proxy URL: /admin/api/orgs/{slug}/quotes/{id}/artwork/{idx}/file */
    url: string;
    filename: string;
    size: number;
    content_type?: string;
    uploaded_at?: string | null;
}

/** Server response shape from POST /quotes/:id/create-payment-link */
export interface CreatePaymentLinkResult {
    quote: CraigQuote;
    result: {
        ok: boolean;
        url: string | null;
        link_id: string | null;
        already_exists: boolean;
        disabled: boolean;
        error: string | null;
    };
}

/** Server response shape from POST /quotes/:id/push-to-printlogic */
export interface PushToPrintLogicResult {
    quote: CraigQuote;
    result: {
        ok: boolean;
        dry_run: boolean;
        order_id: string | null;
        customer_id: string | null;
        ambiguous: boolean;
        error: string | null;
        already_pushed: boolean;
    };
}

export interface CraigDeliveryAddress {
    address1?: string;
    address2?: string;
    address3?: string;
    address4?: string;
    postcode?: string;
}

export interface CraigConversation {
    id: number;
    external_id: string | null;
    channel: string;
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    status: string;
    message_count: number;
    last_message_preview: string | null;
    last_message_at: string | null;
    created_at: string | null;
    // Phase E — extended customer-funnel fields. All nullable; populated
    // by save_customer_info as Craig walks the customer through the
    // 5-step funnel (or by Justin via the dashboard PATCH endpoint).
    is_company?: boolean | null;
    is_returning_customer?: boolean | null;
    past_customer_email?: string | null;
    /** 'delivery' | 'collect' | null */
    delivery_method?: string | null;
    delivery_address?: CraigDeliveryAddress | null;
}

export interface CraigConversationDetail extends CraigConversation {
    messages: Array<{ role: string; content: string }>;
    quotes: CraigQuote[];
}

export interface CraigPriceTier {
    id: number;
    spec_key: string;
    quantity: number;
    price: number;
}

export type PricingStrategy =
    | 'tiered'
    | 'per_unit'
    | 'per_unit_metric'
    | 'bulk_break'
    | 'per_job';

export interface CraigProduct {
    id: number;
    key: string;
    name: string;
    category: string;
    description: string | null;
    notes: string | null;
    pricing_unit: string | null;
    price_per: string | null;
    pricing_strategy: PricingStrategy;
    metric_unit: string | null;
    image_url: string | null;
    double_sided_surcharge: boolean;
    unit_price: number | null;
    bulk_price: number | null;
    bulk_threshold: number | null;
    min_qty: number | null;
    tiers: CraigPriceTier[];
}

export interface CraigCategory {
    slug: string;
    name: string;
    description: string | null;
    icon: string | null;
    sort_order: number;
    product_count: number;
    tax_rate_name: string | null;
}

export interface CraigSetting {
    key: string;
    value: string;
    value_type: 'string' | 'float' | 'int' | 'json';
    description: string | null;
}

export interface CraigTaxRate {
    id: number;
    name: string;
    rate: number;
    description: string | null;
    is_default: boolean;
}

export interface CraigCategoryTaxMap {
    category: string;
    tax_rate_id: number;
}

export interface CraigSurcharge {
    id: number;
    name: string;
    multiplier: number;
    kind: 'multiplier' | 'additive';
    applies_to_category: string | null;
    description: string | null;
}

export type WidgetStripeMode = 'sections' | 'gradient' | 'solid';

export interface CraigWidgetConfig {
    organization_slug: string;
    primary_color: string;
    logo_url: string | null;
    font: string;
    greeting: string;
    /** Ordered list of hex colors used by the stripe. Any length. */
    accents: string[];
    stripe_mode: WidgetStripeMode;
    // Legacy — retained for backwards compat with older backends / widget builds.
    accent_pink: string;
    accent_yellow: string;
    accent_blue: string;
}

/** Stripe Connect linkage state per tenant. Returned by
 * GET /admin/api/orgs/:slug/integrations/stripe/connect-status. */
export interface StripeConnectStatus {
    connected: boolean;
    account_id: string | null;
    user_email: string | null;
    connected_at: string | null;
    publishable_key: string | null;
    enabled: boolean;
}

/** Per-integration health summary returned by GET /integrations/status */
export interface IntegrationHealth {
    configured: boolean;
    enabled: boolean;
    health: 'green' | 'yellow' | 'red' | 'unknown';
    last_success_at: string | null;
    last_error: string | null;
    last_error_at: string | null;
    stats_30d: Record<string, number>;
    notes: string | null;
    /** PrintLogic-only — true if dry_run mode is on */
    dry_run?: boolean;
    /** Missive-only — currently configured from_address */
    from_address?: string;
}

export interface IntegrationsHealth {
    missive: IntegrationHealth;
    printlogic: IntegrationHealth;
    stripe: IntegrationHealth;
    computed_at: string;
}

export interface CraigMetrics {
    from: string;
    to: string;
    totals: {
        quotes_count: number;
        quotes_value: number;
        conversations_count: number;
        approval_rate: number;
    };
    by_channel: Array<{ channel: string; count: number; value: number }>;
    by_status: Array<{ status: string; count: number; value: number }>;
    top_products: Array<{ product_key: string; count: number; value: number }>;
    by_day: Array<{ date: string; count: number; value: number }>;
}
