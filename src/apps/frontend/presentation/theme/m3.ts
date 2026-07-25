// Tokens de Material 3 Expressive para el frontend móvil/tablet.
//
// TODO EL CSS que sale de aquí vive bajo `html.layout-mobile` /
// `html.layout-tablet` (M3_SCOPE) — nunca en `:root` — para que desktop
// (`layout-desktop`) no vea ni una sola custom property nueva y conserve
// su tema actual byte a byte.
//
// Las paletas light/dark se derivan de un color semilla con
// @material/material-color-utilities (SchemeTonalSpot, el esquema de
// Material You que mantiene reconocible el color fuente — importante
// porque el seed puede venir extraído del backdrop del hero).

import {
    argbFromHex,
    Hct,
    hexFromArgb,
    SchemeTonalSpot,
    type DynamicScheme
} from '@material/material-color-utilities';

import { T } from './tokens';

export type M3SchemeName = 'light' | 'dark';

/** Seed por defecto: azul Jellyfin. */
export const M3_DEFAULT_SEED = '#00a4dc';

/** Selector bajo el que viven TODOS los tokens M3. Nunca `:root`. */
export const M3_SCOPE = 'html.layout-mobile, html.layout-tablet';

/** Clase transitoria que suaviza el cambio de tema (la pone el provider). */
export const M3_ANIM_CLASS = 'jfp-theme-anim';

/**
 * Niveles de contraste de M3 (el tercer argumento de los Scheme*). El rango
 * útil es −1 … 1: 0 es el estándar del spec y 1 el "high contrast" (sube el
 * ratio de on-* contra sus superficies y oscurece/aclara los outlines).
 * Los mapea MobileThemeProvider desde `prefers-contrast`.
 */
export const M3_CONTRAST = {
    /** `no-preference` — el spec tal cual. */
    standard: 0,
    /** `prefers-contrast: more` — máximo del spec. */
    more: 1,
    /** `prefers-contrast: less` — el spec admite negativo; no bajamos de −0.5
     *  para no perder legibilidad en superficies grandes. */
    less: -0.5
} as const;

// ── md-sys-color ────────────────────────────────────────────────────────

type ColorGetter = (s: DynamicScheme) => number;

/** Fuera de −1…1 material-color-utilities produce colores degenerados. */
function clampContrast(level: number): number {
    if (!Number.isFinite(level)) return M3_CONTRAST.standard;
    return Math.min(1, Math.max(-1, level));
}

const COLOR_TOKENS: ReadonlyArray<readonly [string, ColorGetter]> = [
    ['primary', (s) => s.primary],
    ['on-primary', (s) => s.onPrimary],
    ['primary-container', (s) => s.primaryContainer],
    ['on-primary-container', (s) => s.onPrimaryContainer],
    ['inverse-primary', (s) => s.inversePrimary],
    ['secondary', (s) => s.secondary],
    ['on-secondary', (s) => s.onSecondary],
    ['secondary-container', (s) => s.secondaryContainer],
    ['on-secondary-container', (s) => s.onSecondaryContainer],
    ['tertiary', (s) => s.tertiary],
    ['on-tertiary', (s) => s.onTertiary],
    ['tertiary-container', (s) => s.tertiaryContainer],
    ['on-tertiary-container', (s) => s.onTertiaryContainer],
    ['error', (s) => s.error],
    ['on-error', (s) => s.onError],
    ['error-container', (s) => s.errorContainer],
    ['on-error-container', (s) => s.onErrorContainer],
    ['background', (s) => s.background],
    ['on-background', (s) => s.onBackground],
    ['surface', (s) => s.surface],
    ['on-surface', (s) => s.onSurface],
    ['surface-variant', (s) => s.surfaceVariant],
    ['on-surface-variant', (s) => s.onSurfaceVariant],
    ['surface-dim', (s) => s.surfaceDim],
    ['surface-bright', (s) => s.surfaceBright],
    ['surface-container-lowest', (s) => s.surfaceContainerLowest],
    ['surface-container-low', (s) => s.surfaceContainerLow],
    ['surface-container', (s) => s.surfaceContainer],
    ['surface-container-high', (s) => s.surfaceContainerHigh],
    ['surface-container-highest', (s) => s.surfaceContainerHighest],
    ['surface-tint', (s) => s.surfaceTint],
    ['inverse-surface', (s) => s.inverseSurface],
    ['inverse-on-surface', (s) => s.inverseOnSurface],
    ['outline', (s) => s.outline],
    ['outline-variant', (s) => s.outlineVariant],
    ['shadow', (s) => s.shadow],
    ['scrim', (s) => s.scrim]
];

/**
 * Deriva la paleta md-sys-color completa (37 tokens) desde un seed #rrggbb.
 * `contrast` es el nivel M3 (ver M3_CONTRAST); por defecto, el estándar.
 * Devuelve `{ '--md-sys-color-primary': '#rrggbb', … }`.
 */
export function makeColorTokens(
    seedHex: string,
    scheme: M3SchemeName,
    contrast: number = M3_CONTRAST.standard
): Record<string, string> {
    const dyn = new SchemeTonalSpot(
        Hct.fromInt(argbFromHex(seedHex)),
        scheme === 'dark',
        clampContrast(contrast)
    );
    const out: Record<string, string> = {};
    for (const [token, get] of COLOR_TOKENS) {
        out[`--md-sys-color-${token}`] = hexFromArgb(get(dyn));
    }
    return out;
}

// ── md-sys-elevation (niveles 0–5, sombras del spec M3) ────────────────

export const M3_ELEVATION: readonly string[] = [
    'none',
    '0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15)',
    '0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15)',
    '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 4px 8px 3px rgba(0, 0, 0, 0.15)',
    '0 2px 3px 0 rgba(0, 0, 0, 0.3), 0 6px 10px 4px rgba(0, 0, 0, 0.15)',
    '0 4px 4px 0 rgba(0, 0, 0, 0.3), 0 8px 12px 6px rgba(0, 0, 0, 0.15)'
];

// ── md-sys-motion (easing + duración del spec M3) ──────────────────────

export const M3_EASING: Readonly<Record<string, string>> = {
    'standard': 'cubic-bezier(0.2, 0, 0, 1)',
    'standard-accelerate': 'cubic-bezier(0.3, 0, 1, 1)',
    'standard-decelerate': 'cubic-bezier(0, 0, 0, 1)',
    'emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
    'emphasized-accelerate': 'cubic-bezier(0.3, 0, 0.8, 0.15)',
    'emphasized-decelerate': 'cubic-bezier(0.05, 0.7, 0.1, 1)'
};

export const M3_DURATION: Readonly<Record<string, string>> = {
    'short2': '100ms',
    'short4': '200ms',
    'medium1': '250ms',
    'medium2': '300ms',
    'medium4': '400ms',
    'long2': '500ms'
};

// ── md-sys-shape (corner tokens) ────────────────────────────────────────

export const M3_SHAPE: Readonly<Record<string, string>> = {
    'none': '0',
    'extra-small': '4px',
    'small': '8px',
    'medium': '12px',
    'large': '16px',
    'extra-large': '28px',
    'full': '9999px'
};

// ── md-sys-typescale (15 roles del spec) ────────────────────────────────

type TypeRole = {
    size: string;
    lineHeight: string;
    weight: string;
    tracking: string;
};

export const M3_TYPESCALE: Readonly<Record<string, TypeRole>> = {
    'display-large': { size: '57px', lineHeight: '64px', weight: '400', tracking: '-0.25px' },
    'display-medium': { size: '45px', lineHeight: '52px', weight: '400', tracking: '0' },
    'display-small': { size: '36px', lineHeight: '44px', weight: '400', tracking: '0' },
    'headline-large': { size: '32px', lineHeight: '40px', weight: '400', tracking: '0' },
    'headline-medium': { size: '28px', lineHeight: '36px', weight: '400', tracking: '0' },
    'headline-small': { size: '24px', lineHeight: '32px', weight: '400', tracking: '0' },
    'title-large': { size: '22px', lineHeight: '28px', weight: '400', tracking: '0' },
    'title-medium': { size: '16px', lineHeight: '24px', weight: '500', tracking: '0.15px' },
    'title-small': { size: '14px', lineHeight: '20px', weight: '500', tracking: '0.1px' },
    'body-large': { size: '16px', lineHeight: '24px', weight: '400', tracking: '0.5px' },
    'body-medium': { size: '14px', lineHeight: '20px', weight: '400', tracking: '0.25px' },
    'body-small': { size: '12px', lineHeight: '16px', weight: '400', tracking: '0.4px' },
    'label-large': { size: '14px', lineHeight: '20px', weight: '500', tracking: '0.1px' },
    'label-medium': { size: '12px', lineHeight: '16px', weight: '500', tracking: '0.5px' },
    'label-small': { size: '11px', lineHeight: '16px', weight: '500', tracking: '0.5px' }
};

const M3_TYPE_FONT = T.ui;

// ── Builder del stylesheet ──────────────────────────────────────────────

/**
 * CSS completo de tokens para inyectar en un `<style>`: paleta del scheme
 * activo + elevation + shape + typescale, todo scopeado a M3_SCOPE, más la
 * regla de transición suave activada por M3_ANIM_CLASS.
 */
export function buildM3Css(
    seedHex: string,
    scheme: M3SchemeName,
    contrast: number = M3_CONTRAST.standard
): string {
    const lines: string[] = [
        `--md-sys-color-scheme: ${scheme};`,
        `--md-sys-contrast: ${clampContrast(contrast)};`
    ];

    const colors = makeColorTokens(seedHex, scheme, contrast);
    for (const [k, v] of Object.entries(colors)) lines.push(`${k}: ${v};`);

    M3_ELEVATION.forEach((shadow, level) => {
        lines.push(`--md-sys-elevation-level${level}: ${shadow};`);
    });

    for (const [k, v] of Object.entries(M3_SHAPE)) {
        lines.push(`--md-sys-shape-corner-${k}: ${v};`);
    }

    for (const [k, v] of Object.entries(M3_EASING)) {
        lines.push(`--md-sys-motion-easing-${k}: ${v};`);
    }
    for (const [k, v] of Object.entries(M3_DURATION)) {
        lines.push(`--md-sys-motion-duration-${k}: ${v};`);
    }

    for (const [role, t] of Object.entries(M3_TYPESCALE)) {
        lines.push(`--md-sys-typescale-${role}-font: ${M3_TYPE_FONT};`);
        lines.push(`--md-sys-typescale-${role}-size: ${t.size};`);
        lines.push(`--md-sys-typescale-${role}-line-height: ${t.lineHeight};`);
        lines.push(`--md-sys-typescale-${role}-weight: ${t.weight};`);
        lines.push(`--md-sys-typescale-${role}-tracking: ${t.tracking};`);
    }

    // Transición de tema: la clase la añade el provider durante ~400 ms al
    // cambiar de scheme. Scopeada igualmente a mobile/tablet.
    const animSelector = M3_SCOPE.split(', ')
        .map((s) => `${s}.${M3_ANIM_CLASS} body.jf-frontend-active, ${s}.${M3_ANIM_CLASS} body.jf-frontend-active *`)
        .join(',\n');

    return [
        `${M3_SCOPE} {`,
        `    ${lines.join('\n    ')}`,
        '}',
        '',
        `${animSelector} {`,
        '    transition: background-color 300ms ease, color 300ms ease, border-color 300ms ease;',
        '}',
        ''
    ].join('\n');
}
