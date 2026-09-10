// Clase base para ViewModels con estado de carga, control de errores y LoadGuard.
// Unifica el patrón repetido entre CatalogViewModel y DetailViewModel.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { type Signal } from '@preact/signals-core';
import { guardedLoad, type GuardedBody, type GuardedOnError } from './guardedLoad';
import { loadingError } from './loadingState';
import { LoadGuard } from './loadGuard';

export abstract class LoadableViewModel {
    loading: Signal<boolean>;
    error: Signal<string | null>;

    protected loads: LoadGuard;
    protected guarded: (body: GuardedBody, onError?: GuardedOnError) => Promise<void>;

    constructor({ loadsOnMount = false } = {}) {
        const state = loadingError(loadsOnMount);
        this.loading = state.loading;
        this.error = state.error;

        const gl = guardedLoad(this.loading, this.error);
        this.loads = gl.loads;
        this.guarded = gl.guarded;
    }
}
