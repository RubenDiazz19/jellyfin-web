// Contexto del item que se va a reproducir, en UNA sola petición: a qué
// título pertenece (la serie, si es un episodio), sus capítulos y las pistas
// de la fuente. El reproductor lo necesita ANTES de pedir PlaybackInfo para
// poder pedir ya las pistas del idioma preferido; hacerlo después obligaría
// a recargar la fuente nada más empezar.

import type { TitleLanguagePref } from '../preferences/languagePrefs';
import { loadSession } from '../session/session';
import { apiFetch, noSessionError, trimSlash } from './http';
import { imageUrl } from './images';
import { mapMediaStream, type MediaStreamInfo, type PlaybackOptions } from './playback';
import { cachedPlayback } from './playbackCache';
import { TICKS_PER_SECOND, type JFMediaStream } from './types';

export type ItemChapter = {
    /** Inicio del capítulo en segundos. */
    start: number;
    name?: string;
    imageTag?: string;
    hasImage?: boolean;
};

export type TrickplayResolutionInfo = {
    width: number;
    height: number;
    tileWidth: number;
    tileHeight: number;
    thumbnailCount: number;
    interval: number;
    bandwidth?: number;
};

export type TrickplayData = {
    itemId: string;
    mediaSourceId?: string;
    resolutions: Record<string, TrickplayResolutionInfo>;
};

export type TrickplayThumbnail = {
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
    sheetWidth: number;
    sheetHeight: number;
    isSingleImage?: boolean;
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
    trickplay?: TrickplayData;
};

type JFChapter = {
    StartPositionTicks?: number;
    Name?: string;
    ImageTag?: string;
    ImagePath?: string;
};

type JFPlaybackItem = {
    Id?: string;
    Type?: string;
    SeriesId?: string;
    RunTimeTicks?: number;
    Chapters?: JFChapter[];
    Trickplay?: unknown;
    trickplay?: unknown;
    MediaSources?: {
        Id?: string;
        MediaStreams?: JFMediaStream[];
        Trickplay?: unknown;
        trickplay?: unknown;
    }[];
};

function parseResolutionInfo(val: unknown): TrickplayResolutionInfo | null {
    if (!val || typeof val !== 'object') return null;
    const v = val as Record<string, unknown>;
    const width = Number(v.Width ?? v.width);
    const height = Number(v.Height ?? v.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return null;
    }
    const tileWidth = Number(v.TileWidth ?? v.tileWidth) || 10;
    const tileHeight = Number(v.TileHeight ?? v.tileHeight) || 10;
    const thumbnailCount = Number(v.ThumbnailCount ?? v.thumbnailCount) || 0;
    const interval = Number(v.Interval ?? v.interval) || 10000;
    const bandwidth = v.Bandwidth ?? v.bandwidth;
    return {
        width,
        height,
        tileWidth,
        tileHeight,
        thumbnailCount,
        interval,
        bandwidth: typeof bandwidth === 'number' ? bandwidth : undefined
    };
}

export function extractTrickplay(
    itemId: string,
    mediaSourceId: string | undefined,
    rawTrickplay: unknown
): TrickplayData | undefined {
    if (!rawTrickplay || typeof rawTrickplay !== 'object') return undefined;
    const raw = rawTrickplay as Record<string, unknown>;

    // 1. Caso A: ya es un mapa de resoluciones directamente (ej: { '320': { Width: 320, ... } })
    let resolutionMap: Record<string, unknown> | null = null;
    const firstKey = Object.keys(raw)[0];
    if (firstKey && Number(firstKey) > 0 && typeof raw[firstKey] === 'object') {
        resolutionMap = raw;
    } else {
        // 2. Caso B: mapa indexado por mediaSourceId (ej: { '<sourceId>': { '320': { ... } } })
        if (mediaSourceId) {
            const cleanId = mediaSourceId.toLowerCase().replace(/-/g, '');
            for (const [sKey, sVal] of Object.entries(raw)) {
                if (sKey.toLowerCase().replace(/-/g, '') === cleanId && sVal && typeof sVal === 'object') {
                    resolutionMap = sVal as Record<string, unknown>;
                    break;
                }
            }
        }
        // Fallback: si no coincide el ID exacto, tomar el primer mapa de fuentes que contenga resoluciones
        if (!resolutionMap && firstKey && typeof raw[firstKey] === 'object') {
            resolutionMap = raw[firstKey] as Record<string, unknown>;
        }
    }

    if (!resolutionMap) return undefined;

    const resolutions: Record<string, TrickplayResolutionInfo> = {};
    for (const [key, val] of Object.entries(resolutionMap)) {
        const info = parseResolutionInfo(val);
        if (info) {
            resolutions[key] = info;
        }
    }

    if (Object.keys(resolutions).length === 0) return undefined;
    return { itemId, mediaSourceId, resolutions };
}

export function getTrickplayThumbnail(
    trickplay: TrickplayData | null | undefined,
    timeSeconds: number,
    serverUrl: string
): TrickplayThumbnail | null {
    if (!trickplay || !trickplay.resolutions) return null;
    const widths = Object.keys(trickplay.resolutions);
    if (widths.length === 0) return null;
    const targetWidthKey = widths.includes('320') ? '320' : widths[0];
    const res = trickplay.resolutions[targetWidthKey];
    if (!res || res.interval <= 0 || res.tileWidth <= 0 || res.tileHeight <= 0) return null;

    const timeMs = Math.max(0, timeSeconds * 1000);
    const thumbIndex = Math.floor(timeMs / res.interval);
    const clampedIndex = Math.min(Math.max(0, thumbIndex), Math.max(0, res.thumbnailCount - 1));
    const tilesPerSheet = res.tileWidth * res.tileHeight;
    const sheetIndex = Math.floor(clampedIndex / tilesPerSheet);
    const indexInSheet = clampedIndex % tilesPerSheet;
    const col = indexInSheet % res.tileWidth;
    const row = Math.floor(indexInSheet / res.tileWidth);

    const cleanBase = trimSlash(serverUrl || '');
    const sourceParam = trickplay.mediaSourceId ? `?MediaSourceId=${encodeURIComponent(trickplay.mediaSourceId)}` : '';
    const url = `${cleanBase}/Videos/${trickplay.itemId}/Trickplay/${res.width}/${sheetIndex}.jpg${sourceParam}`;

    return {
        url,
        x: col * res.width,
        y: row * res.height,
        width: res.width,
        height: res.height,
        sheetWidth: res.width * res.tileWidth,
        sheetHeight: res.height * res.tileHeight
    };
}

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
        `/Users/${session.userId}/Items/${itemId}?Fields=Chapters,MediaSources,Trickplay`
    );

    // MediaSources[0] es la misma fuente que elige getPlaybackDecision.
    const source = (item.MediaSources ?? [])[0];
    const streams = source?.MediaStreams ?? [];

    const trickplayRaw = source?.Trickplay
        ?? (source as unknown as Record<string, unknown>)?.trickplay
        ?? item.Trickplay
        ?? (item as unknown as Record<string, unknown>)?.trickplay;
    const trickplay = extractTrickplay(itemId, source?.Id, trickplayRaw);

    return {
        titleId: (item.Type === 'Episode' && item.SeriesId) || itemId,
        isEpisode: item.Type === 'Episode',
        chapters: (item.Chapters ?? []).map((c) => ({
            start: (c.StartPositionTicks ?? 0) / TICKS_PER_SECOND,
            name: c.Name,
            imageTag: c.ImageTag ?? undefined,
            hasImage: !!(c.ImageTag || c.ImagePath)
        })),
        audioStreams: streams.filter((s) => s.Type === 'Audio').map(mapMediaStream),
        subtitleStreams: streams.filter((s) => s.Type === 'Subtitle').map(mapMediaStream),
        mediaSourceId: source?.Id,
        runtime: item.RunTimeTicks ? item.RunTimeTicks / TICKS_PER_SECOND : undefined,
        trickplay
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
