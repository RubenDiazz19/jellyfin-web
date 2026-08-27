// ViewModel del detalle de serie. Sirve a ShowPage, SeasonPage y EpisodePage
// (las tres consumen el mismo Show completo con temporadas y episodios).
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { apiService } from '../../data/api/ApiService';
import type { Show } from '../../data/models';
import { DetailViewModel } from './DetailViewModel';

export class ShowViewModel extends DetailViewModel<Show> {
    show = this.item;

    /** Show cargado solo si coincide con la id pedida (evita datos rancios). */
    showFor(id: string): Show | null {
        return this.itemFor(id);
    }

    protected fetchItem(id: string): Promise<Show> {
        return this.api.catalog.getShow(id);
    }

    protected belongsToItem(current: Show, itemId: string): boolean {
        return belongsToShow(current, itemId);
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

