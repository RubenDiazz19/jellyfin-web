/**
 * Separa los `#tag` del texto libre.
 *
 * Escribir `#anime cine` busca «cine» entre lo etiquetado como anime. Un `#`
 * suelto o a medio escribir no filtra nada todavía: si no, al teclear la
 * almohadilla la lista se vaciaba de golpe.
 */
export function parseQuery(raw: string): { text: string; tags: string[] } {
    const tags: string[] = [];
    const words: string[] = [];
    for (const word of raw.trim().split(/\s+/)) {
        if (!word) continue;
        if (word.startsWith('#')) {
            // Una almohadilla sola se descarta del todo: como etiqueta aún no
            // dice nada, y dejarla caer al texto libre buscaría «#» literal y
            // vaciaría la lista mientras se teclea.
            if (word.length > 1) tags.push(word.slice(1).toLowerCase());
            continue;
        }
        words.push(word);
    }
    return { text: words.join(' ').toLowerCase(), tags };
}

/**
 * Normaliza texto para búsqueda libre e indexación:
 * - A minúsculas.
 * - Descompone y elimina acentos / marcas diacríticas (NFD).
 * - Reemplaza signos de puntuación y símbolos por espacios para buscar palabras limpias.
 * - Colapsa espacios en blanco repetidos.
 */
export function normalizeSearchText(text: string | undefined | null): string {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
