import type { Movie } from '../models';
import { loadSession } from '../session/session';
import { movieKey } from '../stores/itemKeys';
import { WATCHED } from '../stores/watchedStore';
import { isDeleted, itemGoneError } from './deleted';
import { apiFetch, fetchUserItems, noSessionError } from './http';
import { mapCommonFields, watchedFraction } from './itemMapping';
import { settlePlaybackReports } from './playback';
import { FIELDS_DETAIL, FIELDS_LIST, type JFItem } from './types';

// Exportado para las consultas de `discover`: ver la nota en shows.ts.
export function mapMovie(item: JFItem): Movie {
    return {
        ...mapCommonFields(item),
        director: (item.People ?? []).find((p) => p.Type === 'Director')?.Name ?? '',
        watched: watchedFraction(item),
        remaining: ''
    };
}

export async function getMovies(): Promise<Movie[]> {
    await settlePlaybackReports();
    const items = await fetchUserItems<JFItem>(
        `IncludeItemTypes=Movie&Recursive=true&SortBy=SortName&Fields=${FIELDS_LIST}`
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
