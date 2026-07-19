// Series listing + detail. Detail hydrates seasons/episodes eagerly so the
// ShowPage → SeasonPage → EpisodePage flow can navigate without re-fetching.

import type { CastMember, Episode, Season, Show } from '../models';
import { loadSession } from '../session/session';
import { WATCHED } from '../stores/watchedStore';
import { showCache } from './cache';
import { apiFetch } from './http';
import { imageUrl } from './images';
import { settlePlaybackReports } from './playback';
import { FIELDS_DETAIL, FIELDS_LIST, ticksToMinutes, type JFItem, type JFMediaStream } from './types';

function mapCast(item: JFItem): CastMember[] {
    return (item.People ?? [])
        .filter((p) => p.Type === 'Actor')
        .slice(0, 14)
        .map((p) => ({
            name: p.Name,
            role: p.Role || '',
            photo: p.PrimaryImageTag && p.Id ?
                imageUrl(p.Id, 'Primary', { tag: p.PrimaryImageTag, maxHeight: 320 }) :
                null
        }));
}

function mapShow(item: JFItem): Show {
    const runtimeMin = ticksToMinutes(item.RunTimeTicks);
    const backdrops = (item.BackdropImageTags ?? [])
        .map((tag, i) => imageUrl(item.Id, 'Backdrop', { tag, maxWidth: 2560, index: i }) ?? '')
        .filter(Boolean);
    return {
        id: item.Id,
        title: item.Name,
        year: item.ProductionYear ?? 0,
        runtime: runtimeMin ? `${runtimeMin} min` : '—',
        rating: {
            imdb: item.CommunityRating ?? 0,
            rt: 0,
            age: item.OfficialRating ?? 'N/A'
        },
        genres: item.Genres ?? [],
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
        poster: imageUrl(item.Id, 'Primary', { maxHeight: 900 }) ?? '',
        logo: item.ImageTags?.Logo ?
            imageUrl(item.Id, 'Logo', { tag: item.ImageTags.Logo, maxHeight: 400 }) ?? null :
            null
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
    const played = item.UserData?.Played ?? false;
    const pct = item.UserData?.PlayedPercentage;
    const watched = played ? 1 : pct != null ? pct / 100 : 0;
    const source = item.MediaSources?.[0];
    const streams = source?.MediaStreams ?? [];
    return {
        n: item.IndexNumber ?? 0,
        title: item.Name,
        date: item.PremiereDate,
        runtime: ticksToMinutes(item.RunTimeTicks),
        synopsis: item.Overview,
        thumb: imageUrl(item.Id, 'Primary', { maxWidth: 720 }),
        thumbHD: imageUrl(item.Id, 'Primary', { maxWidth: 1920 }),
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
    if (!session?.userId) throw new Error('Sin sesión');
    const data = await apiFetch<{ Items: JFItem[] }>(
        `/Users/${session.userId}/Items?IncludeItemTypes=Series&Recursive=true&SortBy=SortName&Fields=${FIELDS_LIST}`
    );
    return (data.Items ?? []).map(mapShow);
}

export async function getShow(id: string): Promise<Show> {
    // Antes de mirar el caché: un stop en vuelo está a punto de limpiarlo y
    // de mover las posiciones en el servidor.
    await settlePlaybackReports();
    const cached = showCache.get(id);
    if (cached) return cached;
    const p = (async () => {
        const session = loadSession();
        if (!session?.userId) throw new Error('Sin sesión');
        const item = await apiFetch<JFItem>(
            `/Users/${session.userId}/Items/${id}?Fields=${FIELDS_DETAIL}`
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
    showCache.set(id, p);
    p.catch(() => showCache.delete(id));
    return p;
}

async function getSeasonsWithEpisodes(showId: string): Promise<Season[]> {
    const session = loadSession();
    if (!session?.userId) throw new Error('Sin sesión');
    const seasonData = await apiFetch<{ Items: JFItem[] }>(
        `/Shows/${showId}/Seasons?userId=${session.userId}&Fields=Overview,ImageTags`
    );
    const seasons: Season[] = [];
    for (const s of seasonData.Items ?? []) {
        if (typeof s.IndexNumber !== 'number') continue;
        const epData = await apiFetch<{ Items: JFItem[] }>(
            `/Shows/${showId}/Episodes?userId=${session.userId}&seasonId=${s.Id}&Fields=Overview,ImageTags,RunTimeTicks,PremiereDate,MediaSources,MediaStreams`
        );
        const eps = (epData.Items ?? []).map(mapEpisode).sort((a, b) => a.n - b.n);
        seasons.push({
            n: s.IndexNumber,
            jfId: s.Id,
            year: s.ProductionYear,
            total: eps.length,
            watched: eps.filter((e) => e.watched >= 1).length,
            synopsis: s.Overview,
            // Seasons usually have their own Primary (poster) and no backdrop;
            // reuse the poster as the SeasonCard background.
            backdrop: imageUrl(s.Id, 'Primary', { maxHeight: 900 }),
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
