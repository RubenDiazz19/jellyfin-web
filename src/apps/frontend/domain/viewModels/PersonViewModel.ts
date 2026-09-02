// ViewModel de la pantalla de Persona (ficha de actor, director, etc.).
// Combina la filmografía local en la biblioteca y los metadatos reales
// (biografía, fechas, edad, país y enlaces externos).
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import type { PersonMetadata } from '../../data/api/person';
import { CatalogViewModel } from './CatalogViewModel';

export type { PersonMetadata };

export class PersonViewModel extends CatalogViewModel {
    name = signal<string | null>(null);
    details = signal<PersonMetadata | null>(null);

    constructor(private api: ApiService) {
        super({ loadsOnMount: true });
    }

    async load(name: string): Promise<void> {
        if (this.name.peek() !== name) {
            this.name.value = name;
            this.shows.value = [];
            this.movies.value = [];
            this.details.value = null;
        }

        await this.guarded(
            async (isLatest) => {
                this.loading.value = true;
                this.error.value = null;

                // Pedimos en paralelo el catálogo de la biblioteca y los metadatos reales
                const catalogPromise = this.api.discover.getByPerson(name);
                const metadataPromise = this.api.person.getPersonMetadata(name);

                const [slice, meta] = await Promise.all([catalogPromise, metadataPromise]);
                if (!isLatest()) return;

                this.shows.value = slice.shows;
                this.movies.value = slice.movies;
                this.details.value = meta;
            },
            () => {
                this.shows.value = [];
                this.movies.value = [];
                this.details.value = null;
            }
        );
    }
}

export const personVM = new PersonViewModel(apiService);
