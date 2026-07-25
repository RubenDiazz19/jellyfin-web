import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BottomSheet } from '../BottomSheet';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

function render(onClose: () => void) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root?.render(
            <BottomSheet title='Opciones del título' onClose={onClose}>
                <button>Descargar</button>
            </BottomSheet>
        );
    });
}

describe('BottomSheet', () => {
    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
    });

    it('se monta como portal con título y contenido', () => {
        render(() => undefined);
        const dialog = document.querySelector('[role="dialog"]');
        expect(dialog).not.toBeNull();
        expect(dialog?.textContent).toContain('Opciones del título');
        expect(dialog?.textContent).toContain('Descargar');
    });

    it('el scrim cierra; el contenido no', () => {
        const onClose = vi.fn();
        render(onClose);
        const dialog = document.querySelector('[role="dialog"]') as HTMLElement;

        act(() => { dialog.click(); });
        expect(onClose).not.toHaveBeenCalled();

        const scrim = dialog.parentElement as HTMLElement;
        act(() => { scrim.click(); });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Escape cierra', () => {
        const onClose = vi.fn();
        render(onClose);
        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

// ── Arrastrar para descartar (B1) ───────────────────────────────────────
// Los umbrales puros se testean en dragDismiss.test.ts; aquí se comprueba el
// cableado real: que el sheet siga al dedo, que ceda el gesto al scroll
// interior y que solo cierre cuando toca.

const SETTLE_MS = 250;

type FakeTouch = { clientX: number; clientY: number };

/** Evento táctil con timeStamp controlado (jsdom lo deja siempre en 0). */
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

/**
 * Arrastra el sheet por los puntos dados. `steps` son pares [y, t]: la
 * velocidad de salida se mide entre las dos últimas muestras, así que un
 * flick se expresa alejando la última de la penúltima en muy poco tiempo.
 */
function drag(sheet: HTMLElement, from: number, steps: Array<[number, number]>) {
    act(() => { sheet.dispatchEvent(touch('touchstart', { clientX: 100, clientY: from }, 0)); });
    for (const [y, t] of steps) {
        act(() => { sheet.dispatchEvent(touch('touchmove', { clientX: 100, clientY: y }, t)); });
    }
    act(() => { sheet.dispatchEvent(touch('touchend', null, steps.at(-1)?.[1] ?? 0)); });
}

/** scrollTop no es asignable de verdad en jsdom: se fuerza con defineProperty. */
function setScrollTop(el: HTMLElement, value: number) {
    Object.defineProperty(el, 'scrollTop', { value, configurable: true });
}

describe('BottomSheet: arrastrar para descartar', () => {
    let onClose: ReturnType<typeof vi.fn>;

    function renderSheet(): HTMLElement {
        render(onClose);
        return document.querySelector<HTMLElement>('[role="dialog"]')!;
    }

    beforeEach(() => {
        onClose = vi.fn();
        vi.useFakeTimers();
    });

    afterEach(() => {
        // El afterEach del describe hermano no cubre este: sin desmontar, el
        // portal del test anterior se queda en el body y el querySelector de
        // renderSheet() devolvería un sheet muerto.
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        vi.useRealTimers();
    });

    it('sigue al dedo mientras se arrastra', () => {
        const sheet = renderSheet();
        act(() => { sheet.dispatchEvent(touch('touchstart', { clientX: 100, clientY: 400 }, 0)); });
        act(() => { sheet.dispatchEvent(touch('touchmove', { clientX: 100, clientY: 440 }, 60)); });

        expect(sheet.style.transform).toBe('translateY(40px)');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('descarta al superar el recorrido y cierra tras la transición', () => {
        const sheet = renderSheet();
        drag(sheet, 400, [[440, 60], [520, 200]]); // 120px > 96

        // Cierra al acabar la salida, no antes: si no, el sheet desaparecería
        // de golpe en mitad de la animación.
        expect(onClose).not.toHaveBeenCalled();
        act(() => { vi.advanceTimersByTime(SETTLE_MS); });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('un arrastre corto vuelve a su sitio sin cerrar', () => {
        const sheet = renderSheet();
        drag(sheet, 400, [[420, 60], [440, 200]]); // 40px, y despacio

        // Al soltar vuelve a 0 con transición…
        expect(sheet.style.transform).toBe('translateY(0px)');

        act(() => { vi.advanceTimersByTime(SETTLE_MS * 2); });
        expect(onClose).not.toHaveBeenCalled();
        // …y al acabar se suelta el transform inline para no pisar la
        // animación de entrada si el sheet se vuelve a mostrar.
        expect(sheet.style.transform).toBe('');
    });

    it('un flick corto pero rápido descarta', () => {
        const sheet = renderSheet();
        // 44px de recorrido (por debajo del umbral de distancia) pero el
        // último tramo va a 30px/16ms ≈ 1.9px/ms: sobra velocidad.
        drag(sheet, 400, [[414, 100], [444, 116]]);

        act(() => { vi.advanceTimersByTime(SETTLE_MS); });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('frenar antes de soltar no descarta aunque se viniera rápido', () => {
        const sheet = renderSheet();
        // Mismo recorrido que el flick, pero la última muestra casi no avanza:
        // la velocidad se mide en el tramo final, no en el gesto entero.
        drag(sheet, 400, [[440, 100], [442, 180]]);

        act(() => { vi.advanceTimersByTime(SETTLE_MS * 2); });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('con el contenido scrolleado el gesto se lo queda el scroll', () => {
        const sheet = renderSheet();
        setScrollTop(sheet, 120);
        drag(sheet, 400, [[440, 60], [560, 200]]); // recorrido de sobra

        act(() => { vi.advanceTimersByTime(SETTLE_MS * 2); });
        expect(onClose).not.toHaveBeenCalled();
        expect(sheet.style.transform).toBe('');
    });

    it('arrastrar hacia arriba no cierra', () => {
        const sheet = renderSheet();
        drag(sheet, 400, [[360, 60], [300, 200]]);

        act(() => { vi.advanceTimersByTime(SETTLE_MS * 2); });
        expect(onClose).not.toHaveBeenCalled();
    });
});
