import { describe, expect, test, vi } from 'vitest';
import { formatEpisodeCode, HomeViewModel } from '../HomeViewModel';
import type { ApiService } from '../../../data/api/ApiService';
import type { CarouselSlide, CatalogItem, ListEntry } from '../../../data/models';

// El singleton apiService arrastra ServerConnections; los tests construyen
// sus propios VMs con mocks, así que el módulo real se sustituye entero.
vi.mock('../../../data/api/ApiService', () => ({ apiService: {} }));

const slide: CarouselSlide = {
    type: 'continue',
    id: 's1',
    kind: 'show',
    title: 'Dandelion',
    season: 1,
    episode: 1,
    episodeTitle: 'Ep 1',
    year: 2024,
    progress: 0.5,
    remaining: '20 min',
    backdrop: '',
    poster: ''
};
const resumeItem: CarouselSlide = { ...slide, id: 'cw1', title: 'Continuar' };
const recentItem: CatalogItem = { id: 'r1', title: 'Reciente', kind: 'show', year: 2024 };
const colItem: ListEntry = { id: 'c1', name: 'Saga' };
const playedItem: CatalogItem = { id: 'p1', title: 'Más Visto', kind: 'movie', year: 2022 };

function mockApi(overrides: {
    carousel?: () => Promise<unknown>;
    resume?: () => Promise<unknown>;
    latest?: () => Promise<unknown>;
    collections?: () => Promise<unknown>;
    played?: () => Promise<unknown>;
    shows?: () => Promise<unknown>;
    movies?: () => Promise<unknown>;
} = {}): ApiService {
    return {
        catalog: {
            getHomeCarousel: vi.fn(overrides.carousel ?? (() => Promise.resolve([slide]))),
            getResume: vi.fn(overrides.resume ?? (() => Promise.resolve([resumeItem]))),
            getLatest: vi.fn(overrides.latest ?? (() => Promise.resolve([recentItem]))),
            getCollections: vi.fn(overrides.collections ?? (() => Promise.resolve([colItem]))),
            getMostPlayed: vi.fn(overrides.played ?? (() => Promise.resolve([playedItem]))),
            getShows: vi.fn(overrides.shows ?? (() => Promise.resolve([]))),
            getMovies: vi.fn(overrides.movies ?? (() => Promise.resolve([])))
        }
    } as unknown as ApiService;
}

describe('HomeViewModel', () => {
    test('load() rellena carrusel y filas curadas', async () => {
        const vm = new HomeViewModel(mockApi());
        await vm.load();
        // El carrusel se resuelve en un then() paralelo; drena la microtask.
        await Promise.resolve();

        expect(vm.slides.value).toEqual([slide]);
        expect(vm.continueWatching.value).toEqual([resumeItem]);
        expect(vm.recentlyAdded.value).toEqual([recentItem]);
        expect(vm.collections.value).toEqual([colItem]);
        expect(vm.mostPlayed.value).toEqual([playedItem]);
        expect(vm.heroLoading.value).toBe(false);
        expect(vm.rowsLoading.value).toBe(false);
        expect(vm.heroReady.value).toBe(true);
        expect(vm.rowsReady.value).toBe(true);
    });

    test('load() ya no llama a getShows() ni getMovies()', async () => {
        const api = mockApi();
        const vm = new HomeViewModel(api);
        await vm.load();

        expect(api.catalog.getShows).not.toHaveBeenCalled();
        expect(api.catalog.getMovies).not.toHaveBeenCalled();
    });

    test('si el hero falla, las filas curadas siguen cargando', async () => {
        const vm = new HomeViewModel(mockApi({
            carousel: () => Promise.reject(new Error('hero caído'))
        }));
        await vm.load();
        await Promise.resolve();

        expect(vm.slides.value).toEqual([]);
        expect(vm.continueWatching.value).toEqual([resumeItem]);
        expect(vm.heroReady.value).toBe(true);
        expect(vm.rowsReady.value).toBe(true);
    });

    test('si una fila falla, las demás no se bloquean y la fallida queda vacía', async () => {
        const vm = new HomeViewModel(mockApi({
            resume: () => Promise.reject(new Error('error resume')),
            played: () => Promise.reject(new Error('error played'))
        }));
        await vm.load();

        expect(vm.continueWatching.value).toEqual([]);
        expect(vm.recentlyAdded.value).toEqual([recentItem]);
        expect(vm.collections.value).toEqual([colItem]);
        expect(vm.mostPlayed.value).toEqual([]);
        expect(vm.rowsReady.value).toBe(true);
        expect(vm.rowsLoading.value).toBe(false);
    });

    test('una carga antigua no pisa a la más reciente', async () => {
        let resolveOld!: (v: unknown) => void;
        const old = new Promise((r) => { resolveOld = r; });
        const api = mockApi();
        const getLatest = api.catalog.getLatest as ReturnType<typeof vi.fn>;
        getLatest
            .mockImplementationOnce(() => old)
            .mockImplementationOnce(() => Promise.resolve([recentItem]));

        const vm = new HomeViewModel(api);
        const first = vm.load();
        await vm.load();
        resolveOld([{ id: 'viejo', title: 'stale', kind: 'show', year: 2020 }]);
        await first;

        expect(vm.recentlyAdded.value).toEqual([recentItem]);
    });

    test('exclusión mutua: Novedades omite elementos presentes en Hero o en Seguir viendo', async () => {
        const itemInHero: CatalogItem = { id: 's1', title: 'En Hero', kind: 'show', year: 2024 };
        const itemInCw: CatalogItem = { id: 'cw1', title: 'En Seguir viendo', kind: 'movie', year: 2023 };
        const itemFresh: CatalogItem = { id: 'fresh1', title: 'Solo Novedad', kind: 'show', year: 2024 };

        const vm = new HomeViewModel(mockApi({
            carousel: () => Promise.resolve([slide]),
            resume: () => Promise.resolve([resumeItem]),
            latest: () => Promise.resolve([itemInHero, itemInCw, itemFresh])
        }));

        await vm.load();
        await Promise.resolve();

        expect(vm.slides.value.map((s) => s.id)).toEqual(['s1']);
        expect(vm.continueWatching.value.map((s) => s.id)).toEqual(['cw1']);
        expect(vm.recentlyAdded.value).toEqual([itemFresh]);
    });

    test('exclusión mutua: si el Hero tarda más en resolver, Novedades se re-filtra reactivamente', async () => {
        let resolveHero!: (v: unknown) => void;
        const heroPromise = new Promise((r) => { resolveHero = r; });
        const itemInHero: CatalogItem = { id: 's1', title: 'En Hero', kind: 'show', year: 2024 };
        const itemFresh: CatalogItem = { id: 'fresh1', title: 'Solo Novedad', kind: 'show', year: 2024 };

        const vm = new HomeViewModel(mockApi({
            carousel: () => heroPromise,
            latest: () => Promise.resolve([itemInHero, itemFresh])
        }));

        const loadPromise = vm.load();
        while (!vm.rowsReady.value) {
            await Promise.resolve();
        }
        expect(vm.recentlyAdded.value.map((i) => i.id)).toContain('s1');

        resolveHero([slide]);
        await loadPromise;
        await Promise.resolve();

        expect(vm.recentlyAdded.value).toEqual([itemFresh]);
    });

    describe('getPlayable', () => {
        test('resuelve películas directamente', async () => {
            const vm = new HomeViewModel(mockApi());
            const movieSlide: CarouselSlide = {
                ...slide,
                id: 'm1',
                kind: 'movie',
                title: 'The Batman',
                jfEpisodeId: 'm1',
                positionTicks: 12345
            };

            const playable = await vm.getPlayable(movieSlide);
            expect(playable).toEqual({
                itemId: 'm1',
                title: 'The Batman',
                startTicks: 12345
            });
        });

        test('resuelve series con jfEpisodeId conocido formateando temporada y capítulo', async () => {
            const vm = new HomeViewModel(mockApi());
            const cwSlide: CarouselSlide = {
                ...slide,
                id: 'show1',
                kind: 'show',
                title: 'Kimetsu no Yaiba',
                season: 1,
                episode: 4,
                episodeTitle: 'Selección final',
                jfEpisodeId: 'ep4_id',
                positionTicks: 60000
            };

            const playable = await vm.getPlayable(cwSlide);
            expect(playable).toEqual({
                itemId: 'ep4_id',
                title: 'Kimetsu no Yaiba · T1 E04 — Selección final',
                startTicks: 60000
            });
        });

        test('para series novedad sin jfEpisodeId, consulta getShow y extrae el primer episodio', async () => {
            const mockShowData = {
                id: 'new_show',
                title: 'Nueva Serie',
                seasons: [
                    {
                        n: 1,
                        episodes: [
                            { n: 1, jfId: 'ep1_jfId', title: 'Piloto', watched: 0, runtime: 24 }
                        ]
                    }
                ]
            };
            const getShow = vi.fn(() => Promise.resolve(mockShowData));
            const api = mockApi();
            (api.catalog as Record<string, unknown>).getShow = getShow;
            const vm = new HomeViewModel(api);

            const newSlide: CarouselSlide = {
                type: 'new',
                id: 'new_show',
                kind: 'show',
                title: 'Nueva Serie',
                season: null,
                episode: null,
                episodeTitle: '',
                year: 2024,
                progress: null,
                remaining: '',
                backdrop: '',
                poster: ''
            };

            const playable = await vm.getPlayable(newSlide);
            expect(getShow).toHaveBeenCalledWith('new_show');
            expect(playable).toEqual({
                itemId: 'ep1_jfId',
                title: 'Nueva Serie · T1 E01 — Piloto',
                startTicks: undefined
            });
            expect(newSlide.jfEpisodeId).toBe('ep1_jfId');
        });
    });

    describe('formatEpisodeCode', () => {
        test('formatea temporada y episodio con ceros a la izquierda', () => {
            expect(formatEpisodeCode(1, 5)).toBe('T1 E05');
            expect(formatEpisodeCode(2, 12)).toBe('T2 E12');
            expect(formatEpisodeCode('1', '3')).toBe('T1 E03');
        });
    });
});
