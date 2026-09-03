// Par de señales reactivas loading/error común a los ViewModels.
// Regla MVVM: esta función no importa React ni nada de presentation/.

import { signal, type Signal } from '@preact/signals-core';

export type LoadingErrorState = {
    loading: Signal<boolean>;
    error: Signal<string | null>;
};

/**
 * Devuelve un par reactivo { loading, error } para inicializar estado en ViewModels.
 */
export function loadingError(initialLoading = false): LoadingErrorState {
    return {
        loading: signal(initialLoading),
        error: signal<string | null>(null)
    };
}
