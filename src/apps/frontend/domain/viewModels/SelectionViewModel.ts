// Selección múltiple sobre una rejilla de items, con acciones en lote.
// Regla MVVM: esta clase no importa React ni nada de presentation/.
//
// Guarda los items enteros (no solo ids) porque las acciones los necesitan:
// encolar quiere título y póster, y marcar como visto quiere la clave del
// store local, que no es el id del servidor.

import { computed, signal } from '@preact/signals-core';
import { apiService, type ApiService } from '../../data/api/ApiService';
import { movieKey } from '../../data/stores/itemKeys';
import { QUEUE } from '../../data/stores/queueStore';
import { WATCHED } from '../../data/stores/watchedStore';

/** Lo mínimo que la selección necesita saber de un item. */
export type SelectableItem = {
    id: string;
    title: string;
    kind: 'show' | 'movie';
    poster?: string;
    year?: number;
};

/**
 * Clave del item en el store local de «visto».
 *
 * Las películas van prefijadas y las series no: es la convención que ya usan
 * las tarjetas y los botones, y cambiarla aquí desincronizaría el estado que
 * ve el usuario al instante del que se guarda.
 */
export function watchedKey(item: SelectableItem): string {
    return item.kind === 'movie' ? movieKey(item.id) : item.id;
}

export class SelectionViewModel {
    /** Modo selección activo: las tarjetas pasan a alternar en vez de navegar. */
    selecting = signal(false);
    selected = signal<SelectableItem[]>([]);
    /** Una acción en lote en curso; la barra se deshabilita mientras tanto. */
    busy = signal(false);

    count = computed(() => this.selected.value.length);
    empty = computed(() => this.selected.value.length === 0);

    constructor(private api: ApiService) {}

    has(id: string): boolean {
        return this.selected.value.some((i) => i.id === id);
    }

    toggle(item: SelectableItem) {
        const current = this.selected.value;
        this.selected.value = current.some((i) => i.id === item.id) ?
            current.filter((i) => i.id !== item.id) :
            [...current, item];
    }

    /** Entra en modo selección. Opcionalmente con un primer item ya marcado. */
    start(item?: SelectableItem) {
        this.selecting.value = true;
        this.selected.value = item ? [item] : [];
    }

    selectAll(items: SelectableItem[]) {
        this.selected.value = [...items];
    }

    clear() {
        this.selected.value = [];
    }

    /** Sale del modo selección y olvida lo marcado. */
    stop() {
        this.selecting.value = false;
        this.selected.value = [];
    }

    /**
     * Marca (o desmarca) todo lo seleccionado.
     *
     * El store local se actualiza primero para que la rejilla responda al
     * instante, y se revierte entero si el servidor falla — igual que hacen
     * los botones de «visto» de una tarjeta suelta.
     */
    async markWatched(watched: boolean): Promise<void> {
        const items = this.selected.value;
        if (items.length === 0) return;
        const keys = items.map(watchedKey);
        this.busy.value = true;
        WATCHED.setMany(keys, watched);
        try {
            // En serie, no en paralelo: son N peticiones de escritura contra
            // un servidor doméstico.
            for (const item of items) {
                await this.api.items.markPlayed(item.id, watched);
            }
        } catch (e) {
            WATCHED.setMany(keys, !watched);
            throw e;
        } finally {
            this.busy.value = false;
        }
    }

    /** Encola todo lo seleccionado, en el orden en que se marcó. */
    enqueue(): number {
        const items = this.selected.value;
        for (const item of items) {
            QUEUE.enqueue({
                itemId: item.id,
                title: item.title,
                subtitle: item.year ? String(item.year) : undefined,
                poster: item.poster
            });
        }
        return items.length;
    }

    /** Añade etiquetas a todo lo seleccionado, sin quitar las que ya tuvieran. */
    async addTags(tags: string[]): Promise<number> {
        const items = this.selected.value;
        if (items.length === 0 || tags.length === 0) return 0;
        this.busy.value = true;
        try {
            await this.api.metadata.setItemsTags(items.map((i) => i.id), tags);
            return items.length;
        } finally {
            this.busy.value = false;
        }
    }
}

export const selectionVM = new SelectionViewModel(apiService);
