import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Nav } from '../Nav';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../domain/bridge/useSession', () => ({
    useSession: () => ({
        session: {
            serverUrl: 'http://srv',
            userId: 'u1',
            accessToken: 'tok',
            displayName: 'Ruben'
        },
        logout: () => undefined
    })
}));

vi.mock('../../../../domain/api', () => ({
    avatarUrl: () => 'http://srv/Users/u1/Images/Primary'
}));

vi.mock('../../../../data/api/theme', () => ({
    getServerThemePrefs: () => Promise.resolve(null),
    saveServerThemePrefs: () => Promise.resolve()
}));

vi.mock('../../toast/ToastProvider', () => ({ useToast: () => () => undefined }));

let root: Root | null = null;
let host: HTMLElement | null = null;

function mount(ui: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    return act(async () => {
        root?.render(ui);
    });
}

describe('Nav (Menú superior minimalista con animaciones)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.documentElement.className = 'layout-desktop';
        Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        vi.useRealTimers();
        window.scrollY = 0;
        document.documentElement.className = '';
    });

    it('en reposo superior (scroll 0), muestra marca y enlaces sin raya inferior', async () => {
        await mount(<Nav navigate={() => undefined} />);

        const navContainer = host?.querySelector('[data-jfp-nav]') as HTMLElement;
        expect(navContainer).not.toBeNull();
        expect(navContainer.style.borderBottom).toBe('');

        const brandText = host?.querySelector('[data-jfp-brand-text]') as HTMLElement;
        expect(brandText).not.toBeNull();
        expect(brandText.style.maxWidth).toBe('120px');
        expect(brandText.style.opacity).toBe('1');

        const navLinks = host?.querySelector('[data-jfp-nav-links]') as HTMLElement;
        expect(navLinks).not.toBeNull();
        expect(navLinks.style.maxWidth).toBe('500px');
        expect(navLinks.style.opacity).toBe('1');
    });

    it('al desplazarse (scroll activo), oculta los enlaces y el texto de la marca', async () => {
        await mount(<Nav navigate={() => undefined} />);

        act(() => {
            window.scrollY = 150;
            window.dispatchEvent(new Event('scroll'));
        });

        const navContainer = host?.querySelector('[data-jfp-nav]') as HTMLElement;
        expect(navContainer.style.borderBottom).toBe('');

        const brandText = host?.querySelector('[data-jfp-brand-text]') as HTMLElement;
        expect(brandText.style.maxWidth).toBe('0px');
        expect(brandText.style.opacity).toBe('0');

        const navLinks = host?.querySelector('[data-jfp-nav-links]') as HTMLElement;
        expect(navLinks.style.maxWidth).toBe('0px');
        expect(navLinks.style.opacity).toBe('0');
    });

    it('al detener el desplazamiento, reaparece el texto de la marca pero los enlaces siguen ocultos', async () => {
        await mount(<Nav navigate={() => undefined} />);

        act(() => {
            window.scrollY = 150;
            window.dispatchEvent(new Event('scroll'));
        });

        // Completar el tiempo de inactividad de scroll (350ms)
        act(() => {
            vi.advanceTimersByTime(360);
        });

        const brandText = host?.querySelector('[data-jfp-brand-text]') as HTMLElement;
        expect(brandText.style.maxWidth).toBe('120px');
        expect(brandText.style.opacity).toBe('1');

        const navLinks = host?.querySelector('[data-jfp-nav-links]') as HTMLElement;
        expect(navLinks.style.maxWidth).toBe('0px');
        expect(navLinks.style.opacity).toBe('0');
    });

    it('al pasar el ratón (hover) en scroll, los enlaces se despliegan; al salir, se repliegan', async () => {
        await mount(<Nav navigate={() => undefined} />);

        act(() => {
            window.scrollY = 150;
            window.dispatchEvent(new Event('scroll'));
            vi.advanceTimersByTime(360);
        });

        const navLinks = host?.querySelector('[data-jfp-nav-links]') as HTMLElement;
        expect(navLinks.style.maxWidth).toBe('0px');

        // Entrar con el ratón
        const hoverArea = host?.querySelector('[data-jfp-nav] > div') as HTMLElement;
        act(() => {
            hoverArea.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        });

        expect(navLinks.style.maxWidth).toBe('500px');
        expect(navLinks.style.opacity).toBe('1');

        // Salir con el ratón
        act(() => {
            hoverArea.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        });

        // Esperar tolerancia de salida (180ms)
        act(() => {
            vi.advanceTimersByTime(200);
        });

        expect(navLinks.style.maxWidth).toBe('0px');
        expect(navLinks.style.opacity).toBe('0');
    });

    it('gestiona migas de pan (breadcrumb) replegándose en scroll y desplegándose en reposo/hover', async () => {
        const crumbs = [
            { label: 'Series' },
            { label: 'Breaking Bad' }
        ];

        await mount(<Nav navigate={() => undefined} breadcrumb={crumbs} />);

        const crumbLinks = host?.querySelector('[data-jfp-nav-links]') as HTMLElement;
        expect(crumbLinks).not.toBeNull();
        expect(crumbLinks.style.maxWidth).toBe('600px');
        expect(crumbLinks.style.opacity).toBe('1');

        act(() => {
            window.scrollY = 100;
            window.dispatchEvent(new Event('scroll'));
        });

        expect(crumbLinks.style.maxWidth).toBe('0px');
        expect(crumbLinks.style.opacity).toBe('0');
    });

    it('en móvil (touch) no tiene raya inferior y contrae el texto en scroll', async () => {
        document.documentElement.className = 'layout-mobile';
        await mount(<Nav navigate={() => undefined} />);

        const navContainer = host?.querySelector('[data-jfp-nav]') as HTMLElement;
        expect(navContainer.style.borderBottom).toBe('');

        const brandText = host?.querySelector('[data-jfp-brand-text]') as HTMLElement;
        expect(brandText.style.maxWidth).toBe('100px');

        act(() => {
            window.scrollY = 100;
            window.dispatchEvent(new Event('scroll'));
        });

        expect(brandText.style.maxWidth).toBe('0px');

        act(() => {
            vi.advanceTimersByTime(360);
        });

        expect(brandText.style.maxWidth).toBe('100px');
    });
});
