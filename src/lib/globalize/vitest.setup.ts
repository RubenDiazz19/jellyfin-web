import { loadCoreDictionary } from './loader';

/**
 * Loads the core translation dictionary before any test runs.
 *
 * Components call `globalize.translate('Key')` at render time. Without a
 * dictionary those calls return the raw key and log noise, so every test that
 * asserts on visible copy would need to know about translation internals.
 * jsdom reports `en-US`, so tests see the en-us strings.
 */
await loadCoreDictionary();

// jsdom implementa AbortController pero no fetch: Vitest deja el Request de
// Node (undici) como global, y undici exige que `init.signal` sea instancia
// de SU AbortSignal — el de jsdom no lo es. RootAppRouter monta el hash router
// a nivel de módulo y su navegación inicial construye un Request con una señal
// de jsdom, así que cualquier test que arrastra ese grafo (vía appRouter,
// dialogHelper…) suelta un unhandled rejection. Se envuelve Request para
// saltar el chequeo conservando la señal original como propiedad legible: la
// navegación bajo jsdom no depende del abort real de undici.
const UndiciRequest = globalThis.Request;

if (UndiciRequest) {
    class RequestWithoutSignalCheck extends UndiciRequest {
        constructor(input: RequestInfo | URL, init?: RequestInit) {
            super(input, { ...init, signal: undefined });

            if (init?.signal) {
                Object.defineProperty(this, 'signal', {
                    value: init.signal,
                    enumerable: true,
                    configurable: true
                });
            }
        }
    }

    globalThis.Request = RequestWithoutSignalCheck as typeof Request;
}
