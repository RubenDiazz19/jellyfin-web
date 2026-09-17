import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { useOsdVisibility } from '../useOsdVisibility';
import { renderHook } from '../../../../domain/bridge/__tests__/testUtils';
import { videoPlayerVM } from '../../../../domain/viewModels/VideoPlayerViewModel';

vi.mock('../../../../domain/viewModels/VideoPlayerViewModel', () => ({
    videoPlayerVM: {
        playing: { peek: vi.fn(() => true) },
        activeSegment: { value: null }
    }
}));

describe('useOsdVisibility', () => {
    let container: HTMLElement;
    let containerRef: { current: HTMLElement };
    let unmountFn: (() => void) | null = null;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.mocked(videoPlayerVM.playing.peek).mockReturnValue(true);
        container = document.createElement('div');
        document.body.appendChild(container);
        containerRef = { current: container };
    });

    afterEach(() => {
        if (unmountFn) {
            unmountFn();
            unmountFn = null;
        }
        vi.useRealTimers();
        if (container.parentNode) {
            document.body.removeChild(container);
        }
    });

    it('inicializa con los controles visibles', () => {
        const hook = renderHook(() => useOsdVisibility({
            containerRef,
            playing: true,
            isFullscreen: false,
            activeSegment: null
        }));
        unmountFn = hook.unmount;

        expect(hook.result.current.controlsVisible).toBe(true);
        expect(hook.result.current.skipVisible).toBe(false);
    });

    it('permite cambiar la visibilidad de los controles con setControlsVisible', () => {
        const hook = renderHook(() => useOsdVisibility({
            containerRef,
            playing: true,
            isFullscreen: false,
            activeSegment: null
        }));
        unmountFn = hook.unmount;

        expect(hook.result.current.controlsVisible).toBe(true);

        act(() => {
            hook.result.current.setControlsVisible(false);
        });
        expect(hook.result.current.controlsVisible).toBe(false);

        act(() => {
            hook.result.current.showControls();
        });
        expect(hook.result.current.controlsVisible).toBe(true);
    });

    it('no oculta los controles si la reproducción está pausada', () => {
        vi.mocked(videoPlayerVM.playing.peek).mockReturnValue(false);

        const hook = renderHook(() => useOsdVisibility({
            containerRef,
            playing: false,
            isFullscreen: false,
            activeSegment: null
        }));
        unmountFn = hook.unmount;

        act(() => {
            vi.advanceTimersByTime(4000);
        });

        expect(hook.result.current.controlsVisible).toBe(true);
    });

    it('muestra y oculta el botón de saltar con showSkip', () => {
        const hook = renderHook(() => useOsdVisibility({
            containerRef,
            playing: true,
            isFullscreen: false,
            activeSegment: { kind: 'Intro', start: 10, end: 30 } as any
        }));
        unmountFn = hook.unmount;

        act(() => {
            hook.result.current.showSkip();
        });
        expect(hook.result.current.skipVisible).toBe(true);

        act(() => {
            vi.advanceTimersByTime(3500);
        });
        expect(hook.result.current.skipVisible).toBe(false);
    });
});
