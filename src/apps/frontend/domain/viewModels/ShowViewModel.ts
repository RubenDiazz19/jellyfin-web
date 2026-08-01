// ViewModel del detalle de serie. Sirve a ShowPage, SeasonPage y EpisodePage
// (las tres consumen el mismo Show completo con temporadas y episodios).
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import type { Show } from '../../data/models';
import { ItemMutationSubscription } from './itemMutations';
import { LoadGuard } from './loadGuard';

export class ShowViewModel {
    show = signal<Show | null>(null);
    loading = signal(false);
    error = signal<string | null>(null);

    private loads = new LoadGuard();
    private mutations = new ItemMutationSubscription();

    constructor(private api: ApiService) {}

    async load(id: string) {
        this.subscribeToMutations();
        const isLatest = this.loads.begin();
        // Si ya tenemos datos para esta id, no mostramos loading (optimistic):
        // la UI ve los datos anteriores hasta que llegue el refresh.
        if (this.show.value?.id !== id) {
            this.show.value = null;
            this.error.value = null;
            this.loading.value = true;
        }
        try {
            const show = await this.api.catalog.getShow(id);
            if (!isLatest()) return;
            this.show.value = show;
            this.error.value = null;
        } catch (e) {
            if (!isLatest()) return;
            if (this.show.value?.id === id) return; // no sobreescribir datos previos con error
            this.error.value = (e as Error).message;
        } finally {
            if (isLatest()) this.loading.value = false;
        }
    }

    /** Show cargado solo si coincide con la id pedida (evita datos rancios). */
    showFor(id: string): Show | null {
        const s = this.show.value;
        return s && s.id === id ? s : null;
    }

    // Refresca la serie actual si alguien mutó ese mismo item (edición de
    // imagen, metadatos, played, favorito). Las mutaciones ya limpian el
    // showCache, así que el getShow siguiente pega al servidor.
    //
    // La mutación puede venir con el id de una temporada o de un episodio —
    // p. ej. al cambiar la carátula de una temporada — y ese contenido vive
    // dentro del Show que tenemos cargado. Si solo se comparase con el id de
    // la serie, esos cambios no se verían hasta recargar la página.
    private subscribeToMutations() {
        this.mutations.ensure((itemId) => {
            const current = this.show.value;
            if (!current) return;
            if (itemId && !belongsToShow(current, itemId)) return;
            void this.load(current.id);
        });
    }
}

/** ¿El item mutado es la serie, una de sus temporadas o uno de sus episodios? */
function belongsToShow(show: Show, itemId: string): boolean {
    if (itemId === show.id) return true;
    return show.seasons.some((season) =>
        season.jfId === itemId || season.episodes.some((ep) => ep.jfId === itemId)
    );
}

export const showVM = new ShowViewModel(apiService);
