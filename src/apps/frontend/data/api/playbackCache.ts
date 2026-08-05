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

import { loadSession } from '../session/session';

const TTL_MS = 60_000;

type Entry = { promise: Promise<unknown>; at: number };

const entries = new Map<string, Entry>();

// La clave lleva el usuario (una decisión trae la URL firmada con SU token) y
// el itemId por delante, para poder invalidar un item suelto.
function keyFor(itemId: string, variant: string): string {
    return `${loadSession()?.userId ?? ''}|${itemId}|${variant}`;
}

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
    const key = keyFor(itemId, variant);
    const entry = entries.get(key);
    if (!opts.fresh && entry && Date.now() - entry.at <= TTL_MS) {
        return entry.promise as Promise<T>;
    }
    const promise = load();
    const fresh: Entry = { promise, at: Date.now() };
    entries.set(key, fresh);
    // Un fallo no se queda cacheado: el siguiente intento tiene que salir a la
    // red (y el reproductor reintenta el arranque una vez).
    promise.catch(() => {
        if (entries.get(key) === fresh) entries.delete(key);
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
        entries.clear();
        return;
    }
    const prefix = `${loadSession()?.userId ?? ''}|${itemId}|`;
    for (const key of entries.keys()) {
        if (key.startsWith(prefix)) entries.delete(key);
    }
}
