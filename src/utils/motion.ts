/**
 * Preferencia de movimiento reducido (A11y, WCAG 2.3.3).
 * @module utils/motion
 *
 * El grueso del trabajo lo hace CSS (`@media (prefers-reduced-motion: reduce)`
 * en `styles/site.scss` y en el `global.css` del frontend), pero hay
 * movimiento que el CSS no alcanza:
 *  - el scroll suave pedido desde JS (`behavior: 'smooth'` gana siempre a la
 *    propiedad `scroll-behavior`),
 *  - las animaciones que montamos a mano en el DOM, como el ink del ripple.
 *
 * Se consulta en vivo (no se cachea): el usuario puede cambiar la preferencia
 * del sistema con la app abierta.
 */

/** true si el sistema pide menos animación. false si no se puede saber. */
export function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** `behavior` para scrollTo/scrollIntoView según la preferencia. */
export function scrollBehavior(): ScrollBehavior {
    return prefersReducedMotion() ? 'auto' : 'smooth';
}
