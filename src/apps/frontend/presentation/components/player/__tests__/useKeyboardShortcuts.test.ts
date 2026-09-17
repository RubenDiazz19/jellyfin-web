import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';
import { renderHook } from '../../../../domain/bridge/__tests__/testUtils';
import { videoPlayerVM } from '../../../../domain/viewModels/VideoPlayerViewModel';

vi.mock('../../../../domain/viewModels/VideoPlayerViewModel', () => ({
    videoPlayerVM: {
        togglePlay: vi.fn(),
        toggleMute: vi.fn(),
        toggleFullscreen: vi.fn(),
        skipBackward: vi.fn(),
        skipForward: vi.fn(),
        volume: { peek: vi.fn(() => 0.5) },
        setVolume: vi.fn(),
        playbackRate: { peek: vi.fn(() => 1.0) },
        setPlaybackRate: vi.fn(),
        subtitleOffset: { peek: vi.fn(() => 0) },
        adjustSubtitleOffset: vi.fn()
    }
}));

describe('useKeyboardShortcuts', () => {
    const defaultProps = {
        queueItems: [],
        shortcutsOpen: false,
        onPlayQueued: vi.fn(),
        onClose: vi.fn(),
        showControls: vi.fn(),
        showNotice: vi.fn(),
        setShortcutsOpen: vi.fn()
    };

    let unmountFn: (() => void) | null = null;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        if (unmountFn) {
            unmountFn();
            unmountFn = null;
        }
        vi.restoreAllMocks();
    });

    it('ejecuta togglePlay al pulsar la barra espaciadora o K', () => {
        const hook = renderHook(() => useKeyboardShortcuts(defaultProps));
        unmountFn = hook.unmount;

        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
        expect(videoPlayerVM.togglePlay).toHaveBeenCalledTimes(1);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
        expect(videoPlayerVM.togglePlay).toHaveBeenCalledTimes(2);
    });

    it('ejecuta toggleMute al pulsar M', () => {
        const hook = renderHook(() => useKeyboardShortcuts(defaultProps));
        unmountFn = hook.unmount;

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
        expect(videoPlayerVM.toggleMute).toHaveBeenCalledTimes(1);
    });

    it('ejecuta toggleFullscreen al pulsar F', () => {
        const hook = renderHook(() => useKeyboardShortcuts(defaultProps));
        unmountFn = hook.unmount;

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
        expect(videoPlayerVM.toggleFullscreen).toHaveBeenCalledTimes(1);
    });

    it('ejecuta saltos adelante y atrás con flechas', () => {
        const hook = renderHook(() => useKeyboardShortcuts(defaultProps));
        unmountFn = hook.unmount;

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        expect(videoPlayerVM.skipBackward).toHaveBeenCalledTimes(1);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        expect(videoPlayerVM.skipForward).toHaveBeenCalledTimes(1);
    });

    it('ignora eventos de teclado originados dentro de un input o textarea', () => {
        const hook = renderHook(() => useKeyboardShortcuts(defaultProps));
        unmountFn = hook.unmount;

        const input = document.createElement('input');
        document.body.appendChild(input);

        const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
        input.dispatchEvent(event);

        expect(videoPlayerVM.togglePlay).not.toHaveBeenCalled();
        document.body.removeChild(input);
    });
});
