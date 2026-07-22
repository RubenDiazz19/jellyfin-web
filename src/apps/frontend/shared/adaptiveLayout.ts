// Distinción móvil/tablet del frontend. layoutManager solo materializa
// layout-mobile / layout-desktop / layout-tv; aquí añadimos layout-tablet
// ENCIMA de layout-mobile cuando el viewport es ancho (≥600px), sin quitar
// nunca layout-mobile para no alterar los estilos legacy que dependen de
// ella. En desktop/tv este módulo no toca nada.

export const BREAKPOINTS = {
    /** mobile-sm: 0–399px */
    sm: 400,
    /** mobile-lg: 400–599px */
    md: 600,
    /** tablet: 600–1023px */
    lg: 840,
    /** desktop: ≥1024px (fuera del alcance del frontend móvil) */
    xl: 1024
} as const;

export const TABLET_MIN_WIDTH = BREAKPOINTS.md;

/**
 * Mantiene la clase layout-tablet sincronizada con el viewport mientras el
 * modo base sea layout-mobile. Devuelve el cleanup.
 */
export function initAdaptiveLayout(): () => void {
    const mq = window.matchMedia(`(min-width: ${TABLET_MIN_WIDTH}px)`);

    const apply = () => {
        const mobileBase = document.documentElement.classList.contains('layout-mobile');
        // toggle con el mismo valor no muta el atributo class, así que el
        // MutationObserver de abajo no entra en bucle.
        document.documentElement.classList.toggle('layout-tablet', mobileBase && mq.matches);
    };
    apply();

    mq.addEventListener('change', apply);

    // Si layoutManager cambia el modo (ajustes de pantalla), re-evaluamos.
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
    });

    return () => {
        mq.removeEventListener('change', apply);
        observer.disconnect();
        document.documentElement.classList.remove('layout-tablet');
    };
}
