import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useCollectionScrollTransition, type CollectionScrollTransition } from '../useCollectionScrollTransition';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
let latestResult: CollectionScrollTransition | null = null;

function HookTester({ touch = false }: { touch?: boolean }) {
    const res = useCollectionScrollTransition(touch);
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

describe('useCollectionScrollTransition', () => {
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

    it('devuelve el estado de reposo inicial en scroll 0', async () => {
        await mount(<HookTester />);

        expect(latestResult).not.toBeNull();
        expect(latestResult!.scrollY).toBe(0);
        expect(latestResult!.progress).toBe(0);
        // Indicador de scroll (flecha) visible
        expect(latestResult!.scrollHintOpacity).toBe(1);
        // El cabecero a pantalla completa (100vh)
        expect(latestResult!.headerHeight).toBe(1000);
        // Logo en su posición inferior de reposo
        expect(latestResult!.logoTranslateY).toBe(-0);
        expect(latestResult!.carouselInteractive).toBe(false);
    });

    it('sincroniza la progresión hacia arriba y recorta el cabecero al hacer scroll', async () => {
        await mount(<HookTester />);

        // Simular scroll hacia abajo superando el máximo
        await act(async () => {
            Object.defineProperty(window, 'scrollY', { value: 800, configurable: true, writable: true });
            window.dispatchEvent(new Event('scroll'));
            await new Promise((resolve) => setTimeout(resolve, 50));
        });

        expect(latestResult).not.toBeNull();
        expect(latestResult!.progress).toBe(1);
        // El cabecero se mantiene a pantalla completa
        expect(latestResult!.headerHeight).toBe(1000);
        // El logo asciende hasta el límite de 33vh
        expect(latestResult!.logoTranslateY).toBeLessThan(-100);
        expect(latestResult!.logoScale).toBe(1);
        expect(latestResult!.carouselInteractive).toBe(true);
    });
});

