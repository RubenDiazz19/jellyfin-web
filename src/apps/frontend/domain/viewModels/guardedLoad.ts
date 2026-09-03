// Encapsulación del ciclo de vida de carga protegida por LoadGuard.
// Regla MVVM: este módulo no importa React ni nada de presentation/.

import type { Signal } from '@preact/signals-core';
import { LoadGuard } from './loadGuard';

export type GuardedBody = (isLatest: () => boolean) => Promise<void>;
export type GuardedOnError = (error: Error) => boolean | void;

export type GuardedLoadResult = {
    loads: LoadGuard;
    guarded: (body: GuardedBody, onError?: GuardedOnError) => Promise<void>;
};

/**
 * Encapsula el patrón begin / try / catch / isLatest / finally
 * vinculando la ejecución con una instancia de LoadGuard y
 * sincronizando el final de carga con la señal `loading`.
 */
export function guardedLoad(
    loading: Signal<boolean>,
    error?: Signal<string | null>,
    loads = new LoadGuard()
): GuardedLoadResult {
    const guarded = async (
        body: GuardedBody,
        onError?: GuardedOnError
    ): Promise<void> => {
        const isLatest = loads.begin();
        try {
            await body(isLatest);
        } catch (e) {
            if (!isLatest()) return;
            const err = e as Error;
            if (error && onError?.(err) !== false) {
                error.value = err.message;
            }
        } finally {
            if (isLatest()) {
                loading.value = false;
            }
        }
    };

    return { loads, guarded };
}
