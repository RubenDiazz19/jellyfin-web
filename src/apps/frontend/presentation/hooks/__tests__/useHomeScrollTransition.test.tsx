import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useHomeScrollTransition, type HomeScrollTransition } from '../useHomeScrollTransition';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
let latestResult: HomeScrollTransition | null = null;

function HookTester() {
    const res = useHomeScrollTransition();
    latestResult = res;
    return <div data-testid='result'>{res.progress}</div>;
}

function mount(ui: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    return act(async () => {
        root?.render(ui);
    });
}

describe('useHomeScrollTransition', () => {
    let originalInnerHeight: number;

    beforeEach(() => {
        latestResult = null;
        originalInnerHeight = window.innerHeight;
        Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
        Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        latestResult = null;
        Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, configurable: true });
    });

    it('devuelve valores iniciales completos para scroll 0', async () => {
        await mount(<HookTester />);

        expect(latestResult).not.toBeNull();
        expect(latestResult!.scrollY).toBe(0);
        expect(latestResult!.progress).toBe(0);
        expect(latestResult!.heroContentOpacity).toBe(1);
        expect(latestResult!.heroBackdropOpacity).toBe(1);
        expect(latestResult!.heroBackdropScale).toBe(1);
        expect(latestResult!.scrollHintOpacity).toBe(1);
        expect(latestResult!.titleOpacity).toBe(0);
        expect(latestResult!.heroInteractive).toBe(true);
        expect(latestResult!.isHeroOffscreen).toBe(false);
    });

    it('interpola la transición al desplazarse', async () => {
        await mount(<HookTester />);

        await act(async () => {
            window.scrollY = 450; // 50% del umbral de 900px (1000 * 0.9)
            window.dispatchEvent(new Event('scroll'));
            await new Promise((resolve) => requestAnimationFrame(resolve));
        });

        expect(latestResult!.scrollY).toBe(450);
        expect(latestResult!.progress).toBeCloseTo(0.5, 2);
        expect(latestResult!.heroContentOpacity).toBeLessThan(0.5);
        expect(latestResult!.heroBackdropOpacity).toBeCloseTo(0.67, 2);
        // Los títulos se mantienen ocultos mientras las cartas están emergiendo
        expect(latestResult!.titleOpacity).toBe(0);
    });

    it('desvanece por completo el Hero y muestra los títulos al completar la transición', async () => {
        await mount(<HookTester />);

        await act(async () => {
            window.scrollY = 950; // Supera el umbral de 900px
            window.dispatchEvent(new Event('scroll'));
            await new Promise((resolve) => requestAnimationFrame(resolve));
        });

        expect(latestResult!.progress).toBe(1);
        expect(latestResult!.heroContentOpacity).toBe(0);
        expect(latestResult!.heroBackdropOpacity).toBe(0);
        expect(latestResult!.scrollHintOpacity).toBe(0);
        expect(latestResult!.titleOpacity).toBeCloseTo(1, 2);
        expect(latestResult!.titleTranslateY).toBe(0);
        expect(latestResult!.heroInteractive).toBe(false);
        expect(latestResult!.isHeroOffscreen).toBe(true);
    });
});
