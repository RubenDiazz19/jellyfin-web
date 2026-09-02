// ViewModel de las pantallas que enseñan un recorte del catálogo bajo un
// sujeto: el género, la persona y el título del que colgar los «más como
// esto». Las tres cargan lo mismo —series y películas de una consulta— y solo
// cambian en qué le piden al servidor, así que comparten clase y se instancian
// una vez por sitio: cada instancia lleva su propio estado y su propia carrera.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import type { CatalogSlice } from '../../data/api/discover';
import { getGenreVariants } from '../genres';
import { CatalogViewModel } from './CatalogViewModel';

/** Qué se le pide al servidor para un sujeto dado. */
type CatalogQuery = (api: ApiService, subject: string) => Promise<CatalogSlice>;

export class DiscoverViewModel extends CatalogViewModel {
    /** El último sujeto cargado: el género, el nombre o el id de la ficha. */
    subject = signal<string | null>(null);

    constructor(private api: ApiService, private query: CatalogQuery) {
        // Estas pantallas siempre cargan al montar.
        super({ loadsOnMount: true });
    }

    async load(subject: string) {
        // Al cambiar de sujeto se vacía antes de pedir: si no, durante la
        // carga se vería la filmografía del actor anterior bajo el nombre
        // nuevo, que parece un dato y no una espera.
        if (this.subject.peek() !== subject) {
            this.subject.value = subject;
            this.shows.value = [];
            this.movies.value = [];
        }

        await this.guarded(
            async (isLatest) => {
                this.loading.value = true;
                this.error.value = null;
                const slice = await this.query(this.api, subject);
                if (!isLatest()) return;
                this.shows.value = slice.shows;
                this.movies.value = slice.movies;
            },
            () => {
                // Con un fallo no se deja a medias lo del sujeto anterior.
                this.shows.value = [];
                this.movies.value = [];
            }
        );
    }
}

export const genreVM = new DiscoverViewModel(apiService, (api, genre) =>
    api.discover.getByGenre(genre, getGenreVariants(genre)));

export { personVM } from './PersonViewModel';

export const similarVM = new DiscoverViewModel(apiService, (api, itemId) =>
    api.discover.getSimilar(itemId));

