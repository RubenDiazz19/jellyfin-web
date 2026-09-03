import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isFullscreen, toggleFullscreen } from '../fullscreen';

describe('fullscreen', () => {
    type AnyDoc = Document & {
        webkitFullscreenElement?: Element | null;
        webkitExitFullscreen?: () => Promise<void>;
        msFullscreenElement?: Element | null;
        msExitFullscreen?: () => Promise<void>;
    };

    type AnyElement = HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
    };

    const anyDoc = document as AnyDoc;
    const docEl = document.documentElement as AnyElement;

    function setFullscreenElement(el: Element | null) {
        Object.defineProperty(document, 'fullscreenElement', {
            value: el,
            configurable: true,
            writable: true
        });
    }

    beforeEach(() => {
        setFullscreenElement(null);
        delete anyDoc.webkitFullscreenElement;
        delete anyDoc.msFullscreenElement;
        delete anyDoc.webkitExitFullscreen;
        delete anyDoc.msExitFullscreen;
        delete docEl.webkitRequestFullscreen;
        delete docEl.msRequestFullscreen;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('isFullscreen', () => {
        it('devuelve false cuando ninguna propiedad de fullscreen está activa', () => {
            setFullscreenElement(null);
            expect(isFullscreen()).toBe(false);
        });

        it('detecta fullscreen estándar via document.fullscreenElement', () => {
            const el = document.createElement('div');
            setFullscreenElement(el);
            expect(isFullscreen()).toBe(true);
        });

        it('detecta fullscreen via webkitFullscreenElement', () => {
            setFullscreenElement(null);
            anyDoc.webkitFullscreenElement = document.createElement('div');
            expect(isFullscreen()).toBe(true);
        });

        it('detecta fullscreen via msFullscreenElement', () => {
            setFullscreenElement(null);
            anyDoc.msFullscreenElement = document.createElement('div');
            expect(isFullscreen()).toBe(true);
        });
    });

    describe('toggleFullscreen', () => {
        it('llama a requestFullscreen estándar cuando no está en fullscreen', async () => {
            setFullscreenElement(null);
            const reqSpy = vi.fn().mockResolvedValue(undefined);
            docEl.requestFullscreen = reqSpy;

            await toggleFullscreen();
            expect(reqSpy).toHaveBeenCalledTimes(1);
        });

        it('usa fallback webkitRequestFullscreen si el estándar no está disponible', async () => {
            setFullscreenElement(null);
            docEl.requestFullscreen = undefined as unknown as typeof docEl.requestFullscreen;
            const webkitSpy = vi.fn().mockResolvedValue(undefined);
            docEl.webkitRequestFullscreen = webkitSpy;

            await toggleFullscreen();
            expect(webkitSpy).toHaveBeenCalledTimes(1);
        });

        it('usa fallback msRequestFullscreen si estándar y webkit no están disponibles', async () => {
            setFullscreenElement(null);
            docEl.requestFullscreen = undefined as unknown as typeof docEl.requestFullscreen;
            const msSpy = vi.fn().mockResolvedValue(undefined);
            docEl.msRequestFullscreen = msSpy;

            await toggleFullscreen();
            expect(msSpy).toHaveBeenCalledTimes(1);
        });

        it('llama a exitFullscreen estándar cuando ya está en fullscreen', async () => {
            setFullscreenElement(document.createElement('div'));
            const exitSpy = vi.fn().mockResolvedValue(undefined);
            document.exitFullscreen = exitSpy;

            await toggleFullscreen();
            expect(exitSpy).toHaveBeenCalledTimes(1);
        });

        it('usa fallback webkitExitFullscreen si el estándar no está disponible', async () => {
            setFullscreenElement(document.createElement('div'));
            document.exitFullscreen = undefined as unknown as typeof document.exitFullscreen;
            const webkitExit = vi.fn().mockResolvedValue(undefined);
            anyDoc.webkitExitFullscreen = webkitExit;

            await toggleFullscreen();
            expect(webkitExit).toHaveBeenCalledTimes(1);
        });

        it('captura y silencia errores cuando la API rechaza el fullscreen', async () => {
            setFullscreenElement(null);
            docEl.requestFullscreen = vi.fn().mockRejectedValue(new Error('User denied'));

            await expect(toggleFullscreen()).resolves.toBeUndefined();
        });
    });
});
