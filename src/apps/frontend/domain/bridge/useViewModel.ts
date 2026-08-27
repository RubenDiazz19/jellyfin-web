// Bridge ViewModel ↔ React. Único lugar del frontend (junto con los
// providers) donde se permite usar hooks de React para consumir signals.
//
// Tres maneras de suscribirse desde una View, de menos a más fina:
//
//   1. `useViewModel(vm)` — suscribe TODOS los signals públicos del
//      ViewModel y re-renderiza el componente cuando cualquiera cambia.
//      Devuelve el propio ViewModel, así el render lee `vm.foo.value`
//      con tipado completo. Solo para Views que de verdad dependen de casi
//      todo: si el VM tiene un signal que cambia a menudo (currentTime del
//      reproductor, ~4 Hz), esto repinta la vista entera a esa frecuencia.
//
//   2. `useVmSignals(vm, pick)` — igual pero solo a los signals elegidos.
//
//   3. `useSignalValue(signal)` — un único signal, devuelve su valor.
//   4. `useSignalSelector(signal, pick)` — un único signal del que solo
//      interesa una parte: re-renderiza únicamente si esa parte cambia.
//
// NOTA: getSnapshot de useSyncExternalStore debe devolver un valor cacheado
// (comparado con Object.is entre renders). Construir un objeto nuevo en cada
// llamada provoca un bucle infinito de re-renders, así que aquí se usa un
// contador de versión que solo avanza cuando algún signal notifica.

import {
    useCallback, useEffect, useRef, useSyncExternalStore, type DependencyList
} from 'react';
import type { ReadonlySignal, Signal } from '@preact/signals-core';

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
 * Suscripción selectiva: solo a los signals que la View realmente lee. Evita
 * re-renders por signals ajenos (p.ej. el hero de la Home no debe re-pintarse
 * cuando termina de cargar la biblioteca). `pick` debe devolver siempre la
 * misma lista para un call-site dado.
 */
export function useVmSignals<T extends object>(
    vm: T,
    pick: (vm: T) => Signal<unknown>[]
): T {
    const version = useRef(0);
    const subscribe = useCallback((onChange: () => void) => {
        // signal.subscribe() invoca el callback inmediatamente al suscribir
        // (semántica de effect); ese bump inicial solo causa un re-render
        // extra en el montaje y después queda estable.
        const unsubs = pick(vm).map((s) =>
            s.subscribe(() => {
                version.current++;
                onChange();
            })
        );
        return () => unsubs.forEach((u) => { u(); });
    // `pick` es una arrow inline distinta por render pero elige los mismos
    // signals; incluirla en deps re-suscribiría en cada render sin ganar nada.
    }, [vm]);

    useSyncExternalStore(subscribe, () => version.current, () => version.current);
    return vm;
}

/**
 * Suscribe el componente a todos los signals del ViewModel.
 * El componente re-renderiza cuando cualquier signal cambia de valor.
 */
export function useViewModel<T extends object>(vm: T): T {
    return useVmSignals(vm, signalsOf);
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

/**
 * Suscribe a un signal pero re-renderiza solo si la parte elegida cambia.
 *
 * El caso que lo justifica: una rejilla de N tarjetas sobre un signal de tipo
 * lista. Suscribirse a la lista entera repinta las N tarjetas cada vez que la
 * lista se reemplaza; con un `pick` que devuelve un escalar, `useSyncExternal
 * Store` compara con `Object.is` y solo repinta la tarjeta cuyo valor cambió.
 *
 * `pick` debe ser puro y derivar SOLO de `signal`: React lo llama en cada
 * render y en cada notificación, y espera el mismo resultado mientras el
 * signal no cambie.
 */
export function useSignalSelector<T, S>(
    signal: ReadonlySignal<T> | Signal<T>,
    pick: (value: T) => S
): S {
    const subscribe = useCallback(
        (onChange: () => void) => signal.subscribe(onChange),
        [signal]
    );
    // `peek()` y no `.value`: fuera de un efecto reactivo leer `.value` solo
    // añadiría al signal a un scope de tracking que aquí no existe.
    const snapshot = () => pick(signal.peek());
    return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Suscribe el componente a los signals del ViewModel y ejecuta una función de carga
 * dentro de un `useEffect` cuando cambian sus dependencias.
 */
export function useViewModelLoad<T extends object>(
    vm: T,
    loadFn: (vm: T) => void | Promise<void>,
    deps: DependencyList = []
): T {
    useViewModel(vm);
    useEffect(() => {
        void loadFn(vm);
    }, deps);
    return vm;
}
