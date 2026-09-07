import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const mockPlay = vi.fn();
const mockPrewarm = vi.fn();

vi.mock('../../player/PlayerProvider', () => ({
    usePlayer: () => ({
        play: mockPlay,
        prewarm: mockPrewarm
    })
}));

vi.mock('../../toast/ToastProvider', () => ({
    useToast: () => vi.fn()
}));

vi.mock('../../../../domain/bridge/useSession', () => ({
    useSession: () => ({ session: { accessToken: 'token123' } })
}));

import { CwCard } from '../CwCard';
import type { CarouselSlide } from '../../../../domain/models';

let root: Root | null = null;
let host: HTMLElement | null = null;
let navTarget: unknown = null;

const mockNavigate = (to: unknown) => {
    navTarget = to;
};

const showSlide: CarouselSlide = {
    type: 'continue',
    id: 'series_123',
    kind: 'show',
    title: 'Demon Slayer',
    season: 1,
    episode: 3,
    episodeTitle: 'Sabito y Makomo',
    year: 2019,
    progress: 0.45,
    remaining: '12 min',
    backdrop: 'http://img/backdrop.jpg',
    poster: 'http://img/poster.jpg',
    logo: 'http://img/logo.png',
    jfEpisodeId: 'ep_sabito_makomo',
    positionTicks: 4500000
};

const movieSlide: CarouselSlide = {
    type: 'continue',
    id: 'movie_456',
    kind: 'movie',
    title: 'The Batman',
    season: null,
    episode: null,
    episodeTitle: '',
    year: 2022,
    progress: 0.7,
    remaining: '35 min',
    backdrop: 'http://img/batman_bd.jpg',
    poster: 'http://img/batman_p.jpg',
    logo: 'http://img/batman_logo.png',
    jfEpisodeId: 'movie_456',
    positionTicks: 7000000
};

function mount(ui: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    return act(async () => {
        root?.render(ui);
    });
}

describe('CwCard', () => {
    beforeEach(() => {
        mockPlay.mockClear();
        mockPrewarm.mockClear();
        navTarget = null;
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
    });

    test('pulsar el botón central de play arranca la reproducción con sus ticks', async () => {
        await mount(<CwCard slide={showSlide} navigate={mockNavigate} />);

        const playBtn = host?.querySelector('.jfp-playover svg');
        expect(playBtn).toBeTruthy();

        await act(async () => {
            playBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(mockPlay).toHaveBeenCalledTimes(1);
        expect(mockPlay).toHaveBeenCalledWith({
            itemId: 'ep_sabito_makomo',
            title: 'Demon Slayer · T1 E03 — Sabito y Makomo',
            startTicks: 4500000
        });
        expect(navTarget).toBeNull();
    });

    test('pulsar el logo navega a la ficha de la serie (show), no a la del capítulo', async () => {
        await mount(<CwCard slide={showSlide} navigate={mockNavigate} />);

        const logoBtn = host?.querySelector('.jfp-poster-logo-btn');
        expect(logoBtn).toBeTruthy();

        await act(async () => {
            logoBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(mockPlay).not.toHaveBeenCalled();
        expect(navTarget).toEqual({
            page: 'show',
            showId: 'series_123'
        });
    });

    test('para películas, pulsar el logo navega a la ficha de la película', async () => {
        await mount(<CwCard slide={movieSlide} navigate={mockNavigate} />);

        const logoBtn = host?.querySelector('.jfp-poster-logo-btn');
        expect(logoBtn).toBeTruthy();

        await act(async () => {
            logoBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(mockPlay).not.toHaveBeenCalled();
        expect(navTarget).toEqual({
            page: 'movie',
            movieId: 'movie_456'
        });
    });

    test('pulsar el subtítulo inferior navega a la ficha del episodio concreto', async () => {
        await mount(<CwCard slide={showSlide} navigate={mockNavigate} />);

        const captionEl = host?.querySelector('[title*="T1 · E3"]');
        expect(captionEl).toBeTruthy();

        await act(async () => {
            captionEl?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(mockPlay).not.toHaveBeenCalled();
        expect(navTarget).toEqual({
            page: 'episode',
            showId: 'series_123',
            seasonN: 1,
            epN: 3
        });
    });

    test('hacer clic general en el cuerpo del póster también reproduce el contenido', async () => {
        await mount(<CwCard slide={movieSlide} navigate={mockNavigate} />);

        const posterShell = host?.firstElementChild as HTMLElement;
        expect(posterShell).toBeTruthy();

        await act(async () => {
            posterShell?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(mockPlay).toHaveBeenCalledTimes(1);
        expect(mockPlay).toHaveBeenCalledWith({
            itemId: 'movie_456',
            title: 'The Batman',
            startTicks: 7000000
        });
    });

    test('renderiza la tarjeta en formato apaisado 16:9 con su barra de progreso', async () => {
        await mount(<CwCard slide={showSlide} navigate={mockNavigate} />);

        const cardM3 = host?.querySelector('.jfp-card-m3') as HTMLElement;
        expect(cardM3).toBeTruthy();
        expect(cardM3.style.aspectRatio).toBe('16/9');

        // Barra de progreso presente con el porcentaje adecuado
        const progressBar = host?.querySelector('.jfp-card-progress') as HTMLElement;
        expect(progressBar).toBeTruthy();
    });

    test('usa backdrop (o poster como fallback) de la serie como imagen de portada', async () => {
        await mount(<CwCard slide={showSlide} navigate={mockNavigate} />);

        const coverDiv = host?.querySelector('.jfp-card-m3 div[style*="background-image"]') as HTMLElement;
        expect(coverDiv).toBeTruthy();
        expect(coverDiv.style.backgroundImage).toContain('backdrop.jpg');
    });

    test('usa poster de la serie si no hay backdrop disponible', async () => {
        const slideWithoutBackdrop: CarouselSlide = {
            ...showSlide,
            backdrop: ''
        };
        await mount(<CwCard slide={slideWithoutBackdrop} navigate={mockNavigate} />);

        const coverDiv = host?.querySelector('.jfp-card-m3 div[style*="background-image"]') as HTMLElement;
        expect(coverDiv).toBeTruthy();
        expect(coverDiv.style.backgroundImage).toContain('poster.jpg');
    });

    test('muestra el tiempo restante como badge en la tarjeta', async () => {
        await mount(<CwCard slide={showSlide} navigate={mockNavigate} />);

        const remainingBadge = host?.querySelector('.jfp-cw-remaining');
        expect(remainingBadge).toBeTruthy();
        expect(remainingBadge?.textContent).toContain('12 min');
    });

    test('alterna entre tiempo restante y hora de fin al hacer clic en el indicador sin fondo', async () => {
        await mount(<CwCard slide={showSlide} navigate={mockNavigate} />);

        const remainingBadge = host?.querySelector('.jfp-cw-remaining') as HTMLElement;
        expect(remainingBadge).toBeTruthy();
        expect(remainingBadge.textContent).toContain('12 min');

        await act(async () => {
            remainingBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        // Al hacer clic conmuta a la hora de fin sin disparar el play de la tarjeta
        expect(mockPlay).not.toHaveBeenCalled();
        expect(remainingBadge.textContent).not.toBe('12 min');

        // Al volver a hacer clic vuelve al tiempo restante
        await act(async () => {
            remainingBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        expect(remainingBadge.textContent).toBe('12 min');
    });

    test('limita el título y subtítulo estrictamente a una sola línea con nowrap y overflow hidden', async () => {
        const longTitleSlide: CarouselSlide = {
            ...showSlide,
            title: 'La guerra de las galaxias. Episodio I: La amenaza fantasma',
            episodeTitle: 'Capítulo larguísimo que desborda el ancho completo de la tarjeta'
        };
        await mount(<CwCard slide={longTitleSlide} navigate={mockNavigate} />);

        const titleSpan = host?.querySelector('.jfp-poster-logo-btn span') as HTMLElement;
        expect(titleSpan).toBeTruthy();
        expect(titleSpan.style.whiteSpace).toBe('nowrap');

        const titleCont = host?.querySelector('.jfp-poster-logo-btn > div') as HTMLElement;
        expect(titleCont).toBeTruthy();
        expect(titleCont.style.overflow).toBe('hidden');
        expect(titleCont.style.whiteSpace).toBe('nowrap');
        expect(titleCont.style.height).toBe('20px');
    });
});
