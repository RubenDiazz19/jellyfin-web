// Clase base para ViewModels de detalle de entidad (ShowViewModel, MovieViewModel).
// Comparte la gestión del signal de item, estado de carga, errores, gone,
// control de concurrencia con LoadGuard y suscripción a mutaciones del servidor.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal, type Signal } from '@preact/signals-core';
import type { ApiService } from '../../data/api/ApiService';
import { guardedLoad, type GuardedBody, type GuardedOnError } from './guardedLoad';
import { loadingError } from './loadingState';
import { LoadGuard } from './loadGuard';
import { mutationOnLoad } from './mutationSubscription';

export abstract class DetailViewModel<T extends { id: string }> {
    item: Signal<T | null> = signal<T | null>(null);
    loading: Signal<boolean>;
    error: Signal<string | null>;
    /**
     * Id de la entidad que se acaba de borrar. La ficha lo observa para irse.
     */
    gone = signal<string | null>(null);

    protected loads: LoadGuard;
    protected guarded: (body: GuardedBody, onError?: GuardedOnError) => Promise<void>;
    private ensureSubscribed: () => void;

    constructor(protected api: ApiService) {
        const state = loadingError(false);
        this.loading = state.loading;
        this.error = state.error;

        const gl = guardedLoad(this.loading, this.error);
        this.loads = gl.loads;
        this.guarded = gl.guarded;

        this.ensureSubscribed = mutationOnLoad(({ itemId, deleted }) => {
            const current = this.item.value;
            if (!current) return;
            if (itemId && !this.belongsToItem(current, itemId)) return;
            if (deleted && (itemId === current.id || !itemId)) {
                this.item.value = null;
                this.error.value = null;
                this.gone.value = current.id;
                return;
            }
            void this.load(current.id, true);
        });
    }

    /** Entidad cargada solo si coincide con la id solicitada. */
    itemFor(id: string): T | null {
        const it = this.item.value;
        return it && it.id === id ? it : null;
    }

    protected abstract fetchItem(id: string): Promise<T>;
    protected abstract belongsToItem(current: T, itemId: string): boolean;

    /** Datos de pre-visualización síncronos si existen (ej. PROTO_DATA). */
    protected getInitialProto?(id: string): T | undefined;

    /** Permite a la subclase decidir si reutiliza el caché en memoria sin re-fetch. */
    protected canReuseCached?(cached: T, id: string, force: boolean): boolean;

    async load(id: string, force = false): Promise<void> {
        this.subscribeToMutations();
        const cached = this.item.value;
        const proto = this.getInitialProto?.(id);

        if (cached && this.canReuseCached?.(cached, id, force)) {
            return;
        }

        if (cached?.id !== id) {
            this.error.value = null;
        }

        if (proto) {
            this.item.value = proto;
            this.loading.value = false;
            this.error.value = null;
        } else if (cached?.id !== id) {
            this.item.value = null;
            this.loading.value = true;
        }

        await this.guarded(async (isLatest) => {
            const result = await this.fetchItem(id);

            if (!isLatest()) return;
            this.gone.value = null;
            this.item.value = result;
            this.loading.value = false;
            this.error.value = null;
        }, (e) => {
            if (proto || (cached && cached.id === id)) return false;
            this.error.value = e.message;
        });
    }

    protected subscribeToMutations(): void {
        this.ensureSubscribed();
    }
}
