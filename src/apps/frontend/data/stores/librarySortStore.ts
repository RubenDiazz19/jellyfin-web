// Criterio de orden de la biblioteca, persistido en localStorage. Es una
// preferencia de navegación puramente local: no tiene sentido subirla al
// servidor ni compartirla entre dispositivos.

import { createKVStore } from './persistentStore';

const KEY = 'jfp-library-sort';

const SORT_KEYS = ['title', 'year', 'rating', 'runtime', 'random'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const DEFAULT_SORT: SortKey = 'title';

function isSortKey(value: unknown): value is SortKey {
    return typeof value === 'string' && (SORT_KEYS as readonly string[]).includes(value);
}

const store = createKVStore<SortKey>({
    key: KEY,
    parse: (raw) => (isSortKey(raw) ? raw : DEFAULT_SORT),
    fallback: () => DEFAULT_SORT
});

export const LIBRARY_SORT = {
    load: (): SortKey => store.get(),
    save(key: SortKey): void {
        store.set(key);
    },
    _reset(): void {
        store._reset();
    }
};

