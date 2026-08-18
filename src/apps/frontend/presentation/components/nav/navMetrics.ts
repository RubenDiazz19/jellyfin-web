// Geometría de la navegación M3 flotante (Fase 8).
//
// La barra ya no está pegada al borde ni es una cápsula continua: son tres
// segmentos sueltos que flotan sobre el contenido (abajo y centrados; en una
// tablet claramente vertical, apilados a la izquierda). Eso rompe la cuenta que antes
// hacía cada componente por su lado ("la nav mide 80, me separo 92"), así que
// las medidas viven aquí y MobileNav las publica como custom properties en
// <html>:
//
//   --jfp-nav-bottom  franja inferior ocupada (barra centrada) — en tablet con
//                     rail, solo el safe-area, porque el rail no toca abajo
//   --jfp-nav-left    franja izquierda ocupada (rail) — en barra inferior,
//                     solo el safe-area
//
// Las dos vars llevan SIEMPRE el safe-area dentro, así quien las consume no
// tiene que volver a sumarlo (y no se cuenta dos veces). Sin navegación
// montada (desktop, login) no existen y los fallbacks dejan el layout como
// estaba.

/** Alto (y ancho mínimo) de cada segmento de la navegación. */
export const NAV_HEIGHT = 48;
/** Separación de la navegación con los bordes de la pantalla. */
export const NAV_MARGIN = 12;
/** Hueco entre segmentos: van sueltos, no dentro de una misma cápsula. */
export const NAV_GAP = 6;
/** Ancho del rail vertical (tablet alta): sus segmentos son cuadrados. */
export const RAIL_WIDTH = NAV_HEIGHT;
/** Separación del rail con el borde izquierdo. */
export const RAIL_MARGIN = 12;

export const NAV_BOTTOM_VAR = '--jfp-nav-bottom';
export const NAV_LEFT_VAR = '--jfp-nav-left';

const SAFE_BOTTOM = 'env(safe-area-inset-bottom, 0px)';
const SAFE_LEFT = 'env(safe-area-inset-left, 0px)';

/** Valor de --jfp-nav-bottom / --jfp-nav-left según el layout activo. */
export function navSpace(isRail: boolean): { bottom: string; left: string } {
    return isRail ?
        {
            bottom: SAFE_BOTTOM,
            left: `calc(${RAIL_WIDTH + RAIL_MARGIN * 2}px + ${SAFE_LEFT})`
        } :
        {
            bottom: `calc(${NAV_HEIGHT + NAV_MARGIN * 2}px + ${SAFE_BOTTOM})`,
            left: SAFE_LEFT
        };
}

/** `bottom` de un elemento fijo que debe quedar por encima de la navegación. */
export function aboveNav(gap = NAV_MARGIN): string {
    return `calc(var(${NAV_BOTTOM_VAR}, ${SAFE_BOTTOM}) + ${gap}px)`;
}

/** `left` de un elemento fijo que no debe quedar debajo del rail. */
export function besideNav(gap = 0): string {
    return `calc(var(${NAV_LEFT_VAR}, ${SAFE_LEFT}) + ${gap}px)`;
}
