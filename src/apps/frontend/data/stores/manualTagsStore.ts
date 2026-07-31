// Etiquetas que ha escrito el usuario a mano, para poder distinguirlas de los
// keywords crudos de TMDB.
//
// El problema que resuelve: en `item.Tags` del servidor conviven dos cosas muy
// distintas —los cientos de keywords que baja TMDB («aftercreditsstinger»,
// «blind girl») y lo que el usuario teclea en el diálogo de etiquetas— y el
// servidor no las marca de ninguna forma. La fila de chips solo debe enseñar
// las segundas; sin este registro habría que elegir entre enseñarlo todo (la
// tira infinita de la captura) o perder las etiquetas propias.
//
// Es LOCAL y solo aditivo: no es la fuente de verdad de nada, únicamente
// decide qué se pinta. Perderlo no borra ninguna etiqueta — las etiquetas
// siguen en el servidor y se siguen encontrando con `#`.

const KEY = 'jfp-manual-tags';

let cache: Set<string> | null = null;

function ensure(): Set<string> {
    if (cache) return cache;
    try {
        const raw: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
        cache = new Set(
            Array.isArray(raw) ?
                raw.filter((t): t is string => typeof t === 'string').map((t) => t.toLowerCase()) :
                []
        );
    } catch {
        cache = new Set();
    }
    return cache;
}

export const MANUAL_TAGS = {
    /** Registra etiquetas como escritas por el usuario. */
    add(tags: readonly string[]) {
        const set = ensure();
        let changed = false;
        for (const tag of tags) {
            const key = tag.trim().toLowerCase();
            if (key && !set.has(key)) {
                set.add(key);
                changed = true;
            }
        }
        if (!changed) return;
        try {
            localStorage.setItem(KEY, JSON.stringify([...set]));
        } catch {
            // Sin persistencia el registro dura lo que la pestaña. La caché en
            // memoria ya está actualizada, así que la UI queda coherente.
        }
    },

    /** True si el usuario ha escrito esta etiqueta alguna vez. */
    has(tag: string): boolean {
        return ensure().has(tag.trim().toLowerCase());
    },

    /** Solo para tests. */
    _reset() {
        cache = null;
    }
};
