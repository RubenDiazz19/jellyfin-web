// ViewModel del detalle de serie. Sirve a ShowPage, SeasonPage y EpisodePage
// (las tres consumen el mismo Show completo con temporadas y episodios).
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import type { Show } from '../../data/models';

export class ShowViewModel {
    show = signal<Show | null>(null);
    loading = signal(false);
    error = signal<string | null>(null);

    private seq = 0;

    constructor(private api: ApiService) {}

    async load(id: string) {
        const seq = ++this.seq;
        // Si ya tenemos datos para esta id, no mostramos loading (optimistic):
        // la UI ve los datos anteriores hasta que llegue el refresh.
        if (this.show.value?.id !== id) {
            this.show.value = null;
            this.error.value = null;
            this.loading.value = true;
        }
        try {
            const show = await this.api.catalog.getShow(id);
            if (seq !== this.seq) return;
            this.show.value = show;
            this.error.value = null;
        } catch (e) {
            if (seq !== this.seq) return;
            if (this.show.value?.id === id) return; // no sobreescribir datos previos con error
            this.error.value = (e as Error).message;
        } finally {
            if (seq === this.seq) this.loading.value = false;
        }
    }

    /** Show cargado solo si coincide con la id pedida (evita datos rancios). */
    showFor(id: string): Show | null {
        const s = this.show.value;
        return s && s.id === id ? s : null;
    }
}

export const showVM = new ShowViewModel(apiService);
