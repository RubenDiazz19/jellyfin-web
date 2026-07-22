// Gesto swipe-back: deslizar desde el borde izquierdo navega atrás.
// Solo mobile/tablet (en desktop no hay touch que interceptar y no se
// altera nada). Umbrales conservadores para no confundirse con el scroll
// horizontal de las filas de tarjetas: el arranque debe ser pegado al
// borde y el trazo rápido y horizontal.

import { currentMobileLayout } from './layoutMode';

const EDGE_PX = 20;
const MIN_DX = 90;
const MAX_DY = 50;
const MAX_MS = 500;

export function initSwipeBack(): () => void {
    let tracking = false;
    let startX = 0;
    let startY = 0;
    let startT = 0;

    const onStart = (e: TouchEvent) => {
        tracking = false;
        if (!currentMobileLayout()) return;
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        if (t.clientX > EDGE_PX) return;
        // El reproductor tiene (fase 5) sus propios gestos: no interferimos.
        if (e.target instanceof Element && e.target.closest('.jfp-video')) return;
        tracking = true;
        startX = t.clientX;
        startY = t.clientY;
        startT = performance.now();
    };

    const onEnd = (e: TouchEvent) => {
        if (!tracking) return;
        tracking = false;
        const t = e.changedTouches[0];
        if (!t) return;
        const dx = t.clientX - startX;
        const dy = Math.abs(t.clientY - startY);
        if (dx >= MIN_DX && dy <= MAX_DY && performance.now() - startT <= MAX_MS) {
            window.history.back();
        }
    };

    const opts = { passive: true } as const;
    window.addEventListener('touchstart', onStart, opts);
    window.addEventListener('touchend', onEnd, opts);
    return () => {
        window.removeEventListener('touchstart', onStart);
        window.removeEventListener('touchend', onEnd);
    };
}
