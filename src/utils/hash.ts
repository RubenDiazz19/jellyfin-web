/**
 * Hash de 32 bits FNV-1a.
 * Determinista, rápido y con buena distribución para hashing en memoria
 * (semillas de ordenación aleatoria, claves de caché, etc.).
 */
export function fnv1a(str: string): number {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
