// Activación del layout adaptativo del frontend por ANCHO DE VIEWPORT.
//
// Por qué existe: layoutManager decide mobile/desktop por user-agent
// (browser.mobile). Un iPad Air (iPadOS 13+) reporta un UA de Safari de
// escritorio, así que layoutManager le pone `layout-desktop` y toda la
// experiencia táctil (Fases 1–7, condicionada a layout-mobile/tablet) nunca
// se activa. Lo mismo pasa al probar redimensionando el navegador.
//
// Este módulo hace que, MIENTRAS el frontend propio está activo
// (body.jf-frontend-active o jf-video-active), las clases de layout se
// deriven del ancho, siguiendo la tabla de breakpoints del proyecto:
//   · < 600px ......... layout-mobile
//   · 600–1023px ...... layout-mobile + layout-tablet
//   · ≥ 1024px ........ escritorio: se respeta la decisión de layoutManager
//                       (regla cardinal: desktop real queda EXACTAMENTE igual)
//
// Fuera del frontend (dashboard/wizard legacy) se restaura la decisión UA de
// layoutManager para no alterar esas áreas. En dispositivos TV no se toca
// nada.

// Los cortes salen de la escala única del proyecto (utils/breakpoints).
// Este módulo ya no define la suya: antes tenía una tabla propia con un `lg`
// de 840px que no usaba nadie y unos nombres que no coincidían con los de
// MUI, así que "md" significaba cosas distintas según el fichero.
import {
    FRONTEND_DESKTOP_MIN_WIDTH,
    FRONTEND_TABLET_MIN_WIDTH
} from 'utils/breakpoints';

/** Tablet desde 600px (`sm` de la escala). */
export const TABLET_MIN_WIDTH = FRONTEND_TABLET_MIN_WIDTH;
/** Escritorio desde 1024px — excepción documentada en utils/breakpoints. */
export const DESKTOP_MIN_WIDTH = FRONTEND_DESKTOP_MIN_WIDTH;

type BaseLayout = 'mobile' | 'desktop' | 'tv';

// Singleton: vive lo que la página, igual que layoutManager. Un único juego
// de listeners atiende todas las rutas del frontend (incluida /video, que se
// monta sin AppLayout).
let started = false;
let base: BaseLayout = 'desktop';
let onResize: (() => void) | null = null;
let bodyObserver: MutationObserver | null = null;

function frontendActive(): boolean {
    return document.body.classList.contains('jf-frontend-active')
        || document.body.classList.contains('jf-video-active');
}

/** Restaura la decisión original de layoutManager (UA) para áreas legacy. */
function restoreBase(): void {
    const cl = document.documentElement.classList;
    cl.remove('layout-tablet');
    if (base === 'mobile') {
        cl.add('layout-mobile');
        cl.remove('layout-desktop');
    } else {
        // base 'desktop' (a 'tv' no se llega: apply() sale antes).
        cl.add('layout-desktop');
        cl.remove('layout-mobile');
    }
}

function apply(): void {
    if (base === 'tv') return; // TV intacto

    // Fuera del frontend: que mande layoutManager.
    if (!frontendActive()) {
        restoreBase();
        return;
    }

    const w = window.innerWidth || DESKTOP_MIN_WIDTH;

    // Escritorio real: experiencia desktop sin tocar (regla cardinal).
    if (w >= DESKTOP_MIN_WIDTH) {
        restoreBase();
        return;
    }

    // Viewport táctil: móvil, y tablet a partir de 600px. `layout-tablet` se
    // añade SOBRE `layout-mobile` (así lo espera el CSS de la Fase 3+).
    const cl = document.documentElement.classList;
    cl.remove('layout-desktop');
    cl.add('layout-mobile');
    cl.toggle('layout-tablet', w >= TABLET_MIN_WIDTH);
}

/**
 * Arranca (idempotente) el control de layout por viewport. Devuelve un
 * cleanup no-op: el singleton persiste a propósito toda la vida de la página.
 * Lo llaman AppLayout y VideoRoute; la primera llamada instala los listeners,
 * las siguientes solo reevalúan.
 */
export function initAdaptiveLayout(): () => void {
    if (started) {
        apply();
        return () => { /* singleton: no se desmonta */ };
    }
    started = true;
    base = document.documentElement.classList.contains('layout-tv') ? 'tv' :
        document.documentElement.classList.contains('layout-mobile') ? 'mobile' :
            'desktop';

    onResize = () => apply();
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });

    // El frontend se activa/desactiva vía clases en <body>; al entrar o salir
    // (p. ej. navegar al dashboard, o a /video) reevaluamos.
    bodyObserver = new MutationObserver(() => apply());
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    apply();
    return () => { /* singleton: no se desmonta */ };
}

/** Solo para tests: desmonta el singleton y resetea su estado. */
export function resetAdaptiveLayout(): void {
    if (onResize) {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
    }
    bodyObserver?.disconnect();
    started = false;
    base = 'desktop';
    onResize = null;
    bodyObserver = null;
}
