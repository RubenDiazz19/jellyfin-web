import type { Movie, Show } from '../../data/models';
import { canonicalTag, getItemTags, normalizeTagForSearch } from '../tags';

/**
 * Extrae y normaliza todas las etiquetas de las obras del catálogo,
 * ignorando mayúsculas y conservando la primera grafía encontrada.
 */
export function computeAllTags(items: ReadonlyArray<Show | Movie>): string[] {
    const seen = new Map<string, string>();
    for (const item of items) {
        for (const tag of getItemTags(item)) {
            const key = normalizeTagForSearch(tag);
            if (!seen.has(key)) seen.set(key, tag);
        }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

type ComputeAvailableTagsOptions<T extends Show | Movie> = {
    allTags: string[];
    activeTags: string[];
    currentResults: ReadonlyArray<T>;
    hasOtherFilters: boolean;
};

/**
 * Calcula las etiquetas disponibles según los resultados actuales de la búsqueda.
 * Si no hay filtros activos que acoten, devuelve todas las etiquetas.
 * Si hay filtros activos, solo devuelve las etiquetas que tienen las obras resultantes
 * (más las etiquetas ya seleccionadas, para poder desmarcarlas).
 */
export function computeAvailableTags<T extends Show | Movie>({
    allTags,
    activeTags,
    currentResults,
    hasOtherFilters
}: ComputeAvailableTagsOptions<T>): string[] {
    const hasActiveTags = activeTags.length > 0;

    if (!hasActiveTags && !hasOtherFilters) {
        return allTags;
    }

    const seen = new Map<string, string>();

    // 1. Siempre incluir las etiquetas activas para que sigan visibles y desmarcables
    for (const tag of activeTags) {
        const canon = canonicalTag(tag);
        if (canon) {
            const key = normalizeTagForSearch(canon);
            if (!seen.has(key)) seen.set(key, canon);
        }
    }

    const totalResults = currentResults.length;

    // 2. Extraer etiquetas de las obras que coinciden con los filtros actuales
    if (hasActiveTags) {
        // Con etiquetas ya activas:
        // - Si solo queda 1 resultado (o ninguno), las demás opciones son irrelevantes.
        // - Si quedan varios resultados, solo ofrecemos etiquetas que realmente discriminen
        // (si una etiqueta está en el 100% de los resultados, seleccionarla no acotaría nada).
        if (totalResults > 1) {
            const tagFrequency = new Map<string, { canon: string; count: number }>();
            for (const item of currentResults) {
                for (const tag of getItemTags(item)) {
                    const key = normalizeTagForSearch(tag);
                    const entry = tagFrequency.get(key);
                    if (entry) {
                        entry.count++;
                    } else {
                        tagFrequency.set(key, { canon: tag, count: 1 });
                    }
                }
            }

            for (const [key, { canon, count }] of tagFrequency) {
                if (count < totalResults && !seen.has(key)) {
                    seen.set(key, canon);
                }
            }
        }
    } else {
        // Sin etiquetas activas aún (solo filtros de tipo/estado/valoración/búsqueda):
        // Extraer todas las etiquetas presentes en las obras resultantes.
        for (const item of currentResults) {
            for (const tag of getItemTags(item)) {
                const key = normalizeTagForSearch(tag);
                if (!seen.has(key)) seen.set(key, tag);
            }
        }
    }

    return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
