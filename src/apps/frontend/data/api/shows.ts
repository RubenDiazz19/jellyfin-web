// Series listing + detail. Detail hydrates seasons/episodes eagerly so the
// ShowPage → SeasonPage → EpisodePage flow can navigate without re-fetching.

import { autoTagsFor } from '../autotag';
import type { Episode, Season, Show } from '../models';
import { loadSession } from '../session/session';
import { WATCHED } from '../stores/watchedStore';
import { showCache } from './cache';
import { apiFetch, noSessionError } from './http';
import { imageUrl } from './images';
import {
    backdropUrls, logoUrl, mapCast, posterUrl, ratingOf, runtimeLabel, watchedFraction
} from './itemMapping';
import { settlePlaybackReports } from './playback';
import { FIELDS_DETAIL, FIELDS_LIST, ticksToMinutes, type JFItem, type JFMediaStream } from './types';

function mapShow(item: JFItem): Show {
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
        creator: '',
        directors: '',
        studio: item.Studios?.[0]?.Name ?? '',
        country: '',
        premiere: item.PremiereDate ?? '',
        status: item.Status ?? '',
        cast: mapCast(item),
        synopsis: item.Overview ?? '',
        defaultSeason: 1,
        cont: { seasonN: 1, epN: 1, progress: 0, remaining: '' },
        seasons: [],
        backdrop: backdrops[0] ?? '',
        backdrops,
        poster: posterUrl(item.Id, item.ImageTags?.Primary),
        logo: logoUrl(item.Id, item.ImageTags?.Logo)
    };
}

// Height → resolution label (480p/720p/1080p/2160p…).
function resolutionLabel(height?: number, width?: number): string | undefined {
    const h = height ?? 0;
    if (h >= 4300) return '4320p';
    if (h >= 2100) return '2160p';
    if (h >= 1400) return '1440p';
    if (h >= 1030) return '1080p';
    if (h >= 690) return '720p';
    if (h >= 460) return '480p';
    if (width && width >= 1900) return '1080p';
    return undefined;
}

const AUDIO_CODEC_NAMES: Record<string, string> = {
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

function summarizeVideo(streams: JFMediaStream[] = []): string | undefined {
    const video = streams.find((s) => s.Type === 'Video');
    if (!video) return undefined;
    const parts: string[] = [];
    const res = resolutionLabel(video.Height, video.Width);
    if (res) parts.push(res);
    if (video.Codec) parts.push(video.Codec.toUpperCase());
    const range = video.VideoRangeType && video.VideoRangeType !== 'Unknown' ? video.VideoRangeType : undefined;
    if (range) parts.push(range);
    return parts.length ? parts.join(' · ') : undefined;
}

function summarizeAudio(streams: JFMediaStream[] = []): string | undefined {
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

function summarizeSubtitles(streams: JFMediaStream[] = []): string | undefined {
    const subs = streams.filter((s) => s.Type === 'Subtitle');
    if (subs.length === 0) return undefined;
    const langs = new Set(
        subs.map((s) => s.Language).filter((l): l is string => !!l && l !== 'und')
    );
    const parts = [`${subs.length} pistas`];
    if (langs.size > 0) parts.push(`${langs.size} idiomas`);
    return parts.join(' · ');
}

function mapEpisode(item: JFItem): Episode {
    const watched = watchedFraction(item);
    const source = item.MediaSources?.[0];
    const streams = source?.MediaStreams ?? [];
    // Thumb (16:9, encuadre pensado para miniatura) > Primary del episodio >
    // backdrop de la serie como último recurso.
    const epImage = (maxWidth: number) =>
        (item.ImageTags?.Thumb ?
            imageUrl(item.Id, 'Thumb', { tag: item.ImageTags.Thumb, maxWidth }) :
            undefined)
        ?? (item.ImageTags?.Primary ?
            imageUrl(item.Id, 'Primary', { tag: item.ImageTags.Primary, maxWidth }) :
            undefined)
        ?? (item.ParentBackdropItemId && item.ParentBackdropImageTags?.[0] ?
            imageUrl(item.ParentBackdropItemId, 'Backdrop', {
                tag: item.ParentBackdropImageTags[0], maxWidth
            }) :
            undefined);
    return {
        n: item.IndexNumber ?? 0,
        title: item.Name,
        date: item.PremiereDate,
        runtime: ticksToMinutes(item.RunTimeTicks),
        synopsis: item.Overview,
        thumb: epImage(720),
        thumbHD: epImage(1920),
        watched,
        jfId: item.Id,
        video: summarizeVideo(streams),
        audio: summarizeAudio(streams),
        subtitles: summarizeSubtitles(streams),
        container: source?.Container ?? item.Container
    };
}

export async function getShows(): Promise<Show[]> {
    await settlePlaybackReports();
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const data = await apiFetch<{ Items: JFItem[] }>(
        `/Users/${session.userId}/Items?IncludeItemTypes=Series&Recursive=true&SortBy=SortName&Fields=${FIELDS_LIST}`
    );
    return (data.Items ?? []).map(mapShow);
}

export async function getShow(id: string): Promise<Show> {
    // Antes de mirar el caché: un stop en vuelo está a punto de limpiarlo y
    // de mover las posiciones en el servidor.
    await settlePlaybackReports();
    // La sesión se lee ANTES de mirar el caché: el usuario forma parte de la
    // clave, y capturarlo aquí evita que un cambio de cuenta a media petición
    // haga que el `catch` de abajo borre la entrada de otra cuenta.
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const { userId } = session;
    const cached = showCache.get(userId, id);
    if (cached) return cached;
    const p = (async () => {
        const item = await apiFetch<JFItem>(
            `/Users/${userId}/Items/${id}?Fields=${FIELDS_DETAIL}`
        );
        const show = mapShow(item);
        show.seasons = await getSeasonsWithEpisodes(id);
        hydrateWatched(id, show.seasons);
        const firstIncomplete = show.seasons
            .flatMap((s) => s.episodes.map((e) => ({ s, e })))
            .find(({ e }) => e.watched < 1);
        if (firstIncomplete) {
            const { s, e } = firstIncomplete;
            show.cont = {
                seasonN: s.n,
                epN: e.n,
                progress: e.watched,
                // Minutos restantes del episodio en curso (la View los formatea).
                remaining: e.runtime ?
                    String(Math.max(1, Math.round((1 - e.watched) * e.runtime))) :
                    ''
            };
            show.defaultSeason = s.n;
        }
        return show;
    })();
    showCache.set(userId, id, p);
    p.catch(() => showCache.delete(userId, id));
    return p;
}

async function getSeasonsWithEpisodes(showId: string): Promise<Season[]> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    // Dos peticiones fijas (temporadas + TODOS los episodios) en vez de
    // 1 + N por temporada; los episodios se agrupan por ParentIndexNumber.
    const [seasonData, epData] = await Promise.all([
        apiFetch<{ Items: JFItem[] }>(
            `/Shows/${showId}/Seasons?userId=${session.userId}&Fields=Overview,ImageTags`
        ),
        apiFetch<{ Items: JFItem[] }>(
            `/Shows/${showId}/Episodes?userId=${session.userId}&Fields=Overview,ImageTags,RunTimeTicks,PremiereDate,MediaSources,MediaStreams`
        )
    ]);

    const bySeason = new Map<number, Episode[]>();
    for (const item of epData.Items ?? []) {
        const seasonN = item.ParentIndexNumber;
        if (typeof seasonN !== 'number') continue;
        const list = bySeason.get(seasonN) ?? [];
        list.push(mapEpisode(item));
        bySeason.set(seasonN, list);
    }

    const seasons: Season[] = [];
    for (const s of seasonData.Items ?? []) {
        if (typeof s.IndexNumber !== 'number') continue;
        const eps = (bySeason.get(s.IndexNumber) ?? []).sort((a, b) => a.n - b.n);
        seasons.push({
            n: s.IndexNumber,
            jfId: s.Id,
            year: s.ProductionYear,
            total: eps.length,
            watched: eps.filter((e) => e.watched >= 1).length,
            synopsis: s.Overview,
            // Seasons usually have their own Primary (poster) and no backdrop;
            // reuse the poster as the SeasonCard background.
            backdrop: imageUrl(s.Id, 'Primary', {
                tag: s.ImageTags?.Primary, maxHeight: 900
            }),
            episodes: eps
        });
    }
    seasons.sort((a, b) => a.n - b.n);
    return seasons;
}

// Trae el estado del servidor al store local: los botones agregados de
// "visto" (temporada / serie) leen del store para reactividad instantánea,
// pero la verdad es el server. Sincroniza en ambos sentidos dentro del
// scope de esta serie: lo marcado en el server entra al set; lo que ya no
// esté marcado (desmarcado en otro cliente) sale.
function hydrateWatched(showId: string, seasons: Season[]) {
    const allIds: string[] = [];
    const watched: string[] = [];
    for (const season of seasons) {
        for (const ep of season.episodes) {
            const id = `${showId}-s${season.n}-e${ep.n}`;
            allIds.push(id);
            if (ep.watched >= 1) watched.push(id);
        }
    }
    WATCHED.sync(allIds, watched);
}
