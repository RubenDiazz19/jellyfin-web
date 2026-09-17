import { describe, it, expect, vi } from 'vitest';
import { createTtlCache } from '../ttlCache';
import * as sessionModule from '../../session/session';

vi.mock('../../session/session');

describe('ttlCache', () => {
    it('stores and retrieves fresh entries', () => {
        vi.useFakeTimers();
        const cache = createTtlCache<string>({ ttlMs: 1000, userScoped: false });

        cache.set('key1', 'val1');
        expect(cache.get('key1')).toBe('val1');

        vi.advanceTimersByTime(500);
        expect(cache.get('key1')).toBe('val1');

        vi.advanceTimersByTime(600);
        expect(cache.get('key1')).toBeUndefined(); // expired (1100ms > 1000ms)
        expect(cache.peek('key1')).toBeUndefined(); // evicted during get

        vi.useRealTimers();
    });

    it('touch renews entry', () => {
        vi.useFakeTimers();
        const cache = createTtlCache<string>({ ttlMs: 1000, userScoped: false });

        const entry = cache.set('key1', 'val1');

        vi.advanceTimersByTime(800);
        cache.touch(entry);

        vi.advanceTimersByTime(800);
        expect(cache.get('key1')).toBe('val1'); // 1600ms total, but touched at 800ms

        vi.useRealTimers();
    });

    it('deletes by prefix', () => {
        const cache = createTtlCache<string>({ ttlMs: 1000, userScoped: false });
        cache.set('item1.a', 'a');
        cache.set('item1.b', 'b');
        cache.set('item2.a', 'a');

        cache.deleteByPrefix('item1.');
        expect(cache.get('item1.a')).toBeUndefined();
        expect(cache.get('item1.b')).toBeUndefined();
        expect(cache.get('item2.a')).toBe('a');
    });

    it('scops key with userId when userScoped is true', () => {
        vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'u1' } as any);
        const cache = createTtlCache<string>({ ttlMs: 1000, userScoped: true });

        expect(cache.key('item1')).toBe('u1.item1');
        expect(cache.key('item1', 'img')).toBe('u1.item1.img');
    });

    it('clears all entries', () => {
        const cache = createTtlCache<string>({ ttlMs: 1000, userScoped: false });
        cache.set('a', '1');
        cache.set('b', '2');
        cache.clear();
        expect(cache.get('a')).toBeUndefined();
        expect(cache.get('b')).toBeUndefined();
    });
});
