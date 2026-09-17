import { describe, it, expect, beforeEach } from 'vitest';
import { SegmentTracker } from '../segmentTracker';

describe('SegmentTracker', () => {
    let tracker: SegmentTracker;

    const intro = { kind: 'Intro', start: 10, end: 30 } as any;
    const outro = { kind: 'Outro', start: 100, end: 120 } as any;

    beforeEach(() => {
        tracker = new SegmentTracker();
    });

    it('replaces segments and clears skipped', () => {
        tracker.replace([intro, outro]);
        expect(tracker.list.value).toEqual([intro, outro]);
    });

    it('syncTo sets the active segment', () => {
        tracker.replace([intro, outro]);

        tracker.syncTo(15);
        expect(tracker.active.value).toBe(intro);

        // Outros are ignored for skip buttons
        tracker.syncTo(105);
        expect(tracker.active.value).toBeNull();

        tracker.syncTo(50);
        expect(tracker.active.value).toBeNull();
    });

    it('skipActive skips the active segment and returns end time', () => {
        tracker.replace([intro, outro]);
        tracker.syncTo(15);

        const target = tracker.skipActive(200); // normal
        expect(target).toBe(30);
        expect(tracker.active.value).toBeNull();

        // Already skipped, syncTo shouldn't set it again
        tracker.syncTo(16);
        expect(tracker.active.value).toBeNull();
    });

    it('skipActive handles duration boundaries (tail compensation)', () => {
        tracker.replace([{ kind: 'Intro', start: 10, end: 120 } as any]);
        tracker.syncTo(15);

        // End is exactly duration, should return duration - 0.25 to prevent ended event skipping
        const target = tracker.skipActive(120);
        expect(target).toBe(119.75);
    });

    it('unskipFrom allows previously skipped segments to be shown again', () => {
        tracker.replace([intro]);
        tracker.syncTo(15);
        tracker.skipActive(200);

        // Rewind to 5s
        tracker.unskipFrom(5);

        tracker.syncTo(15);
        expect(tracker.active.value).toBe(intro); // active again
    });

    it('outroStart finds outro if it ends within tail', () => {
        tracker.replace([outro]);
        // Duration 120, tail 15. Outro ends at 120, so 120 >= 105.
        expect(tracker.outroStart(120, 15)).toBe(100);

        // Tail 1, meaning outro must end at 119 or later.
        expect(tracker.outroStart(120, 1)).toBe(100);

        // What if outro ended too early?
        tracker.replace([{ kind: 'Outro', start: 50, end: 60 } as any]);
        expect(tracker.outroStart(120, 15)).toBeNull();
    });
});
