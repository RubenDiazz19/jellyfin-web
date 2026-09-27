// Utilidades de runtime compartidas por LibraryViewModel y SearchViewModel.
// Centraliza la extracción de minutos a partir de un valor mixto (número o
// texto tipo «120 min», «2 h 56 min», «—»).

/**
 * Extrae el número entero de minutos de un valor de runtime del modelo.
 * Acepta number directo o string («120 min», «120», «—» → 0).
 */
export function runtimeMinutes(runtime: string | number | undefined): number {
    if (runtime == null) return 0;
    if (typeof runtime === 'number') return runtime > 0 ? Math.round(runtime) : 0;
    return parseInt(runtime, 10) || 0;
}
