import { describe, it, expect } from 'vitest';
import * as stores from '../stores';
import { FAVS } from '../../data/stores/favsStore';
import { WATCHED } from '../../data/stores/watchedStore';

describe('stores facade', () => {
    it('re-exports stores from data', () => {
        expect(stores.FAVS).toBe(FAVS);
        expect(stores.WATCHED).toBe(WATCHED);
        expect(stores.VIEWS).toBeDefined();
        expect(stores.LISTS).toBeDefined();
        expect(stores.COLLECTION_STYLES).toBeDefined();
        expect(stores.movieKey).toBeDefined();
        expect(stores.seasonKey).toBeDefined();
        expect(stores.episodeKey).toBeDefined();
        expect(stores.displayItems).toBeDefined();
    });
});
