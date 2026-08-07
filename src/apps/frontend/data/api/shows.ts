// Series listing + detail. Detail hydrates seasons/episodes eagerly so the
// ShowPage → SeasonPage → EpisodePage flow can navigate without re-fetching.

import type { Episode, Season, Show } from '../models';
import { loadSession } from '../session/session';
import { episodeKey } from '../stores/itemKeys';
import { WATCHED } from '../stores/watchedStore';
import { showCache } from './cache';
import { isDeleted, itemGoneError } from './deleted';
import { apiFetch, fetchUserItems, noSessionError } from './http';
import { imageUrl } from './images';
import { firstImageUrl, mapCommonFields, watchedFraction } from './itemMapping';
import { cachedList } from './listCache';
import { emitListsRefreshed } from './mutations';
import { settlePlaybackReports } from './playback';
import {
    FIELDS_DETAIL, FIELDS_GRID, GRID_IMAGE_TYPES, ticksToMinutes,
    type JFItem, type JFMediaStream
} from './types';

// Exportado para las consultas de `discover` (género, persona, similares),
// que traen series y películas mezcladas en la misma respuesta y necesitan
// mapear cada una con el mismo criterio que su listado de origen.
export function mapShow(item: JFItem): Show {
    return {
        ...mapCommonFields(item),
        creator: '',
        directors: '',
        status: item.Status ?? '',
        defaultSeason: 1,
        cont: { seasonN: 1, epN: 1, progress: 0, remaining: '' },
        seasons: [],
        // El servidor ya agrega el «visto» de la serie entera en su UserData;
        // sin leerlo aquí, una serie vista solo se sabía abriendo su ficha y
        // mirando episodio por episodio.
        watched: watchedFraction(item)
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
    const epImage = (maxWidth: number) => firstImageUrl([
        ['Thumb', item.Id, item.ImageTags?.Thumb],
        ['Primary', item.Id, item.ImageTags?.Primary],
        ['Backdrop', item.ParentBackdropItemId, item.ParentBackdropImageTags?.[0]]
    ], { maxWidth });
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

/**
 * Todas las series de la biblioteca. Cacheada: la piden la Home, la
 * Biblioteca y el buscador, y las tres se turnan durante una misma sesión de
 * navegación. Ver `listCache` para cuándo sale de la caché y cuándo de la red.
 */
export function getShows(): Promise<Show[]> {
    return cachedList('shows', fetchShows, emitListsRefreshed);
}

async function fetchShows(): Promise<Show[]> {
    await settlePlaybackReports();
    const items = await fetchUserItems<JFItem>(
        'IncludeItemTypes=Series&Recursive=true&SortBy=SortName'
        + `&Fields=${FIELDS_GRID}&EnableImageTypes=${GRID_IMAGE_TYPES}`
    );
    const shows = items.map(mapShow);
    // Hidrata el store local de «visto» con la verdad del server, igual que
    // hace `fetchMovies`. Es lo que hace que una serie marcada como vista se
    // vea marcada en la Home y en la biblioteca, donde no hay episodios que
    // agregar.
    hydrateShowWatched(shows);
    return shows;
}

export async function getShow(id: string): Promise<Show> {
    // Se acaba de borrar: pedirla sería un 404 con el que nadie puede hacer
    // nada útil. Ver deleted.ts.
    if (isDeleted(id)) throw itemGoneError();
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
            //
            // Sin etiqueta no se compone la URL: la temporada NO tiene póster
            // (pasa con las que el proveedor todavía no ha catalogado) y pedirla
            // igual devuelve un 404 que se pinta como un rectángulo gris. Vacío
            // deja que la tarjeta caiga al póster de la serie. Misma regla que
            // `firstImageUrl`.
            backdrop: s.ImageTags?.Primary ?
                imageUrl(s.Id, 'Primary', { tag: s.ImageTags.Primary, maxHeight: 900 }) :
                undefined,
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
//
// Se sincroniza TAMBIÉN la clave de la serie (ver `hydrateShowWatched`). Sin
// eso, «serie vista» tenía dos representaciones locales que nadie reconciliaba
// —el conjunto de sus episodios y la clave suelta— y el resultado dependía de
// cuál estuviera poblada: el mismo título salía visto en una pantalla y no
// visto en otra.
function hydrateWatched(showId: string, seasons: Season[]) {
    const allIds: string[] = [];
    const watched: string[] = [];
    for (const season of seasons) {
        for (const ep of season.episodes) {
            const id = episodeKey(showId, season.n, ep.n);
            allIds.push(id);
            if (ep.watched >= 1) watched.push(id);
        }
    }
    WATCHED.sync(allIds, watched);
    // Con los episodios delante, «serie vista» ES «todos sus episodios
    // vistos»: se deriva de ahí en vez de fiarse de un agregado aparte. Una
    // serie sin episodios no dice nada al respecto, así que no se toca su
    // clave (borrarla sería inventarse que no está vista).
    if (allIds.length === 0) return;
    hydrateShowWatched([{ id: showId, watched: watched.length === allIds.length ? 1 : 0 }]);
}

/**
 * Alinea la clave de serie del store local con lo que dice el servidor.
 *
 * Es la MISMA idea que `movieKey` en movies.ts: una clave canónica por título
 * que se hidrata en cada listado. La necesitan las tarjetas de la Home y de la
 * biblioteca, que no tienen los episodios cargados y no pueden agregar nada.
 */
function hydrateShowWatched(shows: readonly { id: string; watched?: number }[]) {
    WATCHED.sync(
        shows.map((s) => s.id),
        shows.filter((s) => (s.watched ?? 0) >= 1).map((s) => s.id)
    );
}
