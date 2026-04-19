# Theming a client workspace

Every client org carries a `theme` JSON that sets CSS variables scoped to
that client's pages. No code change is needed to rebrand a new client —
just update the row in Supabase.

## Theme shape

```ts
interface OrganizationTheme {
    primary_color?: string;            // main brand color, used on buttons, active nav, focus rings
    accent_colors?: string[];          // optional array, exposed as --color-accent-1, -2, ...
    logo_url?: string | null;          // rendered in the client's sidebar / picker
    font?: string;                     // Google Fonts name — "Inter", "Poppins", "Roboto"…
}
```

## Example — updating Just Print's theme

```sql
update public.organizations
set theme = jsonb_build_object(
    'primary_color', '#040f2a',
    'accent_colors', jsonb_build_array('#e30686', '#feea03', '#3e8fcd', '#c4cf00'),
    'logo_url', 'https://just-print.ie/wp-content/themes/just-print/assets/img/tiger_760.png',
    'font', 'Poppins'
)
where slug = 'just-print';
```

The next time a user navigates to `/c/just-print/*`, the theme applies.

## How it works under the hood

`src/components/blocks/ClientThemeProvider.tsx` wraps the client route tree
and renders an inline `<style>` block with:

```css
:root {
    --color-primary: #040f2a;
    --color-accent-1: #e30686;
    --color-accent-2: #feea03;
    --font-display: 'Poppins', sans-serif;
}
```

UI primitives like `Button`, `Input`, and `StatCard` read `var(--color-primary)`
via Tailwind arbitrary values, so they pick up the client brand automatically.

## Available CSS variables

| Variable | Notes |
|----------|-------|
| `--color-primary` | Main brand color (button background, focus ring, active nav border) |
| `--color-accent-1` through `-N` | Optional accents — for future stat card sparklines, badges, etc. |
| `--font-display` | Optional display font. Loaded via Next.js `<link>` if needed. |

## Adding a new font

If you pick a font that Next.js hasn't loaded yet, wire it in `src/app/layout.tsx`:

```tsx
import { Poppins } from 'next/font/google';

const poppins = Poppins({
    weight: ['400', '500', '600', '700'],
    variable: '--font-poppins',
    subsets: ['latin'],
});
```

Then reference `--font-poppins` in the client's theme JSON (or just use the
font-family name directly — Tailwind's arbitrary value syntax handles it).

## Gotchas

- The theme JSON is **per-client**, not per-agent. All agents in a client
  workspace share the same brand.
- `primary_color` must be a valid CSS color (`#hex`, `rgb(...)`, named).
  Invalid values cause the CSS variable to fall back to the default
  (`#0d0d2b`).
- Images on `logo_url` should be served over HTTPS and allow cross-origin
  embedding (most public marketing assets do).
- RLS on `organizations` prevents clients from seeing each other's themes,
  but `strategos_admin` members can read/edit all themes via the
  `/strategos/clients` route.

## v2: white-label domains

Future enhancement: let each client bring their own domain
(e.g. `dashboard.just-print.ie`) with their theme pre-applied. Requires
Vercel custom domains + a mapping table (`custom_domains` → `organization_id`).
