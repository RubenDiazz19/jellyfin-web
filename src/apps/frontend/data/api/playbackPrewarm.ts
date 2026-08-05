// Pre-calentamiento del arranque de una reproducción.
//
// Pulsar Play encadena hasta cinco vueltas a la red en serie antes del primer
// fotograma: contexto del item → PlaybackInfo → master.m3u8 → playlist →
// primer fragmento. Y ninguna empieza hasta que el reproductor está montado,
// porque hasta entonces el servidor no sabe que vas a reproducir nada.
//
// Esto adelanta las dos primeras —y, si se le pide, arranca también el
// transcode— desde la ficha, aprovechando el tiempo muerto entre que el
// usuario mira el botón y el reproductor aparece en pantalla. No devuelve
// nada: lo negociado queda en `playbackCache`, que es de donde lo saca el
// reproductor al montarse sin enterarse de que alguien se le adelantó.
//
// Todo lo que puede fallar aquí es opcional por definición: si el
// pre-calentamiento no llega a tiempo o revienta, el arranque normal hace su
// trabajo igual que antes.

import { getTitleLanguagePref } from '../preferences/languagePrefs';
import { loadSession } from '../session/session';
import { getPlaybackDecision } from './playback';
import { getPlaybackContext, preferredTrackIndices } from './playbackContext';

export type PrewarmOptions = {
    /**
     * Además de negociar, pedir el manifiesto HLS. Es lo que pone a ffmpeg a
     * trabajar, así que se reserva para cuando la reproducción es segura (el
     * clic en Play): en un simple hover levantaría transcodes que nadie va a
     * mirar, y en un servidor modesto eso se nota.
     */
    manifest?: boolean;
};

export async function prewarmPlayback(
    itemId: string,
    { manifest = false }: PrewarmOptions = {}
): Promise<void> {
    const userId = loadSession()?.userId;
    if (!itemId || !userId) return;
    try {
        // Las mismas dos llamadas que hará el reproductor, en el mismo orden y
        // con las mismas pistas: el contexto hace falta para saber a qué
        // título pertenece el item y traducir sus idiomas recordados.
        const context = await getPlaybackContext(itemId);
        const decision = await getPlaybackDecision(
            itemId,
            preferredTrackIndices(getTitleLanguagePref(userId, context.titleId), context)
        );
        // En Direct Play no hay nada que calentar: el <video> pide el fichero
        // en cuanto tiene el src, y para eso está su `preload`.
        if (!manifest || decision.kind !== 'hls') return;
        // El cuerpo se lee y se tira: lo que interesa es que el servidor haya
        // levantado ya el transcode y tenga la playlist a mano cuando hls.js
        // pida esta misma URL dentro de un momento.
        const res = await fetch(decision.url);
        await res.text();
    } catch (e) {
        console.debug('[player] pre-calentamiento no completado', e);
    }
}
