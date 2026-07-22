import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initSwipeBack } from '../swipeBack';

type FakeTouch = { clientX: number; clientY: number };

function touchEvent(type: 'touchstart' | 'touchend', touch: FakeTouch) {
    const ev = new Event(type) as Event & {
        touches: FakeTouch[];
        changedTouches: FakeTouch[];
    };
    ev.touches = type === 'touchstart' ? [touch] : [];
    ev.changedTouches = [touch];
    return ev;
}

function swipe(fromX: number, toX: number, y = 300) {
    window.dispatchEvent(touchEvent('touchstart', { clientX: fromX, clientY: y }));
    window.dispatchEvent(touchEvent('touchend', { clientX: toX, clientY: y }));
}

describe('swipeBack', () => {
    let back: ReturnType<typeof vi.spyOn>;
    let stop: () => void;

    beforeEach(() => {
        document.documentElement.className = '';
        back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
        stop = initSwipeBack();
    });

    afterEach(() => {
        stop();
        document.documentElement.className = '';
    });

    it('mobile: swipe desde el borde izquierdo navega atrás', () => {
        document.documentElement.classList.add('layout-mobile');
        swipe(8, 160);
        expect(back).toHaveBeenCalledTimes(1);
    });

    it('un swipe que no arranca en el borde no navega (scroll de filas)', () => {
        document.documentElement.classList.add('layout-mobile');
        swipe(60, 240);
        expect(back).not.toHaveBeenCalled();
    });

    it('un trazo demasiado vertical no navega', () => {
        document.documentElement.classList.add('layout-mobile');
        window.dispatchEvent(touchEvent('touchstart', { clientX: 8, clientY: 100 }));
        window.dispatchEvent(touchEvent('touchend', { clientX: 140, clientY: 300 }));
        expect(back).not.toHaveBeenCalled();
    });

    it('desktop: el gesto está desactivado', () => {
        document.documentElement.classList.add('layout-desktop');
        swipe(8, 200);
        expect(back).not.toHaveBeenCalled();
    });
});
