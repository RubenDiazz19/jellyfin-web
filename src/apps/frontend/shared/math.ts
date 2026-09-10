// Utilidades matemáticas compartidas del frontend propio.

/**
 * Restringe un valor dentro del intervalo [min, max].
 */
export function clamp(val: number, min: number, max: number): number {
    return Math.min(Math.max(val, min), max);
}
