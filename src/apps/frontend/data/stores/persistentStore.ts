// Base de los stores locales: caché en memoria + localStorage + (opcional)
// evento global de cambio.
//
// La caché no es un lujo: en la Home hay decenas de tarjetas consultando
// favoritos y «visto» por render, y sin ella cada scroll provocaba cientos de
// JSON.parse. Solo se escribe JSON al persistir un cambio.
//
// Escribir puede fallar (modo privado, cuota llena) y eso NO puede tumbar la
// UI: se ignora el fallo y se notifica igual. La caché en memoria ya está
// actualizada, así que la pantalla queda coherente; lo que se pierde es la
// persistencia entre sesiones, que es el mal menor.

function read<T>(key: string, parse: (raw: unknown) => T, fallback: () => T): T {
    try {
        return parse(JSON.parse(localStorage.getItem(key) || 'null'));
    } catch {
        return fallback();
    }
}

function write(key: string, value: unknown, event?: string) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Ver la nota de cabecera: sin persistencia, pero coherente.
    }
    if (event && typeof window !== 'undefined') window.dispatchEvent(new Event(event));
}

/** Store de un conjunto de ids. */
export type SetStore = {
    has(id: string): boolean;
    all(): string[];
    /** Añade los que falten. Los ids vacíos se ignoran. */
    add(ids: readonly string[]): void;
    remove(ids: readonly string[]): void;
    toggle(id: string): void;
    setMany(ids: readonly string[], value: boolean): void;
    /**
     * Deja `scope` valiendo exactamente lo que dice `active`: los ids del
     * scope que no estén en `active` salen, los que estén entran. Un solo
     * evento aunque cambien varios, y ninguno si no cambia nada.
     */
    sync(scope: readonly string[], active: readonly string[]): void;
    /** Solo para tests: obliga a releer localStorage. */
    _reset(): void;
};

/** Store cuyos cambios se anuncian por un evento global del `window`. */
export type NotifyingSetStore = SetStore & { readonly event: string };

type SetStoreOptions = {
    key: string;
    /** Forma canónica de un id, aplicada al guardar y al consultar. */
    normalize?: (id: string) => string;
};

export function createSetStore(options: SetStoreOptions & { event: string }): NotifyingSetStore;
export function createSetStore(options: SetStoreOptions): SetStore;
export function createSetStore(
    { key, event, normalize }: SetStoreOptions & { event?: string }
): NotifyingSetStore {
    let cache: Set<string> | null = null;

    const clean = (id: string) => (normalize ? normalize(id) : id);

    function ensure(): Set<string> {
        cache ??= read(
            key,
            (raw) => new Set(
                Array.isArray(raw) ?
                    raw.filter((id): id is string => typeof id === 'string').map(clean) :
                    []
            ),
            () => new Set<string>()
        );
        return cache;
    }

    /** Aplica `mutate` y persiste solo si de verdad ha cambiado algo. */
    function update(mutate: (set: Set<string>) => boolean) {
        const set = ensure();
        if (mutate(set)) write(key, [...set], event);
    }

    return {
        event: event ?? '',

        has: (id) => ensure().has(clean(id)),

        all: () => [...ensure()],

        add(ids) {
            update((set) => {
                let changed = false;
                for (const raw of ids) {
                    const id = clean(raw);
                    if (!id || set.has(id)) continue;
                    set.add(id);
                    changed = true;
                }
                return changed;
            });
        },

        remove(ids) {
            update((set) => {
                let changed = false;
                for (const raw of ids) changed = set.delete(clean(raw)) || changed;
                return changed;
            });
        },

        toggle(id) {
            update((set) => {
                const value = clean(id);
                if (!set.delete(value)) set.add(value);
                return true;
            });
        },

        setMany(ids, value) {
            update((set) => {
                for (const raw of ids) {
                    if (value) set.add(clean(raw));
                    else set.delete(clean(raw));
                }
                return true;
            });
        },

        sync(scope, active) {
            const target = new Set(active.map(clean));
            update((set) => {
                let changed = false;
                for (const raw of scope) {
                    const id = clean(raw);
                    if (target.has(id)) {
                        if (set.has(id)) continue;
                        set.add(id);
                        changed = true;
                    } else {
                        changed = set.delete(id) || changed;
                    }
                }
                return changed;
            });
        },

        _reset() {
            cache = null;
        }
    };
}

/** Store de una lista ordenada de entradas. */
export type ListStore<T> = {
    readonly event: string;
    all(): T[];
    /** Reemplaza la lista entera. Siempre notifica. */
    replace(next: T[]): void;
    /** Deriva la lista siguiente de la actual. */
    update(next: (current: T[]) => T[]): void;
    _reset(): void;
};

export function createListStore<T>(options: {
    key: string;
    event: string;
    /**
     * Descarta las entradas que no tengan la forma esperada: lo guardado puede
     * venir de una versión anterior del formato.
     */
    isValid: (entry: unknown) => entry is T;
}): ListStore<T> {
    const { key, event, isValid } = options;
    let cache: T[] | null = null;

    function ensure(): T[] {
        cache ??= read(key, (raw) => (Array.isArray(raw) ? raw.filter(isValid) : []), () => []);
        return cache;
    }

    const replace = (next: T[]) => {
        cache = next;
        write(key, next, event);
    };

    return {
        event,
        all: () => [...ensure()],
        replace,
        update(next) {
            replace(next(ensure()));
        },
        _reset() {
            cache = null;
        }
    };
}
