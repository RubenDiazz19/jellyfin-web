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

// ── Persistencia diferida ───────────────────────────────────────────────
//
// La caché en memoria y el evento de cambio van SÍNCRONOS: la pantalla no
// puede esperar a nadie. Lo que se aplaza es serializar a localStorage, que
// es lo caro — el set de «visto» de una biblioteca grande son miles de ids, y
// abrir una serie disparaba una escritura del conjunto ENTERO por cada
// `sync()`. Agrupando, una ráfaga de cambios se persiste una sola vez.
//
// El riesgo de aplazar es perder el último cambio si la pestaña se cierra
// dentro de la ventana; por eso se vuelca también al ocultarse la página, que
// es el único aviso fiable que dan los navegadores móviles.

/** Ventana de agrupación. Suficiente para una ráfaga, corta para el usuario. */
const FLUSH_DELAY_MS = 200;

/** clave de localStorage → último valor pendiente de escribir. */
const pending = new Map<string, unknown>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushWrites() {
    if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    for (const [key, value] of pending) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // Ver la nota de cabecera: sin persistencia, pero coherente.
        }
    }
    pending.clear();
}

let flushHooked = false;

function scheduleWrite(key: string, value: unknown) {
    // El Map guarda el ÚLTIMO valor por clave: varias mutaciones seguidas
    // sobre el mismo store se serializan una vez, no una por mutación.
    pending.set(key, value);
    if (typeof window === 'undefined') {
        flushWrites();
        return;
    }
    if (!flushHooked) {
        flushHooked = true;
        // 'pagehide' cubre el cierre y la navegación; 'visibilitychange' es el
        // que de verdad llega en móvil al irse a otra app. 'beforeunload' no:
        // rompe el bfcache y no dispara en iOS.
        window.addEventListener('pagehide', flushWrites);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') flushWrites();
        });
    }
    flushTimer ??= setTimeout(flushWrites, FLUSH_DELAY_MS);
}

/** Solo para tests: fuerza el volcado pendiente. */
export function flushPersistentStores(): void {
    flushWrites();
}

/**
 * Qué ids han cambiado, si el store lo sabe.
 *
 * Va en el `detail` del evento para que quien escucha pueda descartarlo sin
 * releer nada: sin esto, marcar un episodio como visto repintaba todas las
 * tarjetas de la página. Un evento SIN `ids` significa «cambió algo, no sé
 * qué» y obliga a releer — es lo que emiten los stores de lista.
 */
export type StoreChange = { ids?: readonly string[] };

function write(key: string, value: unknown, event?: string, ids?: readonly string[]) {
    scheduleWrite(key, value);
    if (event && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent<StoreChange>(event, { detail: { ids } }));
    }
}

/** Store de un conjunto de ids. */
export type SetStore = {
    has(id: string): boolean;
    all(): string[];
    /** Añade los que falten. Los ids vacíos se ignoran. */
    add(ids: readonly string[]): void;
    remove(ids: readonly string[]): void;
    toggle(id: string): void;
    /** Deja todos los ids en `value`. Un solo evento, y ninguno si nada cambia. */
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
    /**
     * Forma canónica de un id, aplicada al guardar y al consultar. Los ids que
     * viajan en el evento de cambio van YA normalizados: quien filtre por id
     * tiene que comparar contra la forma canónica.
     */
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

    /**
     * Aplica `mutate` y persiste solo si de verdad ha cambiado algo. `mutate`
     * devuelve los ids que ha tocado; una lista vacía es «nada que hacer» y no
     * escribe ni notifica.
     */
    function update(mutate: (set: Set<string>) => string[]) {
        const set = ensure();
        const changed = mutate(set);
        if (changed.length > 0) write(key, [...set], event, changed);
    }

    return {
        event: event ?? '',

        has: (id) => ensure().has(clean(id)),

        all: () => [...ensure()],

        add(ids) {
            update((set) => {
                const changed: string[] = [];
                for (const raw of ids) {
                    const id = clean(raw);
                    if (!id || set.has(id)) continue;
                    set.add(id);
                    changed.push(id);
                }
                return changed;
            });
        },

        remove(ids) {
            update((set) => {
                const changed: string[] = [];
                for (const raw of ids) {
                    const id = clean(raw);
                    if (set.delete(id)) changed.push(id);
                }
                return changed;
            });
        },

        toggle(id) {
            update((set) => {
                const value = clean(id);
                if (!set.delete(value)) set.add(value);
                return [value];
            });
        },

        setMany(ids, value) {
            update((set) => {
                const changed: string[] = [];
                for (const raw of ids) {
                    const id = clean(raw);
                    // Solo los que de verdad cambian de lado: `setMany` se
                    // llama con temporadas enteras y lo normal es que la mayor
                    // parte ya estuviera en el valor pedido.
                    if (value ? set.has(id) : !set.has(id)) continue;
                    if (value) set.add(id);
                    else set.delete(id);
                    changed.push(id);
                }
                return changed;
            });
        },

        sync(scope, active) {
            const target = new Set(active.map(clean));
            update((set) => {
                const changed: string[] = [];
                for (const raw of scope) {
                    const id = clean(raw);
                    if (target.has(id)) {
                        if (set.has(id)) continue;
                        set.add(id);
                        changed.push(id);
                    } else if (set.delete(id)) {
                        changed.push(id);
                    }
                }
                return changed;
            });
        },

        _reset() {
            cache = null;
            // También lo que quedara en cola. `_reset()` significa «olvida lo
            // que tengas y relee el disco», y los tests lo usan justo después
            // de un `localStorage.clear()`: un volcado posterior resucitaría
            // lo que se acaba de borrar. Para comprobar que algo llegó DE
            // VERDAD a localStorage, `flushPersistentStores()` primero.
            pending.delete(key);
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
            // También lo que quedara en cola. `_reset()` significa «olvida lo
            // que tengas y relee el disco», y los tests lo usan justo después
            // de un `localStorage.clear()`: un volcado posterior resucitaría
            // lo que se acaba de borrar. Para comprobar que algo llegó DE
            // VERDAD a localStorage, `flushPersistentStores()` primero.
            pending.delete(key);
        }
    };
}
