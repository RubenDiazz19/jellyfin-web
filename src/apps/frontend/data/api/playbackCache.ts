// Caché corta de la negociación de reproducción: el contexto del item
// (capítulos y pistas) y la decisión de PlaybackInfo.
//
// Está aquí para que el pre-calentamiento sirva de algo. Cuando la ficha
// dispara `prewarmPlayback` —al pasar por encima del botón de Play o al
// pulsarlo—, la negociación ya está hecha, o al menos en vuelo, para cuando el
// reproductor monta y la pide «de verdad»: lo que antes eran dos vueltas a la
// red en serie delante del primer fotograma ahora está resuelto de antemano.
// De paso, volver a una combinación de pistas ya negociada no repite el POST.
//
// Al revés que `listCache`, aquí NO hay revalidación en segundo plano ni TTL
// largo: lo cacheado no es un dato de catálogo sino una sesión de
// reproducción con su PlaySessionId, y refrescarla sola levantaría transcodes
// que nadie ha pedido. El TTL cubre lo que tiene que cubrir —de la ficha al
// reproductor— y poco más.

import { createTtlCache } from './ttlCache';

// La clave lleva el usuario (una decisión trae la URL firmada con SU token) y
// el itemId por delante, para poder invalidar un item suelto.
const cache = createTtlCache<Promise<unknown>>({ ttlMs: 60_000, userScoped: true });

/**
 * Lee de la caché o negocia con el servidor.
 *
 * `fresh` la salta y la reescribe: lo usa el reintento de arranque, que existe
 * precisamente porque la sesión negociada no valía (transcode que no levantó),
 * y servirle la misma respuesta cacheada lo dejaría sin efecto.
 */
export function cachedPlayback<T>(
    itemId: string,
    variant: string,
    load: () => Promise<T>,
    opts: { fresh?: boolean } = {}
): Promise<T> {
    const key = cache.key(itemId, variant);
    if (!opts.fresh) {
        const hit = cache.get(key);
        if (hit) return hit as Promise<T>;
    }
    const promise = load();
    const entry = cache.set(key, promise);
    // Un fallo no se queda cacheado: el siguiente intento tiene que salir a la
    // red (y el reproductor reintenta el arranque una vez).
    promise.catch(() => {
        if (cache.holds(key, entry)) cache.delete(key);
    });
    return promise;
}

/**
 * Tira lo negociado. Sin `itemId`, todo: lo llama cualquier mutación —incluido
 * el fin de reproducción, que emite la suya— porque un item que cambia (o una
 * sesión que termina) invalida lo que el servidor había decidido sobre él.
 */
export function invalidatePlayback(itemId?: string): void {
    if (!itemId) {
        cache.clear();
        return;
    }
    // `key(itemId, '')` deja justo el prefijo «usuario + item»: todas las
    // variantes de pistas negociadas para ese item cuelgan de ahí.
    cache.deleteByPrefix(cache.key(itemId, ''));
}
