import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HeroTrailerViewModel } from '../HeroTrailerViewModel';
import type { CarouselSlide } from '../../../data/models';
import type { ApiService } from '../../../data/api/ApiService';

describe('HeroTrailerViewModel', () => {
    let mockApiService: ApiService;
    let vm: HeroTrailerViewModel;
    let resolveTrailerMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.useFakeTimers();
        resolveTrailerMock = vi.fn();
        mockApiService = {
            trailers: {
                resolveTrailerSource: resolveTrailerMock,
                getLocalTrailers: vi.fn(),
                clearTrailerCache: vi.fn()
            }
        } as unknown as ApiService;

        vm = new HeroTrailerViewModel(mockApiService, { delayMs: 1000, transitionDurationMs: 200 });
    });

    it('inicia con estado idle, silenciado y sin trailer activo', () => {
        expect(vm.state.value).toBe('idle');
        expect(vm.isMuted.value).toBe(true);
        expect(vm.isPaused.value).toBe(false);
        expect(vm.hasTrailer.value).toBe(false);
        expect(vm.trailerSource.value).toBeNull();
    });

    it('permanece en idle si el slide no tiene trailer disponible', () => {
        const slideNoTrailer: CarouselSlide = {
            type: 'new',
            id: 'item-1',
            kind: 'movie',
            title: 'Sin Trailer',
            season: null,
            episode: null,
            episodeTitle: '',
            year: 2024,
            progress: null,
            remaining: '',
            backdrop: '',
            poster: '',
            hasTrailer: false
        };

        vm.onSlideChanged(slideNoTrailer);
        expect(vm.hasTrailer.value).toBe(false);
        expect(resolveTrailerMock).not.toHaveBeenCalled();

        vi.advanceTimersByTime(2000);
        expect(vm.state.value).toBe('idle');
    });

    it('inicia transición tras el temporizador cuando hay trailer disponible', async () => {
        const slideWithTrailer: CarouselSlide = {
            type: 'new',
            id: 'item-trailer',
            kind: 'movie',
            title: 'Con Trailer',
            season: null,
            episode: null,
            episodeTitle: '',
            year: 2024,
            progress: null,
            remaining: '',
            backdrop: '',
            poster: '',
            hasTrailer: true
        };

        resolveTrailerMock.mockResolvedValueOnce({
            type: 'video',
            url: 'https://example.com/trailer.mp4'
        });

        vm.onSlideChanged(slideWithTrailer);
        expect(vm.hasTrailer.value).toBe(true);

        // Esperamos a que la promesa de resolución resuelva
        await Promise.resolve();
        expect(vm.trailerSource.value).toEqual({
            type: 'video',
            url: 'https://example.com/trailer.mp4'
        });

        // Aún antes del delay está en idle
        vi.advanceTimersByTime(500);
        expect(vm.state.value).toBe('idle');

        // Cumplido el delay (1000ms) pasa a transitioning
        vi.advanceTimersByTime(500);
        expect(vm.state.value).toBe('transitioning');

        // Cumplida la duración de la transición (200ms) pasa a playing
        vi.advanceTimersByTime(200);
        expect(vm.state.value).toBe('playing');
    });

    it('cancela temporizadores y vuelve a idle si se cambia de slide antes de que arranque', async () => {
        const slide1: CarouselSlide = {
            type: 'new',
            id: 'item-1',
            kind: 'movie',
            title: 'Peli 1',
            season: null,
            episode: null,
            episodeTitle: '',
            year: 2024,
            progress: null,
            remaining: '',
            backdrop: '',
            poster: '',
            hasTrailer: true
        };

        resolveTrailerMock.mockResolvedValue({
            type: 'video',
            url: 'https://example.com/trailer1.mp4'
        });

        vm.onSlideChanged(slide1);
        await Promise.resolve();

        vi.advanceTimersByTime(500);
        expect(vm.state.value).toBe('idle');

        // Cambiamos a slide sin trailer a mitad del temporizador
        const slide2: CarouselSlide = {
            type: 'new',
            id: 'item-2',
            kind: 'movie',
            title: 'Peli 2',
            season: null,
            episode: null,
            episodeTitle: '',
            year: 2024,
            progress: null,
            remaining: '',
            backdrop: '',
            poster: '',
            hasTrailer: false
        };

        vm.onSlideChanged(slide2);
        vi.advanceTimersByTime(1000);

        expect(vm.state.value).toBe('idle');
        expect(vm.activeSlideId.value).toBe('item-2');
    });

    it('vuelve a idle si se llama a onError', async () => {
        const slide: CarouselSlide = {
            type: 'new',
            id: 'item-err',
            kind: 'movie',
            title: 'Fallo',
            season: null,
            episode: null,
            episodeTitle: '',
            year: 2024,
            progress: null,
            remaining: '',
            backdrop: '',
            poster: '',
            hasTrailer: true
        };

        resolveTrailerMock.mockResolvedValueOnce({
            type: 'video',
            url: 'https://example.com/bad.mp4'
        });

        vm.onSlideChanged(slide);
        await Promise.resolve();
        vi.advanceTimersByTime(1200);
        expect(vm.state.value).toBe('playing');

        vm.onError(new Error('Video decode error'));
        expect(vm.state.value).toBe('idle');
    });

    it('pausa y reanuda según visibilidad en pantalla', () => {
        expect(vm.isPaused.value).toBe(false);
        vm.onHeroOffscreen(true);
        expect(vm.isPaused.value).toBe(true);
        vm.onHeroOffscreen(false);
        expect(vm.isPaused.value).toBe(false);
    });

    it('permite alternar el silencio con toggleMute y setMuted', () => {
        expect(vm.isMuted.value).toBe(true);
        vm.toggleMute();
        expect(vm.isMuted.value).toBe(false);
        vm.toggleMute();
        expect(vm.isMuted.value).toBe(true);

        vm.setMuted(false);
        expect(vm.isMuted.value).toBe(false);
    });

    it('reinicia a idle inmediatamente con reset', async () => {
        const slide: CarouselSlide = {
            type: 'new',
            id: 'item-reset',
            kind: 'movie',
            title: 'Reset',
            season: null,
            episode: null,
            episodeTitle: '',
            year: 2024,
            progress: null,
            remaining: '',
            backdrop: '',
            poster: '',
            hasTrailer: true
        };

        resolveTrailerMock.mockResolvedValueOnce({
            type: 'video',
            url: 'https://example.com/reset.mp4'
        });

        vm.onSlideChanged(slide);
        await Promise.resolve();
        vi.advanceTimersByTime(1200);
        expect(vm.state.value).toBe('playing');

        vm.reset();
        expect(vm.state.value).toBe('idle');
    });
});
