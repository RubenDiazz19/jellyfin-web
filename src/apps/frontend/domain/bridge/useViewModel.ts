// Bridge ViewModel ↔ React. Único lugar del frontend (junto con los
// providers) donde se permite usar hooks de React para consumir signals.
//
// Dos maneras de suscribirse desde una View:
//
//   1. `useViewModel(vm)` — suscribe TODOS los signals públicos del
//      ViewModel y re-renderiza el componente cuando cualquiera cambia.
//      Devuelve el propio ViewModel, así el render lee `vm.foo.value`
//      con tipado completo.
//
//   2. `useSignals()` (re-export de @preact/signals-react) — auto-detecta
//      los accesos a `.value` durante el render y suscribe solo esos.
//
// NOTA: getSnapshot de useSyncExternalStore debe devolver un valor cacheado
// (comparado con Object.is entre renders). Construir un objeto nuevo en cada
// llamada provoca un bucle infinito de re-renders, así que aquí se usa un
// contador de versión que solo avanza cuando algún signal notifica.

import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { Signal } from '@preact/signals-core';

function isSignal(value: unknown): value is Signal<unknown> {
    return !!value
        && typeof value === 'object'
        && typeof (value as Signal<unknown>).subscribe === 'function'
        && typeof (value as Signal<unknown>).peek === 'function';
}

/** Signals públicos (propiedades directas) de un ViewModel. */
function signalsOf(vm: object): Signal<unknown>[] {
    return Object.values(vm).filter(isSignal);
}

/**
 * Suscribe el componente a todos los signals del ViewModel.
 * El componente re-renderiza cuando cualquier signal cambia de valor.
 */
export function useViewModel<T extends object>(vm: T): T {
    const version = useRef(0);

    const subscribe = useCallback((onChange: () => void) => {
        // signal.subscribe() invoca el callback inmediatamente al suscribir
        // (semántica de effect); ese bump inicial solo causa un re-render
        // extra en el montaje y después queda estable.
        const unsubs = signalsOf(vm).map((s) =>
            s.subscribe(() => {
                version.current++;
                onChange();
            })
        );
        return () => unsubs.forEach((u) => { u(); });
    }, [vm]);

    useSyncExternalStore(subscribe, () => version.current, () => version.current);
    return vm;
}

/**
 * Suscribe el componente a un único signal y devuelve su valor actual.
 * Útil cuando la View solo depende de una propiedad del ViewModel.
 */
export function useSignalValue<T>(signal: Signal<T>): T {
    return useSyncExternalStore(
        useCallback((onChange: () => void) => signal.subscribe(onChange), [signal]),
        () => signal.value,
        () => signal.peek()
    );
}

// Alternativa: auto-tracking de accesos a `.value` en el render.
export { useSignals } from '@preact/signals-react/runtime';
