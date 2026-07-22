import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initRipple } from '../ripple';

function pointerDown(target: Element, x = 10, y = 10) {
    const ev = new Event('pointerdown', { bubbles: true }) as PointerEvent & { clientX: number; clientY: number };
    Object.defineProperty(ev, 'clientX', { value: x });
    Object.defineProperty(ev, 'clientY', { value: y });
    Object.defineProperty(ev, 'target', { value: target });
    document.dispatchEvent(ev);
}

describe('ripple', () => {
    let cleanup: () => void;
    let btn: HTMLButtonElement;
    let plain: HTMLButtonElement;

    beforeEach(() => {
        document.documentElement.className = '';
        btn = document.createElement('button');
        btn.setAttribute('data-ripple', '');
        plain = document.createElement('button');
        document.body.append(btn, plain);
        cleanup = initRipple();
    });

    afterEach(() => {
        cleanup();
        btn.remove();
        plain.remove();
        document.documentElement.className = '';
    });

    it('mobile: añade el ink a un [data-ripple]', () => {
        document.documentElement.classList.add('layout-mobile');
        pointerDown(btn);
        expect(btn.querySelector('.jfp-ripple-ink')).not.toBeNull();
    });

    it('no añade ink a elementos sin data-ripple', () => {
        document.documentElement.classList.add('layout-mobile');
        pointerDown(plain);
        expect(plain.querySelector('.jfp-ripple-ink')).toBeNull();
    });

    it('desktop: no añade ink aunque tenga data-ripple', () => {
        document.documentElement.classList.add('layout-desktop');
        pointerDown(btn);
        expect(btn.querySelector('.jfp-ripple-ink')).toBeNull();
    });

    it('el cleanup desengancha el listener', () => {
        document.documentElement.classList.add('layout-mobile');
        cleanup();
        pointerDown(btn);
        expect(btn.querySelector('.jfp-ripple-ink')).toBeNull();
    });
});
