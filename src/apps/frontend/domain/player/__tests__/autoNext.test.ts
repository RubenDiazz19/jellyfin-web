import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoNextTracker } from '../autoNext';

describe('AutoNextTracker', () => {
    let tracker: AutoNextTracker;
    let outroStartSpy: any;

    beforeEach(() => {
        outroStartSpy = vi.fn().mockReturnValue(null);
        tracker = new AutoNextTracker(outroStartSpy);
    });

    it('resets state correctly', () => {
        tracker.next.value = {} as any;
        tracker.progress.value = 0.5;

        tracker.reset();

        expect(tracker.next.value).toBeNull();
        expect(tracker.progress.value).toBeNull();
    });

    it('hides progress if there is no next episode', () => {
        tracker.next.value = null;
        tracker.progress.value = 0.5;

        tracker.syncTo(100, 120);
        expect(tracker.progress.value).toBeNull();
    });

    it('hides progress if dismissed', () => {
        tracker.next.value = {} as any;

        tracker.syncTo(100, 120);
        expect(tracker.progress.value).not.toBeNull();

        tracker.dismiss();
        expect(tracker.progress.value).toBeNull();

        tracker.syncTo(101, 120);
        expect(tracker.progress.value).toBeNull(); // still null
    });

    it('starts at 25 seconds before end if no outro', () => {
        tracker.next.value = {} as any;

        expect(tracker.startAt(100)).toBe(75);
    });

    it('starts at outro start if outro is near the end', () => {
        outroStartSpy.mockReturnValue(80); // Outro starts at 80
        tracker.next.value = {} as any;

        expect(tracker.startAt(100)).toBe(80);
    });

    it('updates progress based on time elapsed', () => {
        tracker.next.value = {} as any;

        tracker.syncTo(70, 100);
        expect(tracker.progress.value).toBeNull(); // Not started yet (starts at 75)

        tracker.syncTo(87.5, 100);
        expect(tracker.progress.value).toBe(0.5); // Halfway (75 to 100)

        tracker.syncTo(100, 100);
        expect(tracker.progress.value).toBe(1); // Done
    });
});
