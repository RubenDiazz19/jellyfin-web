// Validación de lo que contesta el modelo.
//
// Vive aquí y no en `scripts/` para que entre en `build:check` y en los tests:
// es la pieza donde de verdad se puede colar basura. Un LLM, por mucho que se
// le pida JSON y un vocabulario cerrado, de vez en cuando devuelve el JSON
// envuelto en ```json, se inventa una etiqueta que «encaja mejor», o contesta
// sobre un título que no estaba en el lote. Nada de eso debe llegar al fichero.
//
// Los títulos se identifican por su NÚMERO dentro del lote, no por su id de
// Jellyfin. Al mandar el id real —hexadecimal de 32 caracteres— el modelo lo
// copiaba mal cada pocas decenas de títulos, cambiando un dígito por otro; la
// entrada se descartaba por id desconocido y ese título se quedaba sin
// etiquetas sin que nada lo delatara. Con un número de una o dos cifras el
// error deja de ocurrir, y si ocurriera se ve al validar el rango.

import { canonicalTag, dropRedundant, MAX_TAGS_PER_ITEM, translateEnglishTag } from './vocabulary';
const STRICT = !!process.env.AUTOTAG_STRICT;

export type ParsedTags = {
    /** itemId -> etiquetas canónicas del vocabulario. */
    tags: Map<string, string[]>;
    /** Etiquetas inventadas que se han descartado (para avisar por consola). */
    rejectedTags: string[];
    /** Números fuera del lote que el modelo se ha sacado de la manga. */
    strayRefs: number[];
    /** Ids del lote sobre los que no ha dicho nada. */
    missingIds: string[];
};

/**
 * Quita el envoltorio ```json … ``` que algunos modelos añaden pese a estar en
 * modo JSON, y recorta a lo que hay entre la primera llave y la última.
 */
function stripFences(raw: string): string {
    const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

type ResultEntry = { n?: unknown; tags?: unknown };

/**
 * Acepta las dos formas que salen en la práctica: la pedida
 * (`{"results":[{"n","tags"}]}`) y el mapa plano (`{"1":["…"]}`), que es a lo
 * que derivan algunos modelos cuando el lote es corto.
 */
function toEntries(parsed: unknown): ResultEntry[] {
    if (!parsed || typeof parsed !== 'object') return [];
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results as ResultEntry[];
    return Object.entries(obj).map(([n, tags]) => ({ n, tags }));
}

/** El número de título, venga como number o como string. */
function toRef(value: unknown): number | undefined {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(n) ? n : undefined;
}

export function parseTagResponse(raw: string, batchIds: readonly string[]): ParsedTags {
    const tags = new Map<string, string[]>();
    const rejectedTags: string[] = [];
    const strayRefs: number[] = [];

    let parsed: unknown;
    try {
        parsed = JSON.parse(stripFences(raw));
    } catch {
        throw new Error(`El modelo no devolvió JSON válido: ${raw.slice(0, 200)}`);
    }

    for (const entry of toEntries(parsed)) {
        const ref = toRef(entry.n);
        if (ref === undefined) continue;
        // Los números son 1..N, como se numeran en el prompt.
        const itemId = batchIds[ref - 1];
        if (ref < 1 || !itemId) {
            strayRefs.push(ref);
            continue;
        }
        const clean: string[] = [];
        for (const rawTag of Array.isArray(entry.tags) ? entry.tags : []) {
            if (typeof rawTag !== 'string') continue;
            let tag = canonicalTag(rawTag);
            if (!tag) {
                // Try English to Spanish translation
                const translated = translateEnglishTag(rawTag);
                if (translated) {
                    tag = translated;
                    console.warn(`Translated English tag "${rawTag}" to Spanish "${tag}"`);
                } else {
                    rejectedTags.push(rawTag);
                    continue;
                }
            }
            if (!clean.includes(tag)) clean.push(tag);
        }
        // Un item sin etiquetas reconocibles no se guarda: se prefiere que no
        // salga en ningún chip a inventarle una categoría. El recorte va al
        // final, después de quitar redundancias, para no gastar plazas en
        // etiquetas que se van a caer.
        const useful = dropRedundant(clean);
        if (useful.length > 0) tags.set(itemId, useful.slice(0, MAX_TAGS_PER_ITEM));
    }

    // If strict mode is enabled, fail on any rejected or stray tags
    if (STRICT && (rejectedTags.length > 0 || strayRefs.length > 0)) {
        throw new Error(`Strict mode: encountered ${rejectedTags.length} rejected tags and ${strayRefs.length} stray references`);
    }
    return {
        tags,
        rejectedTags,
        strayRefs,
        missingIds: batchIds.filter((id) => !tags.has(id))
    };
}
