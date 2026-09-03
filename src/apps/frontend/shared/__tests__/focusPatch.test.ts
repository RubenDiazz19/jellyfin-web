import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installFocusPreventScrollPatch } from '../focusPatch';

describe('installFocusPreventScrollPatch', () => {
    let originalFocus: typeof HTMLElement.prototype.focus;

    beforeEach(() => {
        originalFocus = HTMLElement.prototype.focus;
    });

    afterEach(() => {
        HTMLElement.prototype.focus = originalFocus;
        delete (window as unknown as { event?: unknown }).event;
    });

    it('fuerza preventScroll: true en llamadas normales cuando el parche está activo', () => {
        const spy = vi.fn();
        HTMLElement.prototype.focus = spy;

        const uninstall = installFocusPreventScrollPatch();
        const el = document.createElement('input');

        el.focus();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith({ preventScroll: true });

        el.focus({ preventScroll: false });
        expect(spy).toHaveBeenCalledWith({ preventScroll: true });

        uninstall();
    });

    it('ignora llamadas a focus durante eventos de hover', () => {
        const spy = vi.fn();
        HTMLElement.prototype.focus = spy;

        const uninstall = installFocusPreventScrollPatch();
        const el = document.createElement('button');

        // Simular evento pointerenter activo en window.event
        (window as unknown as { event: unknown }).event = { type: 'pointerenter' };
        el.focus();
        expect(spy).not.toHaveBeenCalled();

        (window as unknown as { event: unknown }).event = { type: 'mouseover' };
        el.focus();
        expect(spy).not.toHaveBeenCalled();

        // En un click normal SÍ debe llamarse
        (window as unknown as { event: unknown }).event = { type: 'pointerdown' };
        el.focus();
        expect(spy).toHaveBeenCalledTimes(1);

        uninstall();
    });

    it('restaura HTMLElement.prototype.focus original al ejecutar la función de cleanup', () => {
        const customFocus = vi.fn();
        HTMLElement.prototype.focus = customFocus;

        const uninstall = installFocusPreventScrollPatch();
        expect(HTMLElement.prototype.focus).not.toBe(customFocus);

        uninstall();
        expect(HTMLElement.prototype.focus).toBe(customFocus);
    });
});
