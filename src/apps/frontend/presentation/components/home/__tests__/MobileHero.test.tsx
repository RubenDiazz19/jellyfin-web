// MobileHero: pantalla completa, contenido en flujo (nada superpuesto) y la
// imagen que toca según el formato de la pantalla.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CarouselSlide } from '../../../../domain/models';
import { MobileThemeProvider } from '../../../theme/MobileThemeProvider';
import { MobileHero } from '../MobileHero';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// El sync remoto del tema arrastra la cadena legacy al entorno de test.
vi.mock('../../../../data/api/theme', () => ({
    getServerThemePrefs: () => Promise.resolve(null),
    saveServerThemePrefs: () => Promise.resolve()
}));

function slide(over: Partial<CarouselSlide> = {}): CarouselSlide {
    return {
        type: 'continue', id: 'batman', kind: 'movie', title: 'The Batman',
        season: null, episode: null, episodeTitle: '', year: 2022,
        progress: 0.4, remaining: '1 h 7 min',
        backdrop: 'http://srv/backdrop.jpg', poster: 'http://srv/poster.jpg',
        ...over
    };
}

const SLIDES = [slide(), slide({ id: 'demon', title: 'Demon Slayer' })];

let root: Root | null = null;
let host: HTMLElement | null = null;
let routes: unknown[] = [];

function render(tablet: boolean, slides = SLIDES) {
    routes = [];
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root?.render(
            <MobileThemeProvider>
                <MobileHero
                    slides={slides} idx={0} tablet={tablet}
                    goSlide={() => undefined} onPlay={() => undefined}
                    navigate={(to) => { routes.push(to); }}
                />
            </MobileThemeProvider>
        );
    });
}

/** Pulsa el primer botón cuyo texto contenga `text`. */
function tap(text: string) {
    const btn = [...(host?.querySelectorAll('button') ?? [])]
        .find((b) => (b.textContent ?? '').includes(text));
    expect(btn, `no hay botón con «${text}»`).toBeDefined();
    act(() => { (btn as HTMLElement).click(); });
}

/** true si `b` va detrás de `a` en el documento. */
function precede(a: Element, b: Element): boolean {
    return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('MobileHero', () => {
    beforeEach(() => {
        document.documentElement.className = 'layout-mobile';
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        document.documentElement.className = '';
        document.getElementById('jfp-m3-tokens')?.remove();
    });

    it('ocupa el alto completo del viewport', () => {
        render(false);
        const section = host?.querySelector('section');
        expect(section?.style.height).toBe('var(--jfp-viewport-h, 100vh)');
    });

    it('respeta el orden título → dato → play → puntos, todo en flujo', () => {
        render(false);
        const title = host?.querySelector('h1');
        const play = host?.querySelector('button[aria-label="Reproducir"]');
        const dot = host?.querySelector('button[aria-label="Slide 2"]');
        expect(title).not.toBeNull();
        expect(play).not.toBeNull();
        expect(dot).not.toBeNull();
        expect(precede(title as Element, play as Element)).toBe(true);
        expect(precede(play as Element, dot as Element)).toBe(true);

        // Nada del bloque va en absoluto: si se solapaban era por eso.
        const column = (play as HTMLElement).closest('div[style*="flex-direction: column"]');
        expect((column as HTMLElement).style.position).toBe('');
        expect(((dot as HTMLElement).parentElement as HTMLElement).style.position).toBe('');
    });

    it('deja hueco para la píldora de navegación bajo el contenido', () => {
        render(false);
        const content = host?.querySelector('section > div:last-of-type') as HTMLElement;
        expect(content.style.padding).toContain('--jfp-nav-bottom');
    });

    it('móvil usa el póster y tablet el backdrop', () => {
        render(false);
        expect(host?.innerHTML).toContain('poster.jpg');

        act(() => { root?.unmount(); });
        host?.remove();
        document.documentElement.className = 'layout-mobile layout-tablet';
        render(true);
        expect(host?.innerHTML).toContain('backdrop.jpg');
    });

    it('sin slides no pinta nada', () => {
        render(false, []);
        expect(host?.querySelector('section')).toBeNull();
    });

    // Las tres navegaciones que solo existían en el hero de escritorio: en
    // táctil el logo era un <img> suelto y el T·E, texto plano.
    it('el título lleva a la ficha de la película', () => {
        render(false);
        tap('The Batman');
        expect(routes).toEqual([{ page: 'movie', movieId: 'batman' }]);
    });

    it('el logo lleva a la ficha de la serie', () => {
        render(false, [slide({
            id: 'demon', kind: 'show', title: 'Demon Slayer', logo: 'http://srv/logo.png'
        })]);
        const btn = host?.querySelector('button[aria-label="Demon Slayer"]');
        expect(btn?.querySelector('img')).not.toBeNull();
        act(() => { (btn as HTMLElement).click(); });
        expect(routes).toEqual([{ page: 'show', showId: 'demon' }]);
    });

    it('la temporada y el episodio llevan a sus fichas', () => {
        render(false, [slide({
            id: 'demon', kind: 'show', title: 'Demon Slayer',
            season: 2, episode: 6, episodeTitle: 'Inicio de semestre'
        })]);

        tap('T2');
        expect(routes).toEqual([{ page: 'season', showId: 'demon', seasonN: 2 }]);

        routes = [];
        tap('E6');
        expect(routes).toEqual([
            { page: 'episode', showId: 'demon', seasonN: 2, epN: 6 }
        ]);
    });

    it('sin temporada la línea de datos sigue siendo texto plano', () => {
        render(false, [slide({ type: 'new', kind: 'movie', year: 2025 })]);
        const labels = [...(host?.querySelectorAll('button') ?? [])]
            .map((b) => b.getAttribute('aria-label'));
        // Solo el título y el play: nada que navegar en una novedad.
        expect(labels).toEqual(['The Batman', 'Reproducir']);
    });
});
