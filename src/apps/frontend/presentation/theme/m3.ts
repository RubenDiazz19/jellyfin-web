// Tokens de Material 3 Expressive para el frontend móvil/tablet.
//
// TODO EL CSS que sale de aquí vive bajo `html.layout-mobile` /
// `html.layout-tablet` (M3_SCOPE) — nunca en `:root` — para que desktop
// (`layout-desktop`) no vea ni una sola custom property nueva y conserve
// su tema actual byte a byte.
//
// Las paletas light/dark se derivan de un color semilla con
// @material/material-color-utilities. El esquema es SchemeContent: el de
// Material You pensado justo para cuando el seed sale de una imagen, porque
// respeta el color fuente tal cual (primary-container ES el color extraído) y
// tiñe las superficies con su croma. Con SchemeTonalSpot —el anterior— un
// póster rojo daba un gris casi neutro: se perdía la idea de que el color de
// la interfaz es el del contenido que se está viendo.
//
// OJO — este módulo NO puede importar @material/material-color-utilities en
// tiempo de ejecución: son ~100 KB que solo hacen falta en mobile/tablet y lo
// importa el shell entero. La derivación vive en `colorScheme.ts`, que se
// carga con `import()` desde el provider (ver MobileThemeProvider). Aquí solo
// entra el TIPO `DynamicScheme`, que TypeScript borra al compilar.

import type { DynamicScheme } from '@material/material-color-utilities';

import { T } from './tokens';

export type M3SchemeName = 'light' | 'dark';

/** Seed por defecto: azul Jellyfin. */
export const M3_DEFAULT_SEED = '#00a4dc';

/** El `SpecVersion` de la librería no se reexporta desde la raíz del paquete. */
export type M3SpecVersion = '2021' | '2025';

/**
 * Versión del spec de color que se le pide a material-color-utilities.
 *
 * OJO — hoy este valor no llega a aplicarse: `DynamicScheme` filtra el spec
 * por variante (`maybeFallbackSpecVersion`) y solo lo respeta en
 * EXPRESSIVE / VIBRANT / TONAL_SPOT / NEUTRAL; CONTENT —la nuestra, la que
 * hace que el color salga del póster— cae en el `default` y vuelve a '2021'.
 * Se pide igualmente porque es la intención real y se activará solo cuando la
 * librería valide CONTENT para 2025; `m3.test.ts` fija ese comportamiento para
 * que el día que cambie salte un test en vez de cambiar la paleta en silencio.
 */
export const M3_SPEC: M3SpecVersion = '2025';

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
export function clampContrast(level: number): number {
    if (!Number.isFinite(level)) return M3_CONTRAST.standard;
    return Math.min(1, Math.max(-1, level));
}

/**
 * Rol md-sys-color → de dónde se saca en el esquema derivado. La lista vive
 * aquí (y no junto a la derivación) porque `M3_COLOR_ROLE_COUNT` es lo que
 * cuenta los roles y no debe arrastrar la librería.
 */
export const COLOR_TOKENS: ReadonlyArray<readonly [string, ColorGetter]> = [
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

    // Roles del update de 2025. `*-dim` es la versión apagada del acento (para
    // superficies grandes de color sin gritar); la familia `*-fixed` mantiene
    // el mismo color en claro y en oscuro, que es lo que pide el spec para
    // piezas que no deben cambiar al alternar el tema.
    ['primary-dim', (s) => s.primaryDim],
    ['primary-fixed', (s) => s.primaryFixed],
    ['primary-fixed-dim', (s) => s.primaryFixedDim],
    ['on-primary-fixed', (s) => s.onPrimaryFixed],
    ['on-primary-fixed-variant', (s) => s.onPrimaryFixedVariant],
    ['secondary-dim', (s) => s.secondaryDim],
    ['secondary-fixed', (s) => s.secondaryFixed],
    ['secondary-fixed-dim', (s) => s.secondaryFixedDim],
    ['on-secondary-fixed', (s) => s.onSecondaryFixed],
    ['on-secondary-fixed-variant', (s) => s.onSecondaryFixedVariant],
    ['tertiary-dim', (s) => s.tertiaryDim],
    ['tertiary-fixed', (s) => s.tertiaryFixed],
    ['tertiary-fixed-dim', (s) => s.tertiaryFixedDim],
    ['on-tertiary-fixed', (s) => s.onTertiaryFixed],
    ['on-tertiary-fixed-variant', (s) => s.onTertiaryFixedVariant],
    ['error-dim', (s) => s.errorDim],

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

/** Número de roles md-sys-color que emite `makeColorTokens`. */
export const M3_COLOR_ROLE_COUNT = COLOR_TOKENS.length;

// La derivación de la paleta (`makeColorTokens`, `buildM3Css`) está en
// `colorScheme.ts`: es lo único que necesita la librería de color.

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
    // Atajo del spec para la parte de arriba de los bottom sheets: redondeadas
    // solo las esquinas superiores, porque las de abajo se salen de pantalla.
    // Es un shorthand de cuatro valores, así que se usa tal cual en
    // `border-radius` (BottomSheet.tsx).
    'extra-large-top': '28px 28px 0 0',
    'full': '9999px'
};

// ── md-sys-typescale (15 roles baseline + sus 15 emphasized) ────────────

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

/**
 * Estilos *emphasized* del update de mayo de 2025: mismo tamaño y mismo
 * interlineado que su baseline —para que sustituir uno por otro no mueva el
 * layout— y un escalón más de peso. Se emiten como
 * `--md-sys-typescale-<rol>-emphasized-*`, en paralelo a los baseline, que se
 * quedan exactamente como estaban.
 */
const EMPHASIZED_WEIGHT: Readonly<Record<string, string>> = {
    'display-large': '500',
    'display-medium': '500',
    'display-small': '500',
    'headline-large': '500',
    'headline-medium': '500',
    'headline-small': '500',
    'title-large': '500',
    'title-medium': '600',
    'title-small': '600',
    'body-large': '500',
    'body-medium': '500',
    'body-small': '500',
    'label-large': '700',
    'label-medium': '700',
    'label-small': '700'
};

export const M3_TYPESCALE_EMPHASIZED: Readonly<Record<string, TypeRole>> =
    Object.fromEntries(
        Object.entries(M3_TYPESCALE).map(([role, t]) => [
            `${role}-emphasized`,
            { ...t, weight: EMPHASIZED_WEIGHT[role] ?? t.weight }
        ])
    );

const M3_TYPE_FONT = T.ui;

// ── Builder del stylesheet ──────────────────────────────────────────────

/**
 * CSS completo de tokens para inyectar en un `<style>`: paleta del scheme
 * activo + elevation + shape + typescale, todo scopeado a M3_SCOPE, más la
 * regla de transición suave activada por M3_ANIM_CLASS.
 *
 * Toma la paleta ya calculada (`colorScheme.makeColorTokens`) porque el
 * provider necesita además un token suelto —el `surface`, para el
 * `theme-color` de la barra de estado— y así los 53 roles se derivan una sola
 * vez por cambio de seed/scheme/contraste en vez de dos.
 */
export function buildM3CssFromTokens(
    colors: Record<string, string>,
    scheme: M3SchemeName,
    contrast: number = M3_CONTRAST.standard
): string {
    const lines: string[] = [
        `--md-sys-color-scheme: ${scheme};`,
        `--md-sys-contrast: ${clampContrast(contrast)};`
    ];

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

    for (const [role, t] of Object.entries({ ...M3_TYPESCALE, ...M3_TYPESCALE_EMPHASIZED })) {
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
