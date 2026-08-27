// ViewModel del detalle de película. Sirve a MoviePage.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { apiService } from '../../data/api/ApiService';
import { PROTO_DATA, type Movie } from '../../data/models';
import { DetailViewModel } from './DetailViewModel';

export class MovieViewModel extends DetailViewModel<Movie> {
    movie = this.item;

    movieFor(id: string): Movie | null {
        return this.itemFor(id);
    }

    protected fetchItem(id: string): Promise<Movie> {
        return this.api.catalog.getMovie(id);
    }

    protected belongsToItem(current: Movie, itemId: string): boolean {
        return itemId === current.id;
    }

    protected override canReuseCached(cached: Movie, id: string, force: boolean): boolean {
        return !force && cached.id === id && !this.error.value && !PROTO_DATA.movies[id];
    }

    protected getInitialProto(id: string): Movie | undefined {
        return PROTO_DATA.movies[id];
    }
}

export const movieVM = new MovieViewModel(apiService);

