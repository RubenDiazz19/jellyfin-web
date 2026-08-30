import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HeroFrame, heroHeight } from '../DetailHero';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../data/api/theme', () => ({
    getServerThemePrefs: () => Promise.resolve(null),
    saveServerThemePrefs: () => Promise.resolve()
}));

let root: Root | null = null;
let host: HTMLElement | null = null;

function render(ui: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    return act(async () => {
        root?.render(ui);
    });
}

describe('HeroFrame', () => {
    let originalInnerHeight: number;

    beforeEach(() => {
        document.documentElement.className = '';
        originalInnerHeight = window.innerHeight;
        Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
        Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, configurable: true });
    });

    it('renderiza el contenedor hero fijo, el nav y el espaciador en reposo (scroll 0)', async () => {
        await render(
            <HeroFrame
                backdrop='https://example.com/backdrop.jpg'
                nav={<div data-testid='nav-bar'>Nav</div>}
                footer={<div data-testid='scroll-hint'>Detalles</div>}
            >
                <div data-testid='hero-title'>Título de prueba</div>
            </HeroFrame>
        );

        expect(host?.querySelector('[data-testid="nav-bar"]')).toBeTruthy();
        expect(host?.querySelector('[data-testid="hero-title"]')).toBeTruthy();
        expect(host?.querySelector('[data-testid="scroll-hint"]')).toBeTruthy();

        const section = host?.querySelector('section');
        expect(section).toBeTruthy();
        expect(section?.style.position).toBe('fixed');
        expect(section?.style.opacity).toBe('1');

        const content = host?.querySelector('.jfp-hero-content') as HTMLElement | null;
        expect(content).toBeTruthy();
        expect(content?.style.opacity).toBe('1');
    });

    it('interpola la opacidad del contenido y del fondo con el scroll', async () => {
        await render(
            <HeroFrame
                backdrop='https://example.com/backdrop.jpg'
                nav={<div data-testid='nav-bar'>Nav</div>}
                footer={<div data-testid='scroll-hint'>Detalles</div>}
            >
                <div data-testid='hero-title'>Título de prueba</div>
            </HeroFrame>
        );

        await act(async () => {
            window.scrollY = 450;
            window.dispatchEvent(new Event('scroll'));
            await new Promise((resolve) => requestAnimationFrame(resolve));
        });

        const section = host?.querySelector('section');
        const content = host?.querySelector('.jfp-hero-content') as HTMLElement | null;

        expect(Number(section?.style.opacity)).toBeLessThan(1);
        expect(Number(content?.style.opacity)).toBeLessThan(0.5);
    });

    it('calcula la altura adecuada en función de si es táctil o no', () => {
        expect(heroHeight(false)).toBe('100vh');
        expect(heroHeight(true)).toBe('var(--jfp-viewport-h, 100vh)');
    });
});
