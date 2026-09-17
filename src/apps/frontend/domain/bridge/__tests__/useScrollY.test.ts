import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useScrollY, useIsScrolled, useNavScroll } from '../useScrollY';
import { renderHook } from './testUtils';
import { act } from 'react';

describe('useScrollY', () => {
    beforeEach(() => {
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            cb(0);
            return 1;
        });
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
        Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns the current scrollY', () => {
        const { result } = renderHook(() => useScrollY());
        expect(result.current).toBe(0);

        (window as any).scrollY = 100;
        act(() => {
            window.dispatchEvent(new Event('scroll'));
        });

        expect(result.current).toBe(100);
    });
});

describe('useIsScrolled', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
    });

    it('returns false initially if under threshold', () => {
        const { result } = renderHook(() => useIsScrolled(50));
        expect(result.current).toBe(false);
    });

    it('returns true when scrolling past threshold', () => {
        const { result } = renderHook(() => useIsScrolled(50));

        (window as any).scrollY = 100;
        act(() => {
            window.dispatchEvent(new Event('scroll'));
        });

        expect(result.current).toBe(true);
    });
});

describe('useNavScroll', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('tracks isScrolled and isScrolling', () => {
        const { result } = renderHook(() => useNavScroll(40, 100));
        expect(result.current.isScrolled).toBe(false);
        expect(result.current.isScrolling).toBe(false);

        (window as any).scrollY = 50;
        act(() => {
            window.dispatchEvent(new Event('scroll'));
        });

        expect(result.current.isScrolled).toBe(true);
        expect(result.current.isScrolling).toBe(true);

        // Advance timers to trigger idle delay
        act(() => {
            vi.advanceTimersByTime(150);
        });
        expect(result.current.isScrolling).toBe(false);
        expect(result.current.isScrolled).toBe(true);
    });
});
