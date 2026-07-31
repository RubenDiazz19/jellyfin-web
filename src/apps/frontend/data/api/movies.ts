import { autoTagsFor } from '../autotag';
import type { Movie } from '../models';
import { loadSession } from '../session/session';
import { WATCHED } from '../stores/watchedStore';
import { apiFetch, noSessionError } from './http';
import {
    backdropUrls, logoUrl, mapCast, posterUrl, ratingOf, runtimeLabel, watchedFraction
} from './itemMapping';
import { settlePlaybackReports } from './playback';
import { FIELDS_DETAIL, FIELDS_LIST, type JFItem } from './types';

function mapMovie(item: JFItem): Movie {
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
        director: (item.People ?? []).find((p) => p.Type === 'Director')?.Name ?? '',
        studio: item.Studios?.[0]?.Name ?? '',
        country: '',
        premiere: item.PremiereDate ?? '',
        cast: mapCast(item),
        synopsis: item.Overview ?? '',
        watched: watchedFraction(item),
        remaining: '',
        backdrop: backdrops[0] ?? '',
        backdrops,
        poster: posterUrl(item.Id, item.ImageTags?.Primary),
        logo: logoUrl(item.Id, item.ImageTags?.Logo)
    };
}

export async function getMovies(): Promise<Movie[]> {
    await settlePlaybackReports();
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const data = await apiFetch<{ Items: JFItem[] }>(
        `/Users/${session.userId}/Items?IncludeItemTypes=Movie&Recursive=true&SortBy=SortName&Fields=${FIELDS_LIST}`
    );
    const movies = (data.Items ?? []).map(mapMovie);
    // Hidrata el store local de "visto" con la verdad del server.
    WATCHED.sync(
        movies.map((m) => `movie-${m.id}`),
        movies.filter((m) => (m.watched ?? 0) >= 1).map((m) => `movie-${m.id}`)
    );
    return movies;
}

export async function getMovie(id: string): Promise<Movie> {
    await settlePlaybackReports();
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const item = await apiFetch<JFItem>(
        `/Users/${session.userId}/Items/${id}?Fields=${FIELDS_DETAIL}`
    );
    const movie = mapMovie(item);
    // Sincroniza el store local con lo que dice el server.
    WATCHED.sync([`movie-${movie.id}`], (movie.watched ?? 0) >= 1 ? [`movie-${movie.id}`] : []);
    return movie;
}
