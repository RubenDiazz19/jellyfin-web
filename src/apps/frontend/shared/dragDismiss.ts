// Lógica pura del gesto "arrastrar para descartar" (bottom sheet M3 y
// snackbars). Igual que videoGestures.ts: fuera del componente para poder
// testear los umbrales sin simular eventos touch.

import {
    DRAG_THRESHOLD,
    DISMISS_DISTANCE,
    DISMISS_VELOCITY
} from './gestures/thresholds';

export {
    DRAG_THRESHOLD,
    DISMISS_DISTANCE,
    DISMISS_VELOCITY
};

/**
 * Velocidad instantánea (px/ms) entre dos muestras del arrastre. Se mide
 * sobre el último tramo, no sobre el gesto entero: soltar tras un flick
 * descarta, y frenar antes de soltar no.
 */
export function dragVelocity(deltaPx: number, elapsedMs: number): number {
    if (elapsedMs <= 0) return 0;
    return Math.abs(deltaPx) / elapsedMs;
}

/**
 * ¿El arrastre descarta al soltar? Por recorrido (`distance` ≥ `minDistance`)
 * o por flick (velocidad alta con un recorrido mínimo que descarte un roce).
 */
export function shouldDismiss(
    distance: number,
    velocity: number,
    minDistance: number = DISMISS_DISTANCE
): boolean {
    if (distance >= minDistance) return true;
    return velocity >= DISMISS_VELOCITY && distance >= DRAG_THRESHOLD * 2;
}
