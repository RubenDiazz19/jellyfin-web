// ViewModel de la pantalla de Favoritos. Los favoritos se guardan solo en
// localStorage (FAVS) como ids compuestos — "movie-<id>" para películas,
// "<showId>-s<n>-e<m>" para episodios, "<showId>-s<n>" para temporadas y el
// id crudo del show para series. Aquí los desambiguamos e hidratamos contra
// el catálogo real.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import { FAVS } from '../../data/stores/favsStore';
import type { Episode, Movie, Season, Show } from '../../data/models';

export type FavSeason = { show: Show; season: Season };
export type FavEpisode = { show: Show; season: Season; episode: Episode };

const MOVIE_PREFIX = 'movie-';
// El id de un show es un GUID hex — nunca puede contener una 's' literal —
// así que este sufijo desambigua sin ambigüedad con el propio id.
const EPISODE_RE = /^(.+)-s(\d+)-e(\d+)$/;
const SEASON_RE = /^(.+)-s(\d+)$/;

export class FavoritesViewModel {
    shows = signal<Show[]>([]);
    movies = signal<Movie[]>([]);
    seasons = signal<FavSeason[]>([]);
    episodes = signal<FavEpisode[]>([]);
    // Arranca en true (a diferencia de otros ViewModels sin fallback proto):
    // esta pantalla siempre carga al montar, así que empezar en false
    // pintaría el estado vacío un frame antes de que el useEffect dispare load().
    loading = signal(true);
    error = signal<string | null>(null);

    private seq = 0;

    constructor(private api: ApiService) {}

    async load() {
        const seq = ++this.seq;
        this.loading.value = true;
        this.error.value = null;

        const ids = FAVS.all();
        const movieIds: string[] = [];
        const showIds = new Set<string>();
        const seasonRefs: { showId: string; seasonN: number }[] = [];
        const episodeRefs: { showId: string; seasonN: number; epN: number }[] = [];

        for (const id of ids) {
            const epMatch = EPISODE_RE.exec(id);
            const seasonMatch = !epMatch && SEASON_RE.exec(id);
            if (id.startsWith(MOVIE_PREFIX)) {
                movieIds.push(id.slice(MOVIE_PREFIX.length));
            } else if (epMatch) {
                const [, showId, seasonN, epN] = epMatch;
                episodeRefs.push({ showId, seasonN: Number(seasonN), epN: Number(epN) });
                showIds.add(showId);
            } else if (seasonMatch) {
                const [, showId, seasonN] = seasonMatch;
                seasonRefs.push({ showId, seasonN: Number(seasonN) });
                showIds.add(showId);
            } else {
                showIds.add(id);
            }
        }

        try {
            const [movieResults, showResults] = await Promise.all([
                Promise.allSettled(movieIds.map((id) => this.api.catalog.getMovie(id))),
                Promise.allSettled([...showIds].map((id) => this.api.catalog.getShow(id)))
            ]);
            if (seq !== this.seq) return;

            const okShows = showResults
                .filter((r): r is PromiseFulfilledResult<Show> => r.status === 'fulfilled')
                .map((r) => r.value);
            const showById = new Map(okShows.map((s) => [s.id, s]));

            this.movies.value = movieResults
                .filter((r): r is PromiseFulfilledResult<Movie> => r.status === 'fulfilled')
                .map((r) => r.value);

            // Solo shows favoriteados directamente, no los que solo aparecen
            // como padres de una temporada/episodio favorito.
            this.shows.value = okShows.filter((s) => ids.includes(s.id));

            const seasons: FavSeason[] = [];
            for (const ref of seasonRefs) {
                const show = showById.get(ref.showId);
                const season = show?.seasons.find((s) => s.n === ref.seasonN);
                if (show && season) seasons.push({ show, season });
            }
            this.seasons.value = seasons;

            const episodes: FavEpisode[] = [];
            for (const ref of episodeRefs) {
                const show = showById.get(ref.showId);
                const season = show?.seasons.find((s) => s.n === ref.seasonN);
                const episode = season?.episodes.find((e) => e.n === ref.epN);
                if (show && season && episode) episodes.push({ show, season, episode });
            }
            this.episodes.value = episodes;
        } catch (e) {
            if (seq !== this.seq) return;
            this.error.value = (e as Error).message;
        } finally {
            if (seq === this.seq) this.loading.value = false;
        }
    }

    /** Quita en caliente lo que se haya desfavoriteado sin recargar del server. */
    syncWithStore() {
        this.movies.value = this.movies.value.filter((m) => FAVS.has(`${MOVIE_PREFIX}${m.id}`));
        this.shows.value = this.shows.value.filter((s) => FAVS.has(s.id));
        this.seasons.value = this.seasons.value.filter(
            ({ show, season }) => FAVS.has(`${show.id}-s${season.n}`)
        );
        this.episodes.value = this.episodes.value.filter(
            ({ show, season, episode }) => FAVS.has(`${show.id}-s${season.n}-e${episode.n}`)
        );
    }
}

export const favoritesVM = new FavoritesViewModel(apiService);
