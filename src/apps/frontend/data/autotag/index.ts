// Lectura del etiquetado automático generado por `bun run autotag`.
//
// El mapa es un JSON que se empaqueta con el bundle: no hay llamada a ninguna
// IA en tiempo de ejecución. El script se pasa una vez sobre la biblioteca y
// deja el fichero escrito; si mañana el proveedor desaparece, las etiquetas
// siguen aquí.
//
// Vive en un fichero local y NO en las `Tags` del servidor a propósito: un
// refresco de metadatos de Jellyfin reescribe el item y se llevaría por
// delante el trabajo. Como efecto secundario, `setItemTags` (el diálogo de
// etiquetas) nunca puede subirlas al servidor sin querer, porque no forman
// parte de `item.tags`.

import rawFile from './autoTags.json';
import { canonicalTag, dropRedundant, MAX_TAGS_PER_ITEM, translateEnglishTag } from './vocabulary';

type AutoTagsFile = {
    _generatedAt?: string | null;
    items?: Record<string, string[]>;
};

let cache: Map<string, string[]> | null = null;

/**
 * Normaliza el fichero al leerlo: cada etiqueta pasa por el vocabulario, así
 * que un JSON viejo con etiquetas que ya se han quitado del vocabulario deja
 * de mostrarlas sin necesidad de regenerarlo. Lo que no se reconozca se cae.
 */
function ensure(): Map<string, string[]> {
    if (cache) return cache;
    cache = new Map();
    const items = (rawFile as AutoTagsFile).items;
    if (!items || typeof items !== 'object') return cache;

    for (const [itemId, tags] of Object.entries(items)) {
        if (!Array.isArray(tags)) continue;
        const clean: string[] = [];
        for (const raw of tags) {
            if (typeof raw !== 'string') continue;
            const tag = canonicalTag(raw) ?? translateEnglishTag(raw);
            if (tag && !clean.includes(tag)) clean.push(tag);
        }
        // También se quitan aquí las redundantes: un JSON generado antes de que
        // existiera esa regla no tiene por qué regenerarse para beneficiarse.
        const useful = dropRedundant(clean);
        if (useful.length > 0) cache.set(itemId, useful.slice(0, MAX_TAGS_PER_ITEM));
    }
    return cache;
}

/** Etiquetas automáticas de un item. Lista vacía si no se etiquetó. */
export function autoTagsFor(itemId: string | undefined): string[] {
    if (!itemId) return [];
    return ensure().get(itemId) ?? [];
}

/** Cuántos items tienen etiquetado automático. Para Ajustes/diagnóstico. */
export function autoTaggedCount(): number {
    return ensure().size;
}

/** Cuándo se generó el fichero, en ISO. `null` si nunca se ha pasado. */
export function autoTagsGeneratedAt(): string | null {
    return (rawFile as AutoTagsFile)._generatedAt ?? null;
}

export { canonicalTag, isVocabularyTag, VOCABULARY, VOCABULARY_TAGS } from './vocabulary';
