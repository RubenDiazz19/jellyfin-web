// Tags unificados: vocabulario cerrado en español.
//
// Solo pasan por aquí los tags que reconoce canonicalTag() de vocabulary.ts.
// Los keywords basura de TMDB (aftercreditsstinger, blind girl...) se descartan.
// Los genres NO entran aquí —gestionan su propio módulo (genres.ts).

import { canonicalTag, VOCABULARY_TAGS } from '../data/autotag/vocabulary';
import { autoTagsFor } from '../data/autotag';

export { canonicalTag, VOCABULARY_TAGS, autoTagsFor };

/** Item con campos de tag (tags del servidor + autoTags locales). */
export type TaggableItem = {
    tags?: string[];
    autoTags?: string[];
};

/**
 * Devuelve los tags válidos de un item: autoTags + server tags que pasen
 * el vocabulario cerrado. Deduplica, normaliza y ordena alfabéticamente.
 */
export function getItemTags(item: TaggableItem | null | undefined): string[] {
    if (!item) return [];
    const candidates = [...(item.autoTags ?? []), ...(item.tags ?? [])];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of candidates) {
        const canon = canonicalTag(raw);
        if (canon) {
            const key = canon.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                result.push(canon);
            }
        }
    }
    return result.sort((a, b) => a.localeCompare(b));
}

/** Normaliza una etiqueta para comparaciones case-insensitive. */
export function normalizeTagForSearch(tag: string | undefined | null): string {
    return (tag ?? '').trim().toLowerCase();
}
