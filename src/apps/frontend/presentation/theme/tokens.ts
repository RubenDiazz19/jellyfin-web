// Fuente única de verdad para colores/tipografía y posiciones del hero.

import type { CSSProperties } from 'react';

export const T = {
    bg: '#000',
    fg: '#fff',
    dim: 'rgba(255,255,255,0.55)',
    hairline: 'rgba(255,255,255,0.12)',
    ui: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
} as const;

/**
 * Vocabulario de color adaptativo M3 / Desktop.
 * En desktop las variables CSS caen al fallback (idéntico al look original).
 * En mobile/tablet se resuelven contra los tokens del tema M3 activo.
 */
export const C = {
    bg: 'var(--md-sys-color-background, #000)',
    fg: 'var(--md-sys-color-on-background, #fff)',
    dim: 'var(--md-sys-color-on-surface-variant, rgba(255,255,255,0.55))',
    hairline: 'var(--md-sys-color-outline-variant, rgba(255,255,255,0.12))',
    surface: 'var(--md-sys-color-surface, #000)',
    onSurface: 'var(--md-sys-color-on-surface, #fff)',
    onSurfaceVariant: 'var(--md-sys-color-on-surface-variant, rgba(255,255,255,0.55))',
    surfaceContainer: 'var(--md-sys-color-surface-container, #161a1e)',
    surfaceContainerHigh: 'var(--md-sys-color-surface-container-high, #202020)',
    primary: 'var(--md-sys-color-primary, #fff)',
    onPrimary: 'var(--md-sys-color-on-primary, #000)',
    outlineVariant: 'var(--md-sys-color-outline-variant, rgba(255,255,255,0.12))'
} as const;

// Tipado con las propiedades CSS reales para que las páginas no necesiten
// `as any` al volcarlos en style={}.
type HeroPos = {
    justify: CSSProperties['justifyContent'];
    align: CSSProperties['alignItems'];
    text: CSSProperties['textAlign'];
    pad: string;
};

export const HERO_POS: Record<'Esquina' | 'Inferior' | 'Centro', HeroPos> = {
    Esquina:  { justify: 'flex-end', align: 'flex-start', text: 'left', pad: '0 72px 120px' },
    Inferior: { justify: 'flex-end', align: 'center', text: 'center', pad: '0 56px 120px' },
    Centro:   { justify: 'center', align: 'center', text: 'center', pad: '0 56px 128px' }
};

export const HERO_SCRIM = { Sutil: 0.4, Media: 0.66, Intensa: 0.85 } as const;

export type HeroPosKey = keyof typeof HERO_POS;
export type HeroScrimKey = keyof typeof HERO_SCRIM;
