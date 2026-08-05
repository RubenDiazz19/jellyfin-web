// Métricas responsive del frontend (solo mobile/tablet). Los componentes
// las consultan con useResponsive() y conservan sus literales actuales en
// desktop (`touch === false`), así el layout de escritorio queda idéntico.
//
// Breakpoints (shared/adaptiveLayout.ts): mobile-sm 0–399, mobile-lg
// 400–599, tablet 600–1023; desktop ≥1024 no entra aquí.

import { useEffect, useState } from 'react';

import { useMobileTheme } from './MobileThemeProvider';
import type { MobileLayout } from '../../shared/layoutMode';

export type Responsive = {
    layout: MobileLayout | null;
    /** true en mobile/tablet — la única señal para desviarse del desktop. */
    touch: boolean;
    mobile: boolean;
    tablet: boolean;
    /** Margen horizontal de página: 12 mobile / 16 tablet. */
    pagePad: number;
    /** Ancho de tarjeta de póster: 130 mobile / 160 tablet. */
    cardW: number;
    /** Hueco entre tarjetas: 12 mobile / 16 tablet. */
    gap: number;
};

// cardW subió de 130/160 a 156/200: con la carátula pequeña no se leía ni el
// título incrustado ni el pie, y en un móvil siguen entrando dos por pantalla
// (las filas se arrastran, no reparten).
const MOBILE: Responsive = {
    layout: 'mobile', touch: true, mobile: true, tablet: false,
    pagePad: 12, cardW: 156, gap: 12
};

const TABLET: Responsive = {
    layout: 'tablet', touch: true, mobile: false, tablet: true,
    pagePad: 16, cardW: 200, gap: 16
};

// Los valores "desktop" no se usan para pintar (los componentes conservan
// sus literales), pero dan un fallback coherente si alguien los lee.
const DESKTOP: Responsive = {
    layout: null, touch: false, mobile: false, tablet: false,
    pagePad: 56, cardW: 230, gap: 24
};

export function useResponsive(): Responsive {
    const { layout } = useMobileTheme();
    if (layout === 'mobile') return MOBILE;
    if (layout === 'tablet') return TABLET;
    return DESKTOP;
}

/**
 * Suscripción a una media query. Vive aquí porque las dos de abajo miden lo
 * mismo —la forma del viewport— y solo las consultan los heroes y la
 * navegación, así que no vale la pena meterlas en `useResponsive()` y pagar un
 * listener en cada uno de sus (muchos) puntos de uso.
 */
function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(
        () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches
    );
    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia(query);
        const apply = () => setMatches(mq.matches);
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, [query]);
    return matches;
}

/**
 * Viewport bajo (~un móvil tumbado): el bloque de un hero a tamaño normal no
 * cabe y, al ir pegado abajo, lo que sobra se pierde por arriba.
 */
export function useShortViewport(): boolean {
    return useMediaQuery('(max-height: 520px)');
}

/** Pantalla apaisada, sea móvil o tablet. */
export function useLandscape(): boolean {
    return useMediaQuery('(orientation: landscape)');
}

// Atajos de color M3 con fallback al look dark actual: en desktop las vars
// no existen y el fallback reproduce el valor de siempre.
export const MC = {
    bg: 'var(--md-sys-color-background, #000)',
    fg: 'var(--md-sys-color-on-background, #fff)',
    surface: 'var(--md-sys-color-surface, #000)',
    onSurface: 'var(--md-sys-color-on-surface, #fff)',
    onSurfaceVariant: 'var(--md-sys-color-on-surface-variant, rgba(255,255,255,0.55))',
    surfaceContainer: 'var(--md-sys-color-surface-container, #161a1e)',
    surfaceContainerHigh: 'var(--md-sys-color-surface-container-high, #202020)',
    primary: 'var(--md-sys-color-primary, #fff)',
    onPrimary: 'var(--md-sys-color-on-primary, #000)',
    outlineVariant: 'var(--md-sys-color-outline-variant, rgba(255,255,255,0.12))'
} as const;
