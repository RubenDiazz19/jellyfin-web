// Utilidades matemáticas compartidas del frontend propio.

/**
 * Restringe un valor dentro del intervalo [min, max].
 */
export function clamp(val: number, min: number, max: number): number {
    return Math.min(Math.max(val, min), max);
}

/**
 * Comprueba si un punto está dentro de un rectángulo.
 */
export function pointInRect(
    point: { x: number; y: number } | null,
    rect: { left: number; right: number; top: number; bottom: number }
): boolean {
    if (!point) return false;
    return point.x >= rect.left && point.x <= rect.right
        && point.y >= rect.top && point.y <= rect.bottom;
}
