import { describe, it, expect, beforeEach } from 'vitest';
import { LIBRARY_SORT, DEFAULT_SORT } from '../librarySortStore';

describe('LIBRARY_SORT', () => {
    beforeEach(() => {
        LIBRARY_SORT._reset();
    });

    it('loads the default value if store is empty', () => {
        expect(LIBRARY_SORT.load()).toBe(DEFAULT_SORT);
    });

    it('saves a value and loads it correctly', () => {
        LIBRARY_SORT.save('year');
        expect(LIBRARY_SORT.load()).toBe('year');
    });

    it('resets to default via _reset', () => {
        LIBRARY_SORT.save('year');
        LIBRARY_SORT._reset();
        expect(LIBRARY_SORT.load()).toBe(DEFAULT_SORT);
    });

    it('returns default if invalid value is stored', () => {
        // Manipulate localStorage directly to simulate bad state
        localStorage.setItem('jfp-library-sort', JSON.stringify('invalid_sort_key'));
        expect(LIBRARY_SORT.load()).toBe(DEFAULT_SORT);
    });
});
