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
        // Indicador de scroll (flecha) 100% visible
        expect(latestResult!.scrollHintOpacity).toBe(1);
        // Carrusel oculto y desplazado hacia abajo
        expect(latestResult!.carouselOpacity).toBe(0);
        expect(latestResult!.carouselTranslateY).toBeGreaterThan(0);
        // Fondo sin degradado negro (0% opacidad)
        expect(latestResult!.gradientOpacity).toBe(0);
        // Logo en su posición inferior de reposo
        expect(latestResult!.logoTranslateY).toBe(0);
        expect(latestResult!.carouselInteractive).toBe(false);
    });

    it('sincroniza la progresión hacia arriba y activa el carrusel al hacer scroll', async () => {
        await mount(<HookTester />);

        // Simular scroll hacia abajo (500px, completando el umbral)
        await act(async () => {
            Object.defineProperty(window, 'scrollY', { value: 600, configurable: true, writable: true });
            window.dispatchEvent(new Event('scroll'));
            // Esperar animación/raf
            await new Promise((resolve) => setTimeout(resolve, 50));
        });

        expect(latestResult).not.toBeNull();
        expect(latestResult!.progress).toBe(1);
        // Indicador de flecha desvanecido
        expect(latestResult!.scrollHintOpacity).toBe(0);
        // Carrusel visible y en su posición final
        expect(latestResult!.carouselOpacity).toBe(1);
        expect(latestResult!.carouselTranslateY).toBe(0);
        // Degradado negro translúcido al 100%
        expect(latestResult!.gradientOpacity).toBe(1);
        // Logo ha ascendido hacia la parte superior
        expect(latestResult!.logoTranslateY).toBeLessThan(-200);
        expect(latestResult!.carouselInteractive).toBe(true);
    });
});
