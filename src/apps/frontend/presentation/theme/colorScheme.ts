// Derivación de la paleta M3 desde un color semilla.
//
// Este módulo es EL PUNTO DE CORTE de @material/material-color-utilities: es
// el único del frontend que la importa de verdad (dynamicColor la carga a su
// vez con `import()`), y por eso vive separado de `m3.ts`. Son ~100 KB que
// solo usan mobile y tablet para el dynamic color; con la librería colgando
// del shell, desktop —que ni siquiera activa el tema M3— los descargaba en el
// arranque. El provider lo trae con `import()` y en el bundle queda en su
// propio chunk (`vendor-color`, ver vite.config).
//
// Consecuencia práctica: nada que se pinte en el primer frame puede importar
// esto de forma estática, o el corte deja de existir.

import {
    argbFromHex,
    Hct,
    hexFromArgb,
    SchemeContent
} from '@material/material-color-utilities';

import {
    buildM3CssFromTokens,
    clampContrast,
    COLOR_TOKENS,
    M3_CONTRAST,
    M3_SPEC,
    type M3SchemeName
} from './m3';

/**
 * Deriva la paleta md-sys-color completa desde un seed #rrggbb.
 * `contrast` es el nivel M3 (ver M3_CONTRAST); por defecto, el estándar.
 * Devuelve `{ '--md-sys-color-primary': '#rrggbb', … }`.
 */
export function makeColorTokens(
    seedHex: string,
    scheme: M3SchemeName,
    contrast: number = M3_CONTRAST.standard
): Record<string, string> {
    const dyn = new SchemeContent(
        Hct.fromInt(argbFromHex(seedHex)),
        scheme === 'dark',
        clampContrast(contrast),
        M3_SPEC
    );
    const out: Record<string, string> = {};
    for (const [token, get] of COLOR_TOKENS) {
        out[`--md-sys-color-${token}`] = hexFromArgb(get(dyn));
    }
    return out;
}

/**
 * CSS completo de tokens desde el seed: paleta + elevation + shape +
 * typescale, todo scopeado a M3_SCOPE. Fachada de `buildM3CssFromTokens`.
 */
export function buildM3Css(
    seedHex: string,
    scheme: M3SchemeName,
    contrast: number = M3_CONTRAST.standard
): string {
    return buildM3CssFromTokens(makeColorTokens(seedHex, scheme, contrast), scheme, contrast);
}
