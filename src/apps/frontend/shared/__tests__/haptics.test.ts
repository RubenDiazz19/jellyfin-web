import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { haptic } from '../haptics';

describe('haptics', () => {
    let vibrate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        document.documentElement.className = '';
        vibrate = vi.fn(() => true);
        Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    });

    afterEach(() => {
        delete (navigator as { vibrate?: unknown }).vibrate;
        document.documentElement.className = '';
    });

    it('mobile: vibra con el patrón del preset', () => {
        document.documentElement.classList.add('layout-mobile');
        haptic('tick');
        expect(vibrate).toHaveBeenCalledWith(8);
        haptic('success');
        expect(vibrate).toHaveBeenCalledWith([10, 40, 10]);
    });

    it('tablet: también vibra', () => {
        document.documentElement.classList.add('layout-mobile', 'layout-tablet');
        haptic('select');
        expect(vibrate).toHaveBeenCalledWith(12);
    });

    it('desktop: NO vibra (no-op)', () => {
        document.documentElement.classList.add('layout-desktop');
        haptic('tick');
        expect(vibrate).not.toHaveBeenCalled();
    });

    it('sobrevive si navigator.vibrate lanza', () => {
        document.documentElement.classList.add('layout-mobile');
        vibrate.mockImplementation(() => { throw new Error('blocked'); });
        expect(() => haptic('warn')).not.toThrow();
    });
});
