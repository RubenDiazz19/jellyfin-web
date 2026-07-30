// `<meta name="theme-color">` tiñe la barra de estado del sistema en Android y
// en la PWA instalada, y la barra de pestañas en Safari. index.html lo trae con
// un valor fijo porque hace falta ANTES de que corra una sola línea de JS: ese
// es el color del primer pintado. A partir de ahí lo gobierna el tema activo.
//
// El color se lee de la DEFINICIÓN del tema y no del CSS ya aplicado
// (getComputedStyle sobre `--jf-palette-*`) por dos razones: el `<link>` del
// tema puede llegar después del render, y un objeto plano se puede probar.

import appTheme from '.';

/** Fallback: el mismo suelo que declara el tema base. */
const FALLBACK_BACKGROUND = '#101010';

type SchemeWithBackground = { palette?: { background?: { default?: string } } };

/**
 * Color de fondo del tema, o undefined si ese id no existe. Los ids salen de
 * `colorSchemes` en ./index, que es la lista de temas que la app puede aplicar.
 */
export function themeBackgroundColor(themeId: string): string | undefined {
    const schemes = appTheme.colorSchemes as Record<string, SchemeWithBackground | undefined>;
    return schemes[themeId]?.palette?.background?.default;
}

/**
 * Pone el theme-color en el color de fondo del tema. Devuelve el color aplicado
 * (útil para los tests) o null si la página no tiene la etiqueta —el caso de
 * quien arranca la app en un HTML propio, así que no es un error.
 */
export function applyThemeColor(themeId: string): string | null {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!(meta instanceof HTMLMetaElement)) return null;
    const color = themeBackgroundColor(themeId) ?? FALLBACK_BACKGROUND;
    meta.content = color;
    return color;
}
