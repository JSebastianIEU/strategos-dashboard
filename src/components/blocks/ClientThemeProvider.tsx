/**
 * Applies a client-specific theme to everything rendered inside it by
 * setting CSS custom properties. Components that read `var(--color-primary)` etc.
 * will pick up the client's brand without any JS changes.
 */
import type { ReactNode } from 'react';
import type { OrganizationTheme } from '@/types/organization';

interface ClientThemeProviderProps {
    theme: OrganizationTheme;
    children: ReactNode;
}

export function ClientThemeProvider({ theme, children }: ClientThemeProviderProps) {
    const style: Record<string, string> = {};
    if (theme.primary_color) style['--color-primary'] = theme.primary_color;
    if (theme.font) style['--font-display'] = `'${theme.font}', sans-serif`;
    theme.accent_colors?.forEach((color, i) => {
        style[`--color-accent-${i + 1}`] = color;
    });

    return <div style={style as React.CSSProperties}>{children}</div>;
}
