// Piezas compartidas al traducir un JFItem del servidor a los modelos de
// dominio. Series, películas y los slides de la Home describen cosas
// distintas, pero las sacan de los mismos campos y con los mismos criterios
// (tamaños de imagen, qué cuenta como "visto", cómo se formatea el
// runtime). Tenerlas aquí evita que las tres copias se separen: cuando el
// póster de la ficha pasó a pedirse con `tag`, el de la Home se quedó atrás
// y seguía sirviendo la carátula vieja desde la caché del navegador.

import { autoTagsFor } from '../autotag';
import type { CastMember, Movie, Rating, Show } from '../models';
import { imageUrl, type ImageType } from './images';
import { ticksToMinutes, type JFItem, type JFMediaStream } from './types';

/** Ancho al que se piden los fondos del hero. */
const BACKDROP_WIDTH = 2560;
/** Alto al que se piden las carátulas. */
const POSTER_HEIGHT = 900;
const LOGO_HEIGHT = 400;
const CAST_PHOTO_HEIGHT = 320;
/** Reparto que llega a pintarse en la ficha. */
const CAST_LIMIT = 14;

export function mapCast(item: JFItem): CastMember[] {
    return (item.People ?? [])
        .filter((p) => p.Type === 'Actor')
        .slice(0, CAST_LIMIT)
        .map((p) => ({
            name: p.Name,
            role: p.Role || '',
            photo: p.PrimaryImageTag && p.Id ?
                imageUrl(p.Id, 'Primary', { tag: p.PrimaryImageTag, maxHeight: CAST_PHOTO_HEIGHT }) :
                null
        }));
}

// El tag es el etag de esa imagen concreta: sin él, cambiar el póster en el
// editor no invalida la caché del navegador porque la URL sigue siendo la
// misma. Vale para las tres URLs de abajo.

/** Carátula del item, o '' si no tiene. */
export function posterUrl(itemId: string | undefined, tag?: string): string {
    return imageUrl(itemId, 'Primary', { tag, maxHeight: POSTER_HEIGHT }) ?? '';
}

/**
 * Logo del item, o null si no tiene — la View cae entonces al título en
 * texto. Sin `tag` se devuelve null en vez de una URL sin etag: esa URL no
 * se invalidaría nunca en la caché del navegador, y un item sin tag de logo
 * es justamente un item sin logo.
 */
export function logoUrl(itemId: string | undefined, tag?: string): string | null {
    if (!itemId || !tag) return null;
    return imageUrl(itemId, 'Logo', { tag, maxHeight: LOGO_HEIGHT }) ?? null;
}

/** Todos los fondos del item, en orden, listos para rotar en el hero. */
export function backdropUrls(itemId: string | undefined, tags: string[] | undefined): string[] {
    return (tags ?? [])
        .map((tag, i) => imageUrl(itemId, 'Backdrop', { tag, maxWidth: BACKDROP_WIDTH, index: i }))
        .filter((u): u is string => !!u);
}

/** Un sitio de donde puede salir una imagen: tipo, item que la tiene y su tag. */
export type ImageSource = [ImageType, string | undefined, string | undefined];

/**
 * La primera imagen que exista, probando los candidatos en orden.
 *
 * Un episodio casi nunca tiene fondo propio y lo hereda de su serie, y una
 * carátula puede venir del item o de su padre: sin este encadenado las
 * rejillas quedan con huecos grises. Un candidato sin id o sin tag se salta —
 * una URL sin etag no se invalidaría nunca en la caché del navegador.
 */
export function firstImageUrl(
    sources: readonly ImageSource[],
    opts: { maxWidth?: number; maxHeight?: number }
): string | undefined {
    for (const [type, itemId, tag] of sources) {
        if (!itemId || !tag) continue;
        const url = imageUrl(itemId, type, { tag, ...opts });
        if (url) return url;
    }
    return undefined;
}

export function ratingOf(item: JFItem): Rating {
    return {
        imdb: item.CommunityRating ?? 0,
        age: item.OfficialRating ?? 'N/A'
    };
}

/** Runtime ya formateado para la ficha; '—' cuando el servidor no lo sabe. */
export function runtimeLabel(item: JFItem): string {
    const minutes = ticksToMinutes(item.RunTimeTicks);
    return minutes ? `${minutes} min` : '—';
}

/**
 * Progreso de visionado en 0..1. `Played` gana sobre el porcentaje: un item
 * marcado como visto a mano no trae PlayedPercentage y se quedaría en 0.
 */
export function watchedFraction(item: JFItem): number {
    if (item.UserData?.Played) return 1;
    const pct = item.UserData?.PlayedPercentage;
    return pct != null ? pct / 100 : 0;
}

/**
 * Lo que Show y Movie sacan igual del mismo JFItem: ficha, imágenes y
 * etiquetas. Lo propio de cada uno (temporadas, director, progreso) lo pone
 * su mapper encima.
 */
export type CommonItemFields = Pick<
    Show & Movie,
    'id' | 'title' | 'year' | 'runtime' | 'rating' | 'genres' | 'tags' | 'autoTags'
    | 'studio' | 'country' | 'premiere' | 'cast' | 'synopsis'
    | 'backdrop' | 'backdrops' | 'poster' | 'logo'
>;

export const AUDIO_CODEC_NAMES: Record<string, string> = {
    eac3: 'Dolby Digital+',
    ac3: 'Dolby Digital',
    truehd: 'TrueHD',
    dts: 'DTS',
    'dts-hd': 'DTS-HD',
    aac: 'AAC',
    opus: 'Opus',
    flac: 'FLAC',
    mp3: 'MP3'
};

export function resolutionLabel(height?: number, width?: number): string | undefined {
    const h = height ?? 0;
    const w = width ?? 0;
    if (h >= 4300 || w >= 7600) return '4320p';
    if (h >= 2100 || w >= 3800) return '2160p';
    if (h >= 1400 || w >= 2500) return '1440p';
    if (h >= 1030 || w >= 1900) return '1080p';
    if (h >= 690 || w >= 1200) return '720p';
    if (h >= 460 || w >= 700) return '480p';
    return undefined;
}

/** Extrae píldoras de calidad y especificaciones para cabeceras de detalle. */
export function extractMediaBadges(streams: JFMediaStream[] = []): string[] {
    const badges: string[] = [];
    const video = streams.find((s) => s.Type === 'Video');
    const audioTracks = streams.filter((s) => s.Type === 'Audio');
    const primaryAudio = audioTracks.find((s) => s.IsDefault) ?? audioTracks[0];

    if (video) {
        const h = video.Height ?? 0;
        const w = video.Width ?? 0;
        if (h >= 4300 || w >= 7600) {
            badges.push('8K');
        } else if (h >= 2100 || w >= 3800) {
            badges.push('4K UHD');
        } else if (h >= 1030 || w >= 1900) {
            badges.push('1080p');
        } else if (h >= 690 || w >= 1200) {
            badges.push('720p');
        }

        // Detección de HDR / Dolby Vision
        const rangeType = video.VideoRangeType ?? '';
        const range = video.VideoRange ?? '';
        const doViTitle = video.VideoDoViTitle ?? '';
        const title = video.Title ?? '';
        const isDoVi = Boolean(doViTitle)
            || /dovi|dolby\s*vision/i.test(rangeType)
            || /dovi|dolby\s*vision/i.test(range)
            || /dolby\s*vision|\bdv\b/i.test(title);

        if (isDoVi) {
            badges.push('Dolby Vision');
        } else if (/hdr10\+/i.test(rangeType) || /hdr10\+/i.test(range)) {
            badges.push('HDR10+');
        } else if (/hdr10/i.test(rangeType) || /hdr10/i.test(range)) {
            badges.push('HDR10');
        } else if (/hdr/i.test(rangeType) || /hdr/i.test(range)) {
            badges.push('HDR');
        } else if (/hlg/i.test(rangeType) || /hlg/i.test(range)) {
            badges.push('HLG');
        }

        // Códec de vídeo
        if (video.Codec) {
            const vc = video.Codec.toLowerCase();
            if (vc === 'hevc' || vc === 'h265') badges.push('HEVC');
            else if (vc === 'av1') badges.push('AV1');
            else if (vc === 'h264' || vc === 'avc') badges.push('H.264');
            else if (vc === 'vp9') badges.push('VP9');
            else if (vc === 'vc1') badges.push('VC-1');
            else badges.push(video.Codec.toUpperCase());
        }
    }

    if (primaryAudio) {
        const title = primaryAudio.Title ?? '';
        const displayTitle = primaryAudio.DisplayTitle ?? '';
        const profile = primaryAudio.Profile ?? '';
        const spatial = primaryAudio.AudioSpatialFormat ?? '';
        const codec = (primaryAudio.Codec ?? '').toLowerCase();

        const isAtmos = spatial === 'DolbyAtmos'
            || /atmos/i.test(profile)
            || /atmos/i.test(title)
            || /atmos/i.test(displayTitle);

        const isDtsX = /dts:x|dtsx/i.test(profile)
            || /dts:x|dtsx/i.test(title)
            || /dts:x|dtsx/i.test(displayTitle);

        if (isAtmos) {
            badges.push('Dolby Atmos');
        } else if (isDtsX) {
            badges.push('DTS:X');
        } else if (codec === 'dts-hd' || (codec === 'dts' && /ma|hd/i.test(profile + title))) {
            badges.push('DTS-HD');
        } else if (codec === 'truehd') {
            badges.push('TrueHD');
        } else if (codec === 'eac3') {
            badges.push('Dolby Digital+');
        } else if (codec === 'ac3') {
            badges.push('Dolby Digital');
        } else if (codec === 'flac') {
            badges.push('FLAC');
        }

        // Canales de audio
        if (primaryAudio.Channels === 8 || primaryAudio.ChannelLayout?.includes('7.1')) {
            badges.push('7.1');
        } else if (primaryAudio.Channels === 6 || primaryAudio.ChannelLayout?.includes('5.1')) {
            badges.push('5.1');
        }
    }

    return Array.from(new Set(badges));
}

export function summarizeVideo(streams: JFMediaStream[] = []): string | undefined {
    const video = streams.find((s) => s.Type === 'Video');
    if (!video) return undefined;
    const parts: string[] = [];
    const res = resolutionLabel(video.Height, video.Width);
    if (res) parts.push(res);
    if (video.Codec) parts.push(video.Codec.toUpperCase());
    const range = (video.VideoRangeType && video.VideoRangeType !== 'Unknown') ?
        video.VideoRangeType : (video.VideoRange || undefined);
    if (range) parts.push(range);
    return parts.length ? parts.join(' · ') : undefined;
}

export function summarizeAudio(streams: JFMediaStream[] = []): string | undefined {
    const tracks = streams.filter((s) => s.Type === 'Audio');
    if (tracks.length === 0) return undefined;
    const primary = tracks.find((s) => s.IsDefault) ?? tracks[0];
    const parts: string[] = [];
    if (primary.ChannelLayout) parts.push(primary.ChannelLayout);
    else if (primary.Channels) parts.push(`${primary.Channels} canales`);
    if (primary.Codec) {
        const key = primary.Codec.toLowerCase();
        parts.push(AUDIO_CODEC_NAMES[key] ?? primary.Codec.toUpperCase());
    }
    const langs = new Set(
        tracks.map((s) => s.Language).filter((l): l is string => !!l && l !== 'und')
    );
    if (langs.size > 1) parts.push(`${langs.size} idiomas`);
    return parts.length ? parts.join(' · ') : undefined;
}

export function summarizeSubtitles(streams: JFMediaStream[] = []): string | undefined {
    const subs = streams.filter((s) => s.Type === 'Subtitle');
    if (subs.length === 0) return undefined;
    const langs = new Set(
        subs.map((s) => s.Language).filter((l): l is string => !!l && l !== 'und')
    );
    const parts = [`${subs.length} pistas`];
    if (langs.size > 0) parts.push(`${langs.size} idiomas`);
    return parts.join(' · ');
}

export function mapCommonFields(item: JFItem): CommonItemFields {
    const backdrops = backdropUrls(item.Id, item.BackdropImageTags);
    return {
        id: item.Id,
        title: item.Name,
        year: item.ProductionYear ?? 0,
        runtime: runtimeLabel(item),
        rating: ratingOf(item),
        genres: item.Genres ?? [],
        tags: item.Tags ?? [],
        autoTags: autoTagsFor(item.Id),
        studio: (item.Studios ?? []).map((s) => s.Name).filter(Boolean).join(', '),
        country: (item.ProductionLocations ?? []).filter(Boolean).join(', '),
        premiere: item.PremiereDate ?? '',
        cast: mapCast(item),
        synopsis: item.Overview ?? '',
        backdrop: backdrops[0] ?? '',
        backdrops,
        poster: posterUrl(item.Id, item.ImageTags?.Primary),
        logo: logoUrl(item.Id, item.ImageTags?.Logo)
    };
}
