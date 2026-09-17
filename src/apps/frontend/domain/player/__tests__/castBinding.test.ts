import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CastBinding } from '../castBinding';

describe('CastBinding', () => {
    let binding: CastBinding;

    beforeEach(() => {
        binding = new CastBinding();
    });

    it('initializes disconnected', () => {
        expect(binding.castAvailable.value).toBe(false);
        expect(binding.castState.value).toBe('disconnected');
    });

    it('watch handles missing remote gracefully', () => {
        const video = {} as HTMLVideoElement;
        const unwatch = binding.watch(video);
        expect(unwatch).toBeTypeOf('function');
        unwatch();
    });

    it('pauses local video for cast', () => {
        const video = { pause: vi.fn() } as unknown as HTMLVideoElement;
        const stopProgress = vi.fn();

        binding.pauseForCast(video, stopProgress);

        expect(video.pause).toHaveBeenCalled();
        expect(stopProgress).toHaveBeenCalled();
    });

    it('resets state', () => {
        binding.castAvailable.value = true;
        binding.castState.value = 'connected';
        binding.reset();

        expect(binding.castAvailable.value).toBe(false);
        expect(binding.castState.value).toBe('disconnected');
    });
});
