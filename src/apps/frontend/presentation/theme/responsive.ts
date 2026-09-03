// Métricas responsive del frontend (solo mobile/tablet). Los componentes
// las consultan con useResponsive() y conservan sus literales actuales en
// desktop (`touch === false`), así el layout de escritorio queda idéntico.
//
// Breakpoints (shared/adaptiveLayout.ts): mobile-sm 0–399, mobile-lg
// 400–599, tablet 600–1023; desktop ≥1024 no entra aquí.

import { useEffect, useState } from 'react';

import {
    currentMobileLayout,
    observeLayoutMode,
    type MobileLayout
} from '../../shared/layoutMode';

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
    const [layout, setLayout] = useState<MobileLayout | null>(() => (
        typeof document !== 'undefined' ? currentMobileLayout() : null
    ));

    useEffect(() => {
        if (typeof document === 'undefined') return;
        return observeLayoutMode(() => {
            setLayout(currentMobileLayout());
        });
    }, []);

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

/**
 * Tablet suficientemente alta para que el rail lateral tenga sentido. Una
 * pantalla casi cuadrada (por ejemplo 943×992) conserva el layout tablet,
 * pero usa la barra inferior centrada como un móvil para no dejar una franja
 * negra vertical a la izquierda.
 */
export function useTallTablet(): boolean {
    return useMediaQuery('(min-aspect-ratio: 6/5)');
}

/**
 * Pantalla panorámica (16:9, 16:10 o desktop apaisado de al menos 900px de ancho).
 */
export function useWidescreen(): boolean {
    return useMediaQuery('(min-aspect-ratio: 4/3) and (min-width: 900px)');
}
