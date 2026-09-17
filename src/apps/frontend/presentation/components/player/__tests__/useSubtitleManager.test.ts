import { describe, it, expect, vi } from 'vitest';
import { useSubtitleManager } from '../useSubtitleManager';
import { renderHook } from '../../../../domain/bridge/__tests__/testUtils';
import * as subtitleStyleModule from '../../../../domain/player/subtitleStyle';

vi.mock('../../../../domain/player/subtitleStyle', () => ({
    applyCueLine: vi.fn(),
    getSubtitleAppearance: vi.fn(() => ({ verticalPosition: -3 })),
    removeSubtitleAppearance: vi.fn()
}));

describe('useSubtitleManager', () => {
    it('devuelve setter de referencia para la pista de subtítulos', () => {
        const { result } = renderHook(() => useSubtitleManager(null, 0));
        expect(typeof result.current.setSubtitleTrackRef).toBe('function');
    });

    it('ejecuta removeSubtitleAppearance al desmontar', () => {
        const { unmount } = renderHook(() => useSubtitleManager(null, 0));
        unmount();
        expect(subtitleStyleModule.removeSubtitleAppearance).toHaveBeenCalled();
    });
});
