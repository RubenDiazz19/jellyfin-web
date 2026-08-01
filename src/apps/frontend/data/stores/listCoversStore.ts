// Qué listas tienen un fondo puesto a mano.
//
// El problema que resuelve: Jellyfin acaba generando una portada para cada
// lista —un collage de sus títulos, en `metadata/library/…/poster.png`— y la
// guarda en el MISMO sitio y con la misma forma que una imagen subida por el
// usuario. Mirando el servidor no hay manera de distinguirlas: una lista
// recién creada llega con `ImageTags: {}`, pero en cuanto el collage aparece
// ya no se sabe quién lo puso.
//
// Así que se anota aquí. Es LOCAL y solo decide qué se pinta: perderlo no
// borra ninguna imagen del servidor, solo hace que la lista vuelva a enseñar
// la portada automática (la del último título añadido).

const KEY = 'jfp-list-covers';

let cache: Set<string> | null = null;

function ensure(): Set<string> {
    if (cache) return cache;
    try {
        const raw: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
        cache = new Set(Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string') : []);
    } catch {
        cache = new Set();
    }
    return cache;
}

function persist(set: Set<string>) {
    try {
        localStorage.setItem(KEY, JSON.stringify([...set]));
    } catch {
        // Sin persistencia el registro dura lo que la pestaña. La caché en
        // memoria ya está actualizada, así que la UI queda coherente.
    }
}

export const LIST_COVERS = {
    /** True si el fondo de esa lista lo puso el usuario. */
    has(key: string): boolean {
        return ensure().has(key);
    },

    mark(key: string) {
        const set = ensure();
        if (set.has(key)) return;
        set.add(key);
        persist(set);
    },

    unmark(key: string) {
        const set = ensure();
        if (!set.delete(key)) return;
        persist(set);
    },

    /** Solo para tests. */
    _reset() {
        cache = null;
    }
};
