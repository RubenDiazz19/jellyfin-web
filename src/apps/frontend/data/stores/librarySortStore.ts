// Criterio de orden de la biblioteca, persistido en localStorage. Es una
// preferencia de navegación puramente local: no tiene sentido subirla al
// servidor ni compartirla entre dispositivos.

const KEY = 'jfp-library-sort';

export const SORT_KEYS = ['title', 'year', 'rating', 'runtime', 'random'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const DEFAULT_SORT: SortKey = 'title';

function isSortKey(value: unknown): value is SortKey {
    return typeof value === 'string' && (SORT_KEYS as readonly string[]).includes(value);
}

export const LIBRARY_SORT = {
    load(): SortKey {
        try {
            const raw = localStorage.getItem(KEY);
            return isSortKey(raw) ? raw : DEFAULT_SORT;
        } catch {
            // Modo privado o storage lleno: el orden por defecto sirve igual.
            return DEFAULT_SORT;
        }
    },
    save(key: SortKey): void {
        try {
            localStorage.setItem(KEY, key);
        } catch {
            // Sin persistencia el orden dura lo que la sesión; no es motivo
            // para romper la navegación.
        }
    }
};
