// Contexto del item que se va a reproducir, en UNA sola petición: a qué
// título pertenece (la serie, si es un episodio), sus capítulos y las pistas
// de la fuente. El reproductor lo necesita ANTES de pedir PlaybackInfo para
// poder pedir ya las pistas del idioma preferido; hacerlo después obligaría
// a recargar la fuente nada más empezar.

import type { TitleLanguagePref } from '../preferences/languagePrefs';
import { loadSession } from '../session/session';
import { apiFetch, noSessionError } from './http';
import { imageUrl } from './images';
import { mapMediaStream, type MediaStreamInfo, type PlaybackOptions } from './playback';
import { cachedPlayback } from './playbackCache';
import type { JFMediaStream } from './types';

const TICKS_PER_SECOND = 10_000_000;

export type ItemChapter = {
    /** Inicio del capítulo en segundos. */
    start: number;
    name?: string;
};

export type PlaybackContext = {
    /**
     * Id bajo el que se recuerdan las preferencias de pista: la serie si el
     * item es un episodio (para que valgan en toda la serie), o el propio
     * item si es una película.
     */
    titleId: string;
    /** El item reproducido es un episodio: cambia el texto del OSD. */
    isEpisode: boolean;
    chapters: ItemChapter[];
    audioStreams: MediaStreamInfo[];
    subtitleStreams: MediaStreamInfo[];
    /** Id de la fuente elegida; sin él el servidor ignora los índices pedidos. */
    mediaSourceId?: string;
    /** Duración en segundos, para acotar el último capítulo. */
    runtime?: number;
};

type JFChapter = { StartPositionTicks?: number; Name?: string };

type JFPlaybackItem = {
    Id?: string;
    Type?: string;
    SeriesId?: string;
    RunTimeTicks?: number;
    Chapters?: JFChapter[];
    MediaSources?: { Id?: string; MediaStreams?: JFMediaStream[] }[];
};

/**
 * Contexto del item. Cacheado (ver `playbackCache`) porque lo piden dos: el
 * pre-calentamiento de la ficha y, un instante después, el reproductor al
 * montarse. El segundo no debería volver a la red por algo que acaba de
 * llegar.
 */
export function getPlaybackContext(itemId: string): Promise<PlaybackContext> {
    return cachedPlayback(itemId, 'context', () => fetchPlaybackContext(itemId));
}

async function fetchPlaybackContext(itemId: string): Promise<PlaybackContext> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const item = await apiFetch<JFPlaybackItem>(
        `/Users/${session.userId}/Items/${itemId}?Fields=Chapters,MediaSources`
    );

    // MediaSources[0] es la misma fuente que elige getPlaybackDecision.
    const source = (item.MediaSources ?? [])[0];
    const streams = source?.MediaStreams ?? [];

    return {
        titleId: (item.Type === 'Episode' && item.SeriesId) || itemId,
        isEpisode: item.Type === 'Episode',
        chapters: (item.Chapters ?? []).map((c) => ({
            start: (c.StartPositionTicks ?? 0) / TICKS_PER_SECOND,
            name: c.Name
        })),
        audioStreams: streams.filter((s) => s.Type === 'Audio').map(mapMediaStream),
        subtitleStreams: streams.filter((s) => s.Type === 'Subtitle').map(mapMediaStream),
        mediaSourceId: source?.Id,
        runtime: item.RunTimeTicks ? item.RunTimeTicks / TICKS_PER_SECOND : undefined
    };
}

/**
 * Traduce los idiomas recordados de un título a índices de pista concretos.
 *
 * Lo que no esté recordado se deja sin pedir a propósito: así el servidor
 * aplica la preferencia del usuario (Ajustes), que es el siguiente escalón de
 * la cadena. Vive aquí, y no en el ViewModel del reproductor, porque el
 * pre-calentamiento tiene que llegar EXACTAMENTE a los mismos índices: si no,
 * negociaría una sesión con otras pistas y el reproductor la pediría de nuevo
 * al montarse —dos transcodes, y el calentamiento en balde—.
 */
export function preferredTrackIndices(
    pref: TitleLanguagePref | null,
    context: PlaybackContext | null
): PlaybackOptions {
    if (!pref || !context) return {};

    const byLanguage = (streams: MediaStreamInfo[], language: string) =>
        streams.find((s) => s.language === language)?.index;

    const audioStreamIndex = pref.audio ?
        byLanguage(context.audioStreams, pref.audio) :
        undefined;
    // -1 = "sin subtítulos" explícito; sin él el servidor reactivaría el
    // default del usuario.
    const subtitleStreamIndex = pref.subtitle === null ?
        -1 :
        pref.subtitle ? byLanguage(context.subtitleStreams, pref.subtitle) : undefined;

    if (audioStreamIndex == null && subtitleStreamIndex == null) return {};
    return { audioStreamIndex, subtitleStreamIndex, mediaSourceId: context.mediaSourceId };
}

// ── Siguiente episodio ──────────────────────────────────────────────────────

export type NextEpisode = {
    id: string;
    /** Nombre del episodio. */
    title: string;
    /** Línea secundaria del botón: «T1 · E7». */
    label: string;
    /** Miniatura para el botón de auto-avance. */
    thumb?: string;
};

type JFEpisode = {
    Id?: string;
    Name?: string;
    IndexNumber?: number;
    ParentIndexNumber?: number;
    ImageTags?: Record<string, string>;
};

/**
 * El episodio que va después del actual dentro de su serie, o null si es el
 * último. Se pide la lista completa de la serie (dos docenas de items como
 * mucho) y se busca la posición del actual: es el mismo endpoint que ya usa
 * la ficha de la serie, así que no estrena superficie de API.
 */
export async function getNextEpisode(
    seriesId: string, episodeId: string
): Promise<NextEpisode | null> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const data = await apiFetch<{ Items?: JFEpisode[] }>(
        `/Shows/${seriesId}/Episodes?userId=${session.userId}&Fields=ImageTags`
    );
    const items = data.Items ?? [];
    const current = items.findIndex((e) => e.Id === episodeId);
    const next = current >= 0 ? items[current + 1] : undefined;
    if (!next?.Id) return null;

    const season = next.ParentIndexNumber;
    const number = next.IndexNumber;
    return {
        id: next.Id,
        title: next.Name ?? '',
        label: [
            season != null ? `T${season}` : '',
            number != null ? `E${String(number).padStart(2, '0')}` : ''
        ].filter(Boolean).join(' · '),
        thumb: imageUrl(next.Id, 'Primary', {
            tag: next.ImageTags?.Primary, maxWidth: 480
        }) ?? undefined
    };
}
