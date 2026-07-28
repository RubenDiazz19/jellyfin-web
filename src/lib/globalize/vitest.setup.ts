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
