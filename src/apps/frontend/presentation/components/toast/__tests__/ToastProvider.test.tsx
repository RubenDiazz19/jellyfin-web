// El toast se presenta como snackbar M3 (role=status) en táctil y como
// píldora en desktop.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MobileThemeProvider } from '../../../theme/MobileThemeProvider';
import { ToastProvider, useToast } from '../ToastProvider';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../data/api/theme', () => ({
    getServerThemePrefs: () => Promise.resolve(null),
    saveServerThemePrefs: () => Promise.resolve()
}));

let fire: (msg: string) => void = (msg: string) => { void msg; };

function Trigger() {
    fire = useToast();
    return null;
}

let root: Root | null = null;
let host: HTMLElement | null = null;

function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root?.render(
            <MobileThemeProvider>
                <ToastProvider><Trigger /></ToastProvider>
            </MobileThemeProvider>
        );
    });
}

describe('ToastProvider', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.className = '';
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        document.documentElement.className = '';
        document.getElementById('jfp-m3-tokens')?.remove();
    });

    it('táctil: snackbar M3 con role status', () => {
        document.documentElement.classList.add('layout-mobile');
        render();
        act(() => { fire('Guardado'); });
        const status = host?.querySelector('[role="status"]');
        expect(status).not.toBeNull();
        expect(status?.textContent).toBe('Guardado');
    });

    it('desktop: píldora sin role status', () => {
        document.documentElement.classList.add('layout-desktop');
        render();
        act(() => { fire('Guardado'); });
        expect(host?.querySelector('[role="status"]')).toBeNull();
        expect(host?.textContent).toContain('Guardado');
    });
});

// ── Swipe horizontal para descartar (B2) ────────────────────────────────

type FakeTouch = { clientX: number; clientY: number };

/** Evento táctil de React con timeStamp controlado (jsdom lo deja en 0). */
function touch(type: string, at: FakeTouch | null, timeStamp: number) {
    const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & {
        touches: FakeTouch[];
        changedTouches: FakeTouch[];
    };
    ev.touches = at ? [at] : [];
    ev.changedTouches = at ? [at] : [];
    Object.defineProperty(ev, 'timeStamp', { value: timeStamp });
    return ev;
}

/** Desliza el snackbar. `steps` son pares [x, t]; la última pareja fija la velocidad. */
function swipe(el: HTMLElement, from: number, steps: Array<[number, number]>) {
    act(() => { el.dispatchEvent(touch('touchstart', { clientX: from, clientY: 600 }, 0)); });
    for (const [x, t] of steps) {
        act(() => { el.dispatchEvent(touch('touchmove', { clientX: x, clientY: 600 }, t)); });
    }
    act(() => { el.dispatchEvent(touch('touchend', null, steps.at(-1)?.[1] ?? 0)); });
}

describe('ToastProvider: swipe-to-dismiss', () => {
    const OUT_MS = 200;

    function showToast(): HTMLElement {
        document.documentElement.classList.add('layout-mobile');
        render();
        act(() => { fire('Guardado'); });
        const el = host?.querySelector<HTMLElement>('[role="status"]');
        if (!el) throw new Error('No hay snackbar');
        // La entrada se marca desde un requestAnimationFrame; con timers
        // falsos hay que dejarlo correr o el snackbar se queda en su estado
        // inicial (translateY, opacidad 0) y el transform del gesto no se ve.
        act(() => { vi.advanceTimersByTime(20); });
        return el;
    }

    beforeEach(() => {
        localStorage.clear();
        document.documentElement.className = '';
        vi.useFakeTimers();
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        document.documentElement.className = '';
        document.getElementById('jfp-m3-tokens')?.remove();
        vi.useRealTimers();
    });

    it('sigue al dedo mientras se desliza', () => {
        const el = showToast();
        act(() => { el.dispatchEvent(touch('touchstart', { clientX: 200, clientY: 600 }, 0)); });
        act(() => { el.dispatchEvent(touch('touchmove', { clientX: 240, clientY: 600 }, 50)); });
        expect(el.style.transform).toBe('translateX(40px)');
    });

    it('un recorrido suficiente lo descarta', () => {
        const el = showToast();
        swipe(el, 200, [[240, 50], [300, 200]]); // 100px > 72

        expect(host?.querySelector('[role="status"]')).not.toBeNull();
        act(() => { vi.advanceTimersByTime(OUT_MS); });
        expect(host?.querySelector('[role="status"]')).toBeNull();
    });

    it('un flick corto también lo descarta', () => {
        const el = showToast();
        // 45px de recorrido, por debajo del umbral, pero el último tramo va a
        // 30px/16ms ≈ 1.9px/ms.
        swipe(el, 200, [[215, 100], [245, 116]]);

        act(() => { vi.advanceTimersByTime(OUT_MS); });
        expect(host?.querySelector('[role="status"]')).toBeNull();
    });

    it('un roce corto y lento vuelve a su sitio', () => {
        const el = showToast();
        swipe(el, 200, [[215, 100], [230, 400]]); // 30px, lento

        act(() => { vi.advanceTimersByTime(OUT_MS * 2); });
        expect(host?.querySelector('[role="status"]')).not.toBeNull();
        expect(el.style.transform).toBe('translateX(0px)');
    });

    it('descartar cancela el auto-cierre (no se cierra dos veces)', () => {
        const el = showToast();
        swipe(el, 200, [[240, 50], [300, 200]]);
        act(() => { vi.advanceTimersByTime(OUT_MS); });
        expect(host?.querySelector('[role="status"]')).toBeNull();

        // El timer de duración del toast (2.2s en success) ya no tiene nada
        // que quitar: si volviera a disparar sobre una lista vacía no pasa
        // nada, pero sí importa que no reviente ni resucite el snackbar.
        act(() => { vi.advanceTimersByTime(5000); });
        expect(host?.querySelector('[role="status"]')).toBeNull();
    });

    it('desktop: la píldora no lleva gesto', () => {
        document.documentElement.classList.add('layout-desktop');
        render();
        act(() => { fire('Guardado'); });
        // Sin role=status no hay snackbar táctil que deslizar; el texto sigue.
        expect(host?.querySelector('[role="status"]')).toBeNull();
        expect(host?.textContent).toContain('Guardado');
    });
});
