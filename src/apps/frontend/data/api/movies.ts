import type { Movie, MovieSaga } from '../models';
import { loadSession } from '../session/session';
import { movieKey } from '../stores/itemKeys';
import { WATCHED } from '../stores/watchedStore';
import { isDeleted, itemGoneError } from './deleted';
import { apiFetch, fetchUserItems, noSessionError } from './http';
import {
    extractMediaBadges,
    mapCommonFields,
    summarizeAudio,
    summarizeSubtitles,
    summarizeVideo,
    watchedFraction
} from './itemMapping';
import { cachedList } from './listCache';
import { emitListsRefreshed } from './mutations';
import { settlePlaybackReports } from './playback';
import { FIELDS_DETAIL, FIELDS_GRID, GRID_IMAGE_TYPES, type JFItem } from './types';

// Exportado para las consultas de `discover`: ver la nota en shows.ts.
export function mapMovie(item: JFItem): Movie {
    const directors = Array.from(
        new Set(
            (item.People ?? [])
                .filter((p) => p.Type === 'Director')
                .map((p) => p.Name)
                .filter(Boolean)
        )
    ).join(', ');

    const source = item.MediaSources?.[0];
    const streams = source?.MediaStreams ?? [];

    return {
        ...mapCommonFields(item),
        director: directors,
        watched: watchedFraction(item),
        remaining: '',
        mediaBadges: extractMediaBadges(streams),
        video: summarizeVideo(streams),
        audio: summarizeAudio(streams),
        subtitles: summarizeSubtitles(streams),
        container: source?.Container ?? item.Container
    };
}

/** Todas las películas de la biblioteca. Cacheada; ver `getShows`. */
export function getMovies(): Promise<Movie[]> {
    return cachedList('movies', fetchMovies, emitListsRefreshed);
}

async function fetchMovies(): Promise<Movie[]> {
    await settlePlaybackReports();
    const items = await fetchUserItems<JFItem>(
        'IncludeItemTypes=Movie&Recursive=true&SortBy=SortName'
        + `&Fields=${FIELDS_GRID}&EnableImageTypes=${GRID_IMAGE_TYPES}`
    );
    const movies = items.map(mapMovie);
    // Hidrata el store local de "visto" con la verdad del server.
    WATCHED.sync(
        movies.map((m) => movieKey(m.id)),
        movies.filter((m) => (m.watched ?? 0) >= 1).map((m) => movieKey(m.id))
    );
    return movies;
}

export async function getMovie(id: string): Promise<Movie> {
    // Se acaba de borrar: pedirla sería un 404 con el que nadie puede hacer
    // nada útil. Ver deleted.ts.
    if (isDeleted(id)) throw itemGoneError();
    await settlePlaybackReports();
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const item = await apiFetch<JFItem>(
        `/Users/${session.userId}/Items/${id}?Fields=${FIELDS_DETAIL}`
    );
    const movie = mapMovie(item);
    // Sincroniza el store local con lo que dice el server.
    WATCHED.sync([movieKey(movie.id)], (movie.watched ?? 0) >= 1 ? [movieKey(movie.id)] : []);
    return movie;
}

/** Obtiene la saga / colección a la que pertenece una película y sus títulos ordenados cronológicamente. */
export async function getMovieSaga(movieId: string): Promise<MovieSaga | null> {
    const session = loadSession();
    if (!session?.userId) return null;
    try {
        const ancestors = await apiFetch<Array<{ Id: string; Name: string; Type?: string }>>(
            `/Items/${movieId}/Ancestors?userId=${session.userId}`
        );
        const boxSet = (ancestors ?? []).find((a) => a.Type === 'BoxSet');
        if (!boxSet?.Id) return null;

        const items = await fetchUserItems<JFItem>(
            `ParentId=${boxSet.Id}&SortBy=PremiereDate,ProductionYear,SortName&SortOrder=Ascending`
            + `&Fields=${FIELDS_GRID}&EnableImageTypes=${GRID_IMAGE_TYPES}`
        );
        const movies = items.map(mapMovie);
        if (movies.length === 0) return null;

        return {
            id: boxSet.Id,
            name: boxSet.Name,
            items: movies
        };
    } catch {
        return null;
    }
}
