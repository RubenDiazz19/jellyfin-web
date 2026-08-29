import { signal } from '@preact/signals-core';
import { apiService } from '../../data/api/ApiService';
import { PROTO_DATA, type Movie, type MovieSaga } from '../../data/models';
import { DetailViewModel } from './DetailViewModel';

export class MovieViewModel extends DetailViewModel<Movie> {
    movie = this.item;
    saga = signal<MovieSaga | null>(null);

    movieFor(id: string): Movie | null {
        return this.itemFor(id);
    }

    override async load(id: string, force = false): Promise<void> {
        const cached = this.item.value;
        if (cached?.id !== id) {
            this.saga.value = null;
        }
        await super.load(id, force);
        if (this.item.value?.id === id) {
            void this.loadSaga(id);
        }
    }

    private async loadSaga(id: string): Promise<void> {
        try {
            const sagaData = await this.api.catalog.getMovieSaga(id);
            if (this.item.value?.id === id) {
                this.saga.value = sagaData;
            }
        } catch {
            if (this.item.value?.id === id) {
                this.saga.value = null;
            }
        }
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

