/**
 * Escala de breakpoints del proyecto — fuente única (F1).
 * @module utils/breakpoints
 *
 * Antes convivían tres escalas: el frontend propio (600/1024), MUI con sus
 * valores por defecto (600/900/1200/1536) y el SCSS legacy con sus propios
 * cortes en `em` (50em, 48.125em, 43.75em…). La decisión es **alinearse con
 * la escala de MUI**: es la que ya usan el dashboard y todo el React nuevo,
 * y así el mismo nombre significa lo mismo en TS, en MUI y en SCSS.
 *
 * El espejo para SCSS está en `src/styles/_breakpoints.scss`; un test
 * (`utils/breakpoints.test.ts`) comprueba que los dos ficheros no se separen.
 *
 * Nota sobre unidades: en SCSS los cortes se expresan en `em` porque una
 * media query en `em` escala con el tamaño de fuente del navegador — quien
 * agranda la letra del sistema entra antes en el layout compacto, que es lo
 * que queremos. 1em = 16px a tamaño por defecto, así que los valores son los
 * mismos números.
 */

/** Escala canónica, en píxeles CSS. Coincide con la de MUI. */
export const BREAKPOINTS = {
    /** Móvil grande en vertical. */
    sm: 600,
    /** Tablet en vertical. */
    md: 900,
    /** Escritorio. */
    lg: 1200,
    /** Escritorio ancho. */
    xl: 1536
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

/**
 * Ancho a partir del cual el frontend propio deja de aplicar layout táctil.
 *
 * **Excepción deliberada a la escala**: no es `lg` (1200) sino 1024. Subirlo a
 * 1200 metería a los portátiles de 1024–1199 px en el layout táctil, y la
 * regla cardinal del proyecto es que el escritorio se quede exactamente como
 * está. 1024 es además el ancho del iPad en horizontal, que sí debe salir del
 * modo táctil. Bajarlo a `md` (900) dejaría fuera al iPad en horizontal.
 */
export const FRONTEND_DESKTOP_MIN_WIDTH = 1024;

/** Ancho a partir del cual el frontend propio usa el layout de tablet. */
export const FRONTEND_TABLET_MIN_WIDTH = BREAKPOINTS.sm;

/** `(min-width: …)` para usar con matchMedia. */
export function mediaUp(key: BreakpointKey): string {
    return `(min-width: ${BREAKPOINTS[key]}px)`;
}

/** `(max-width: …)` sin solaparse con `mediaUp` del mismo corte. */
export function mediaDown(key: BreakpointKey): string {
    return `(max-width: ${BREAKPOINTS[key] - 0.05}px)`;
}
