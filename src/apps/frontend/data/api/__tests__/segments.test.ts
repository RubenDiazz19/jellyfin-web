import { describe, it, expect, vi } from 'vitest';
import { getMediaSegments } from '../segments';
import * as httpModule from '../http';
import { TICKS_PER_SECOND } from '../types';

vi.mock('../http');

describe('segments API', () => {
    it('getMediaSegments returns mapped and sorted segments', async () => {
        vi.mocked(httpModule.apiFetch).mockResolvedValueOnce({
            Items: [
                { Type: 'Outro', StartTicks: 50 * TICKS_PER_SECOND, EndTicks: 60 * TICKS_PER_SECOND },
                { Type: 'Intro', StartTicks: 10 * TICKS_PER_SECOND, EndTicks: 20 * TICKS_PER_SECOND },
                { Type: 'Unknown' }, // Invalid segment
                { Type: 'Commercial', StartTicks: 30 * TICKS_PER_SECOND, EndTicks: 25 * TICKS_PER_SECOND } // Negative length
            ]
        });

        const segments = await getMediaSegments('item1');

        expect(segments).toHaveLength(2);

        // Should be sorted by start time
        expect(segments[0]).toEqual({ kind: 'Intro', start: 10, end: 20 });
        expect(segments[1]).toEqual({ kind: 'Outro', start: 50, end: 60 });
    });

    it('getMediaSegments returns empty array on failure', async () => {
        vi.mocked(httpModule.apiFetch).mockRejectedValueOnce(new Error('404'));

        const segments = await getMediaSegments('item1');
        expect(segments).toEqual([]);
    });
});
