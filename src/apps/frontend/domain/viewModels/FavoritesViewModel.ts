// ViewModel de la pantalla de Favoritos. El store local (FAVS) guarda claves
// compuestas (ver itemKeys) que son un espejo de lo marcado en el servidor;
// aquí se refresca ese espejo, se desambiguan las claves y se hidratan contra
// el catálogo real.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import { FAVS } from '../../data/stores/favsStore';
import { episodeKey, movieKey, parseItemKey, seasonKey } from '../../data/stores/itemKeys';
import type { Episode, Movie, Season, Show } from '../../data/models';
import { CatalogViewModel } from './CatalogViewModel';

export type FavSeason = { show: Show; season: Season };
export type FavEpisode = { show: Show; season: Season; episode: Episode };

export class FavoritesViewModel extends CatalogViewModel {
    seasons = signal<FavSeason[]>([]);
    episodes = signal<FavEpisode[]>([]);

    constructor(private api: ApiService) {
        // Esta pantalla siempre carga al montar.
        super({ loadsOnMount: true });
    }

    async load() {
        await this.guarded(async (isLatest) => this.fetchAll(isLatest));
    }

    private async fetchAll(isLatest: () => boolean) {
        this.loading.value = true;
        this.error.value = null;

        // Esta pantalla es la que más se nota si el espejo local va desfasado:
        // se abre justamente para ver «todo lo que he marcado». Si el servidor
        // no contesta seguimos con lo que hubiera en local en vez de no
        // enseñar nada.
        await this.api.items.hydrateFavorites().catch(() => {});
        if (!isLatest()) return;

        const ids = FAVS.all();
        const movieIds: string[] = [];
        const showIds = new Set<string>();
        const seasonRefs: { showId: string; seasonN: number }[] = [];
        const episodeRefs: { showId: string; seasonN: number; epN: number }[] = [];

        for (const id of ids) {
            const ref = parseItemKey(id);
            switch (ref.kind) {
                case 'movie':
                    movieIds.push(ref.movieId);
                    break;
                case 'episode':
                    episodeRefs.push(ref);
                    showIds.add(ref.showId);
                    break;
                case 'season':
                    seasonRefs.push(ref);
                    showIds.add(ref.showId);
                    break;
                default:
                    showIds.add(ref.showId);
            }
        }

        {
            const [movieResults, showResults] = await Promise.all([
                Promise.allSettled(movieIds.map((id) => this.api.catalog.getMovie(id))),
                Promise.allSettled([...showIds].map((id) => this.api.catalog.getShow(id)))
            ]);
            if (!isLatest()) return;

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
        }
    }

    /** Quita en caliente lo que se haya desfavoriteado sin recargar del server. */
    syncWithStore() {
        this.movies.value = this.movies.value.filter((m) => FAVS.has(movieKey(m.id)));
        this.shows.value = this.shows.value.filter((s) => FAVS.has(s.id));
        this.seasons.value = this.seasons.value.filter(
            ({ show, season }) => FAVS.has(seasonKey(show.id, season.n))
        );
        this.episodes.value = this.episodes.value.filter(
            ({ show, season, episode }) => FAVS.has(episodeKey(show.id, season.n, episode.n))
        );
    }
}

export const favoritesVM = new FavoritesViewModel(apiService);
