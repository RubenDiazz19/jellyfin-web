// Caché en memoria de los listados del catálogo (series, películas, carrusel
// de la home), con estrategia stale-while-revalidate.
//
// Sin esto, cada navegación a Home / Biblioteca / Búsqueda volvía a pedir la
// biblioteca entera a la red aunque se acabara de traer hace dos segundos: las
// tres pantallas piden las mismas dos listas y ninguna se acordaba de la
// anterior. Con caché, moverse entre ellas es instantáneo.
//
// Cómo se sirve una lectura:
//
//   dentro del TTL  → lo cacheado, sin tocar la red.
//   pasado el TTL   → lo cacheado YA, y se revalida por detrás; si el servidor
//                     trae algo distinto se avisa (`onRefreshed`) para que los
//                     ViewModels vuelvan a leer, y esa segunda lectura entra
//                     en caché fresca.
//   sin nada        → se pide y se guarda la promesa, así dos pantallas que
//                     arrancan a la vez comparten una sola petición.
//
// La coherencia tras una mutación local no depende del TTL: cualquier cambio
// (marcar visto, editar metadatos, borrar…) invalida todo esto — ver
// `invalidateLists` y quién la llama.

import { createTtlCache, type Stamped } from './ttlCache';

/**
 * Lo que se guarda de cada lista. El sello de tiempo y el alcance por usuario
 * los pone `createTtlCache`; la revalidación en segundo plano es política
 * propia de este caché y vive aquí.
 */
type Entry = {
    /** La carga en curso, o ya resuelta. Se comparte entre lectores. */
    promise: Promise<unknown>;
    /** El valor resuelto; ausente mientras la primera carga está en vuelo. */
    value?: unknown;
    /** Huella del valor, para saber si una revalidación trae algo nuevo. */
    signature?: string;
    revalidating?: boolean;
};

/**
 * TTL corto a propósito: con stale-while-revalidate lo peor que pasa al
 * cumplirse es servir una versión de hace un minuto mientras se comprueba, no
 * una espera.
 */
const cache = createTtlCache<Entry>({ ttlMs: 60_000, userScoped: true });

// FNV-1a sobre el JSON del valor. Se guarda la huella y no el JSON: comparar
// dos listas de mil items no debe costar otro megabyte de memoria.
function signatureOf(value: unknown): string {
    const json = JSON.stringify(value) ?? '';
    let h = 2166136261;
    for (let i = 0; i < json.length; i++) {
        h ^= json.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return `${json.length}:${h >>> 0}`;
}

/**
 * Lee `key` de la caché, cargándola con `load` si hace falta.
 *
 * `onRefreshed` se llama solo cuando una revalidación en segundo plano trae
 * datos distintos a los que ya se sirvieron: es la señal para que quien esté
 * enseñando la lista vuelva a pedirla (y se encuentre la caché fresca).
 */
export function cachedList<T>(
    key: string,
    load: () => Promise<T>,
    onRefreshed?: () => void
): Promise<T> {
    const k = cache.key(key);
    const stamped = cache.peek(k);
    if (!stamped) return fill(k, load);
    // Fresca, o todavía en vuelo: en ambos casos la promesa que hay es la
    // respuesta correcta, y lanzar otra petición encima no adelantaría nada.
    if (cache.isFresh(stamped) || stamped.value.value === undefined) {
        return stamped.value.promise as Promise<T>;
    }
    revalidate(k, stamped, load, onRefreshed);
    return Promise.resolve(stamped.value.value as T);
}

/** Tira TODOS los listados cacheados. La llama cualquier mutación de item. */
export function invalidateLists(): void {
    cache.clear();
}

function fill<T>(k: string, load: () => Promise<T>): Promise<T> {
    const promise = load();
    const stamped = cache.set(k, { promise });
    promise.then(
        (value) => {
            // Una invalidación pudo tirar la entrada mientras cargaba: esta
            // respuesta es anterior a la mutación, así que no se resucita.
            if (!cache.holds(k, stamped)) return;
            stamped.value.value = value;
            stamped.value.signature = signatureOf(value);
        },
        () => {
            if (cache.holds(k, stamped)) cache.delete(k);
        }
    );
    return promise;
}

function revalidate<T>(
    k: string,
    stamped: Stamped<Entry>,
    load: () => Promise<T>,
    onRefreshed?: () => void
): void {
    const entry = stamped.value;
    if (entry.revalidating) return;
    entry.revalidating = true;
    // El sello se renueva ya, antes de saber el resultado: si no, cada lectura
    // que llegue mientras la revalidación está en vuelo vería la entrada
    // vencida y pediría otra.
    cache.touch(stamped);
    load().then(
        (value) => {
            if (!cache.holds(k, stamped)) return;
            entry.revalidating = false;
            cache.touch(stamped);
            const signature = signatureOf(value);
            // Sin cambios se conserva el valor anterior a propósito: los
            // ViewModels publican la lista en un signal y una lista nueva
            // idéntica repintaría la rejilla entera para nada.
            if (signature === entry.signature) return;
            entry.signature = signature;
            entry.value = value;
            entry.promise = Promise.resolve(value);
            onRefreshed?.();
        },
        () => {
            if (!cache.holds(k, stamped)) return;
            // El servidor no contesta: se sigue sirviendo lo que hay y se
            // reintentará en la siguiente lectura pasada de TTL.
            entry.revalidating = false;
        }
    );
}
