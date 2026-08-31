// Vistas guardadas: combinaciones de filtros de la búsqueda a las que volver
// de un clic.
//
// Son LOCALES a propósito. Una vista es configuración de navegación de este
// dispositivo, no un dato de la biblioteca; las etiquetas a las que apunta sí
// viven en el servidor, así que la misma vista funciona desde cualquier
// cliente que tenga esa etiqueta.

import { createListStore } from './persistentStore';

export type RatingOperator = '>=' | '>' | '<=' | '<' | '=';

export type SavedView = {
    id: string;
    name: string;
    typeFilter: string;
    stateFilter: string;
    /**
     * Etiqueta seleccionada. Formato viejo, de cuando solo se podía filtrar
     * por una; se sigue leyendo para no invalidar las vistas ya guardadas en
     * el localStorage de nadie. Lo que se escribe hoy es `tags`.
     */
    tag?: string;
    /** Etiquetas seleccionadas; ausente = sin filtro de etiqueta. */
    tags?: string[];
    /** Texto de búsqueda; ausente = vacío. */
    query?: string;
    /** Filtro de valoración numérica; ausente = sin filtro. */
    ratingFilter?: { operator: RatingOperator; value: number };
    ratingFilters?: { operator: RatingOperator; value: number }[];
};

function isView(v: unknown): v is SavedView {
    const view = v as SavedView;
    return !!view
        && typeof view.id === 'string'
        && typeof view.name === 'string'
        && typeof view.typeFilter === 'string'
        && typeof view.stateFilter === 'string';
}

const store = createListStore<SavedView>({
    key: 'jfp-views',
    event: 'jfp-views-change',
    isValid: isView
});

export const VIEWS = {
    event: store.event,

    all: () => store.all(),

    /**
     * Guarda una vista. Repetir nombre reemplaza en su sitio en vez de
     * duplicar: «guardar actual» dos veces con el mismo nombre es
     * inequívocamente actualizar.
     */
    save(view: Omit<SavedView, 'id'>): SavedView {
        const existing = store.all()
            .find((v) => v.name.toLowerCase() === view.name.toLowerCase());
        const entry: SavedView = { ...view, id: existing?.id ?? `v${Date.now()}` };
        store.update((list) => (existing ?
            list.map((v) => (v.id === existing.id ? entry : v)) :
            [...list, entry]));
        return entry;
    },

    remove(id: string) {
        store.update((list) => list.filter((v) => v.id !== id));
    }
};
