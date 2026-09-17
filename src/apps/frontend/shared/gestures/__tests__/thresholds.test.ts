import { describe, it, expect } from 'vitest';
import {
    DRAG_THRESHOLD,
    DISMISS_DISTANCE,
    DISMISS_VELOCITY,
    SWIPE_DRAG_THRESHOLD,
    SWIPE_VERTICAL_TOLERANCE,
    SWIPE_BACK_EDGE_PX,
    SWIPE_BACK_MIN_DX,
    SWIPE_BACK_MAX_DY,
    SWIPE_BACK_MAX_MS,
    VIDEO_MOVE_THRESHOLD,
    VIDEO_CLOSE_BAND,
    VIDEO_CLOSE_DISTANCE,
    VIDEO_SEEK_RANGE_SECONDS
} from '../thresholds';

describe('gestures thresholds', () => {
    it('define valores coherentes para arrastre y descarte', () => {
        expect(DRAG_THRESHOLD).toBeGreaterThan(0);
        expect(DISMISS_DISTANCE).toBeGreaterThan(DRAG_THRESHOLD);
        expect(DISMISS_VELOCITY).toBeGreaterThan(0);
    });

    it('define valores coherentes para carrusel / hero swipe', () => {
        expect(SWIPE_DRAG_THRESHOLD).toBeGreaterThan(DRAG_THRESHOLD);
        expect(SWIPE_VERTICAL_TOLERANCE).toBeGreaterThan(0);
    });

    it('define valores coherentes para swipe back', () => {
        expect(SWIPE_BACK_EDGE_PX).toBeGreaterThan(0);
        expect(SWIPE_BACK_MIN_DX).toBeGreaterThan(0);
        expect(SWIPE_BACK_MAX_DY).toBeGreaterThan(0);
        expect(SWIPE_BACK_MAX_MS).toBeGreaterThan(0);
    });

    it('define valores coherentes para gestos del reproductor de vídeo', () => {
        expect(VIDEO_MOVE_THRESHOLD).toBeGreaterThan(0);
        expect(VIDEO_CLOSE_BAND).toBeGreaterThan(0);
        expect(VIDEO_CLOSE_BAND).toBeLessThan(1);
        expect(VIDEO_CLOSE_DISTANCE).toBeGreaterThan(0);
        expect(VIDEO_SEEK_RANGE_SECONDS).toBeGreaterThan(0);
    });
});
