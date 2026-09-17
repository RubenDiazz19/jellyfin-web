import { describe, it, expect, vi } from 'vitest';
import { imageUrl } from '../images';
import * as sessionModule from '../../session/session';

vi.mock('../../session/session');

describe('images API', () => {
    it('imageUrl returns undefined if no itemId or serverUrl', () => {
        vi.mocked(sessionModule.loadSession).mockReturnValue(null);
        expect(imageUrl(undefined, 'Primary')).toBeUndefined();
        expect(imageUrl('item1', 'Primary')).toBeUndefined();
    });

    it('imageUrl constructs correct URL', () => {
        vi.mocked(sessionModule.loadSession).mockReturnValue({ serverUrl: 'http://srv' } as any);
        const url = imageUrl('item1', 'Primary', { tag: 'tag1', maxHeight: 100, maxWidth: 200, index: 1 });
        expect(url).toBe('http://srv/Items/item1/Images/Primary/1?tag=tag1&maxHeight=100&maxWidth=200&format=webp');
    });
});
