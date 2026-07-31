// Vistas guardadas: combinaciones de filtros de la búsqueda a las que volver
// de un clic. Misma forma que favsStore/queueStore: caché en memoria + evento
// global para que la UI re-lea.
//
// Son LOCALES a propósito. Una vista es configuración de navegación de este
// dispositivo, no un dato de la biblioteca; las etiquetas a las que apunta sí
// viven en el servidor, así que la misma vista funciona desde cualquier
// cliente que tenga esa etiqueta.

const KEY = 'jfp-views';
const EVENT = 'jfp-views-change';

export type SavedView = {
    id: string;
    name: string;
    typeFilter: string;
    stateFilter: string;
    /** Etiqueta seleccionada; ausente = sin filtro de etiqueta. */
    tag?: string;
    /** Texto de búsqueda; ausente = vacío. */
    query?: string;
};

let cache: SavedView[] | null = null;

function isView(v: unknown): v is SavedView {
    const view = v as SavedView;
    return !!view
        && typeof view.id === 'string'
        && typeof view.name === 'string'
        && typeof view.typeFilter === 'string'
        && typeof view.stateFilter === 'string';
}

function ensure(): SavedView[] {
    if (cache) return cache;
    try {
        const raw: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
        cache = Array.isArray(raw) ? raw.filter(isView) : [];
    } catch {
        cache = [];
    }
    return cache;
}

function persist(next: SavedView[]) {
    cache = next;
    try {
        localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        // Sin persistencia las vistas duran lo que la pestaña; se sigue
        // notificando para que la UI quede coherente con la caché.
    }
    window.dispatchEvent(new Event(EVENT));
}

export const VIEWS = {
    event: EVENT,

    all(): SavedView[] {
        return [...ensure()];
    },

    /**
     * Guarda una vista. Repetir nombre reemplaza en su sitio en vez de
     * duplicar: «guardar actual» dos veces con el mismo nombre es
     * inequívocamente actualizar.
     */
    save(view: Omit<SavedView, 'id'>): SavedView {
        const list = ensure();
        const existing = list.find((v) => v.name.toLowerCase() === view.name.toLowerCase());
        const entry: SavedView = { ...view, id: existing?.id ?? `v${Date.now()}` };
        persist(existing ?
            list.map((v) => (v.id === existing.id ? entry : v)) :
            [...list, entry]);
        return entry;
    },

    remove(id: string) {
        persist(ensure().filter((v) => v.id !== id));
    }
};
