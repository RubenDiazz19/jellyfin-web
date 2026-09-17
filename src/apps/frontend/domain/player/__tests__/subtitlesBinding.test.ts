import { describe, it, expect, beforeEach } from 'vitest';
import { SubtitlesBinding } from '../subtitlesBinding';

describe('SubtitlesBinding', () => {
    let binding: SubtitlesBinding;

    beforeEach(() => {
        binding = new SubtitlesBinding();
    });

    it('initializes clean', () => {
        expect(binding.subtitleUrl.value).toBeNull();
        expect(binding.subtitleOffset.value).toBe(0);
        expect(binding.selectedSubtitle.value).toBeNull();
    });

    it('delays subtitle url if video has not started', () => {
        binding.publishSubtitle('http://sub.vtt', false);

        expect(binding.subtitleUrl.value).toBeNull();

        binding.flushPendingSubtitle();
        expect(binding.subtitleUrl.value).toBe('http://sub.vtt');
    });

    it('publishes immediately if video has started', () => {
        binding.publishSubtitle('http://sub.vtt', true);
        expect(binding.subtitleUrl.value).toBe('http://sub.vtt');
    });

    it('clamps subtitle offset to +/- 30s', () => {
        binding.setSubtitleOffset(50);
        expect(binding.subtitleOffset.value).toBe(30);

        binding.setSubtitleOffset(-50);
        expect(binding.subtitleOffset.value).toBe(-30);
    });

    it('adjusts subtitle offset by delta', () => {
        binding.setSubtitleOffset(1);
        binding.adjustSubtitleOffset(-0.5);
        expect(binding.subtitleOffset.value).toBe(0.5);
    });
});
