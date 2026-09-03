// Lógica pura de los gestos táctiles del reproductor (solo mobile/tablet).
// Se aísla del componente para poder testearla sin simular eventos touch.

export type Zone = 'left' | 'center' | 'right';
export type SwipeAxis = 'horizontal' | 'vertical' | 'none';

import {
    VIDEO_CLOSE_BAND,
    VIDEO_CLOSE_DISTANCE,
    VIDEO_MOVE_THRESHOLD,
    VIDEO_SEEK_RANGE_SECONDS
} from './gestures/thresholds';

export const MOVE_THRESHOLD = VIDEO_MOVE_THRESHOLD;
export const CLOSE_BAND = VIDEO_CLOSE_BAND;
export const CLOSE_DISTANCE = VIDEO_CLOSE_DISTANCE;
export const SEEK_RANGE_SECONDS = VIDEO_SEEK_RANGE_SECONDS;

/** Tercio horizontal donde cae x dentro de un ancho dado. */
export function gestureZone(x: number, width: number): Zone {
    if (width <= 0) return 'center';
    const t = x / width;
    if (t < 1 / 3) return 'left';
    if (t > 2 / 3) return 'right';
    return 'center';
}

/** Mitad horizontal (para separar brillo/volumen en swipe vertical). */
export function verticalControl(x: number, width: number): 'brightness' | 'volume' {
    return x < width / 2 ? 'brightness' : 'volume';
}

/**
 * Clasifica un desplazamiento como swipe horizontal, vertical o ninguno
 * (aún por debajo del umbral de movimiento).
 */
export function classifySwipe(dx: number, dy: number): SwipeAxis {
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (Math.max(adx, ady) < MOVE_THRESHOLD) return 'none';
    return adx >= ady ? 'horizontal' : 'vertical';
}

/**
 * Segundos de seek correspondientes a un arrastre horizontal `dx` sobre un
 * elemento de ancho `width`. Escala lineal: ancho completo = SEEK_RANGE.
 */
export function seekDeltaFromDrag(dx: number, width: number): number {
    if (width <= 0) return 0;
    return (dx / width) * SEEK_RANGE_SECONDS;
}

/**
 * Nuevo valor (0..1) de un control vertical (brillo/volumen) a partir del
 * desplazamiento vertical `dy` (positivo hacia abajo) sobre `height`.
 * Arrastrar hacia arriba sube; el recorrido útil es ~el 60% del alto.
 */
export function verticalDelta(dy: number, height: number): number {
    if (height <= 0) return 0;
    // -dy: hacia arriba (dy negativo) incrementa. /0.6 → sensibilidad.
    return (-dy / height) / 0.6;
}

/** Escala de un pinch a partir de las distancias inicial y actual. */
export function pinchScale(startDist: number, currentDist: number): number {
    if (startDist <= 0) return 1;
    return currentDist / startDist;
}

/** Distancia euclídea entre dos puntos táctiles. */
export function touchDistance(
    a: { clientX: number; clientY: number },
    b: { clientX: number; clientY: number }
): number {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export function clamp01(v: number): number {
    return Math.min(1, Math.max(0, v));
}
