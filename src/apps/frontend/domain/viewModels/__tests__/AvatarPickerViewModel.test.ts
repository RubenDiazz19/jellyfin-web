// El selector de avatar mezcla tres fuentes de las que solo depende una (la
// biblioteca local): lo que se prueba aquí es esa unión tolerante a fallos, el
// debounce de la caja, las carreras entre búsquedas y que «guardar» componga y
// suba exactamente lo elegido.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// El VM importa ApiService, que llega a ServerConnections y con él al
// bootstrap legacy con efectos a nivel de módulo. Mismo corte que el resto de
// tests de ViewModels.
vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        getApi: () => null,
        getCurrentUserId: () => null,
        getCurrentServerId: () => null,
        connect: () => Promise.resolve(),
        logout: () => Promise.resolve()
    }
}));

import { AvatarPickerViewModel } from '../AvatarPickerViewModel';
import { normalizeName } from '../../../data/api/characterArt';
import type { ApiService } from '../../../data/api/ApiService';
import type { AvatarCandidate } from '../../../data/api/avatars';

function cand(id: string, source: AvatarCandidate['source'] = 'library'): AvatarCandidate {
    return { id, name: `Nombre ${id}`, subtitle: `Serie de ${id}`, imageUrl: `img/${id}`, source };
}

/** Candidato de la biblioteca con el nombre y la serie dados, para el cruce con AniList. */
function cast(name: string, series: string): AvatarCandidate {
    return { id: `lib-${name}`, name, subtitle: `${series} · Actor`, series, imageUrl: `img/${name}`, source: 'library' };
}

/** api con las fuentes bajo control del test y valores por defecto sanos. */
function makeVm() {
    const api = {
        avatars: {
            getLibraryCharacters: vi.fn(() => Promise.resolve([cand('defecto')])),
            searchLibraryCharacters: vi.fn(() => Promise.resolve([cand('local')])),
            searchAniListCharacters: vi.fn(() => Promise.resolve([cand('anime', 'anilist')])),
            searchTmdbCharacters: vi.fn(() => Promise.resolve([cand('cine', 'tmdb')])),
            isTmdbConfigured: () => true,
            resolveSeriesArt: vi.fn(() => Promise.resolve(new Map())),
            buildAvatarFile: vi.fn(() => Promise.resolve(new File([], 'avatar.png')))
        },
        users: { uploadAvatar: vi.fn(() => Promise.resolve()) }
    } as unknown as ApiService;
    return { vm: new AvatarPickerViewModel(api), api };
}

/** Pasa el debounce y vacía las microtareas de las promesas encadenadas. */
async function settle(ms: number) {
    await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('apertura', () => {
    test('carga la muestra de la biblioteca y deja el estado limpio', async () => {
        const { vm, api } = makeVm();
        vm.select(cand('viejo'));

        vm.open();
        await settle(0);

        expect(api.avatars.getLibraryCharacters).toHaveBeenCalledTimes(1);
        expect(vm.candidates.value.map((c) => c.id)).toEqual(['defecto']);
        expect(vm.selected.value).toBeNull();
        expect(vm.query.value).toBe('');
        expect(vm.loading.value).toBe(false);
    });

    test('sin sesión/servidor caído, rejilla vacía y sin quedar cargando', async () => {
        const { vm, api } = makeVm();
        (api.avatars.getLibraryCharacters as ReturnType<typeof vi.fn>)
            .mockRejectedValue(new Error('sin sesión'));

        vm.open();
        await settle(0);

        expect(vm.candidates.value).toEqual([]);
        expect(vm.loading.value).toBe(false);
    });
});

describe('búsqueda', () => {
    test('las tres fuentes en paralelo, la biblioteca primero', async () => {
        const { vm, api } = makeVm();
        vm.open();
        await settle(0);

        vm.setQuery('frodo');
        await settle(300);

        expect(api.avatars.searchLibraryCharacters).toHaveBeenCalledWith('frodo');
        expect(api.avatars.searchAniListCharacters).toHaveBeenCalledWith('frodo');
        expect(api.avatars.searchTmdbCharacters).toHaveBeenCalledWith('frodo');
        expect(vm.candidates.value.map((c) => c.id)).toEqual(['local', 'anime', 'cine']);
    });

    test('se espera a que se deje de teclear', async () => {
        const { vm, api } = makeVm();
        vm.open();
        await settle(0);

        vm.setQuery('f');
        vm.setQuery('fr');
        vm.setQuery('fro');
        expect(api.avatars.searchLibraryCharacters).not.toHaveBeenCalled();
        await settle(300);

        expect(api.avatars.searchLibraryCharacters).toHaveBeenCalledTimes(1);
        expect(api.avatars.searchLibraryCharacters).toHaveBeenCalledWith('fro');
    });

    test('que una fuente falle no se lleva las demás', async () => {
        const { vm, api } = makeVm();
        (api.avatars.searchAniListCharacters as ReturnType<typeof vi.fn>)
            .mockRejectedValue(new Error('AniList → HTTP 429'));
        vm.open();
        await settle(0);

        vm.setQuery('buffy');
        await settle(300);

        expect(vm.candidates.value.map((c) => c.id)).toEqual(['local', 'cine']);
    });

    test('borrar la caja devuelve a la muestra de la biblioteca', async () => {
        const { vm, api } = makeVm();
        vm.open();
        await settle(0);
        vm.setQuery('x');
        await settle(300);

        vm.setQuery('');
        await settle(300);

        expect(api.avatars.getLibraryCharacters).toHaveBeenCalledTimes(2);
        expect(vm.candidates.value.map((c) => c.id)).toEqual(['defecto']);
    });

    test('una respuesta lenta de una búsqueda vieja no pisa la nueva', async () => {
        const { vm, api } = makeVm();
        let releaseSlow: () => void = () => {};
        (api.avatars.searchLibraryCharacters as ReturnType<typeof vi.fn>)
            .mockImplementationOnce(() => new Promise<AvatarCandidate[]>((resolve) => {
                releaseSlow = () => resolve([cand('lenta-y-vieja')]);
            }));
        vm.open();
        await settle(0);

        vm.setQuery('lu');
        await settle(300);
        vm.setQuery('luz');
        await settle(300);
        // La nueva (rápida) llega primero; la vieja solo tiene permiso de
        // escribir cuando sigue siendo la última.
        expect(vm.candidates.value.map((c) => c.id)).toEqual(['local', 'anime', 'cine']);
        releaseSlow();
        await settle(0);
        expect(vm.candidates.value.map((c) => c.id)).toEqual(['local', 'anime', 'cine']);
    });

    test('cerrar cancela la búsqueda que estaba en cola', async () => {
        const { vm, api } = makeVm();
        vm.open();
        await settle(0);

        vm.setQuery('tarde');
        vm.close();
        await settle(300);

        expect(api.avatars.searchLibraryCharacters).not.toHaveBeenCalled();
        expect(vm.loading.value).toBe(false);
    });

    test('cerrar invalida la carga por defecto en vuelo', async () => {
        const { vm, api } = makeVm();
        let release: () => void = () => {};
        (api.avatars.getLibraryCharacters as ReturnType<typeof vi.fn>)
            .mockImplementationOnce(() => new Promise<AvatarCandidate[]>((resolve) => {
                release = () => resolve([cand('tarde')]);
            }));
        vm.open();
        vm.close();
        release();
        await settle(0);

        expect(vm.candidates.value).toEqual([]);
        expect(vm.loading.value).toBe(false);
    });
});

describe('arte del personaje', () => {
    test('los candidatos de la biblioteca se enriquecen con el arte de AniList', async () => {
        const { vm, api } = makeVm();
        (api.avatars.getLibraryCharacters as ReturnType<typeof vi.fn>)
            .mockResolvedValue([cast('Naruto Uzumaki', 'Naruto'), cast('Boruto', 'Naruto')]);
        (api.avatars.resolveSeriesArt as ReturnType<typeof vi.fn>)
            .mockResolvedValue(new Map([[normalizeName('Naruto Uzumaki'), 'https://art/naruto']]));

        vm.open();
        await settle(0);

        // Un único disparo por serie: los dos candidatos comparten «Naruto».
        expect(api.avatars.resolveSeriesArt).toHaveBeenCalledTimes(1);
        expect(api.avatars.resolveSeriesArt).toHaveBeenCalledWith('Naruto');
        expect(vm.artById.value.get('lib-Naruto Uzumaki')).toBe('https://art/naruto');
        // Sin rol en el mapa de AniList, se queda con la foto del intérprete.
        expect(vm.artById.value.get('lib-Boruto')).toBeUndefined();
    });

    test('la búsqueda local también enriquece', async () => {
        const { vm, api } = makeVm();
        vm.open();
        await settle(0);
        (api.avatars.searchLibraryCharacters as ReturnType<typeof vi.fn>)
            .mockResolvedValue([cast('Luffy', 'One Piece')]);
        (api.avatars.resolveSeriesArt as ReturnType<typeof vi.fn>)
            .mockResolvedValue(new Map([['luffy', 'https://art/luffy']]));

        vm.setQuery('one');
        await settle(300);

        expect(vm.artById.value.get('lib-Luffy')).toBe('https://art/luffy');
    });

    test('los candidatos de otras fuentes no tocan AniList por arte', async () => {
        const { vm, api } = makeVm();
        (api.avatars.getLibraryCharacters as ReturnType<typeof vi.fn>)
            .mockResolvedValue([
                { ...cand('a', 'anilist'), name: 'Naruto', series: 'Naruto' },
                { ...cand('t', 'tmdb'), name: 'Naruto', series: 'Naruto' }
            ]);

        vm.open();
        await settle(0);

        expect(api.avatars.resolveSeriesArt).not.toHaveBeenCalled();
        expect(vm.artById.value.size).toBe(0);
    });

    test('abrir de nuevo deja el arte limpio y vuelve a enriquecer', async () => {
        const { vm, api } = makeVm();
        (api.avatars.getLibraryCharacters as ReturnType<typeof vi.fn>)
            .mockResolvedValue([cast('Naruto Uzumaki', 'Naruto')]);
        (api.avatars.resolveSeriesArt as ReturnType<typeof vi.fn>)
            .mockResolvedValue(new Map([['naruto uzumaki', 'https://art/naruto']]));

        vm.open();
        await settle(0);
        expect(vm.artById.value.size).toBe(1);

        vm.open();
        await settle(0);
        expect(vm.artById.value.size).toBe(1);
    });

    test('que AniList falle no rompe la apertura ni deja el arte atascado', async () => {
        const { vm, api } = makeVm();
        (api.avatars.getLibraryCharacters as ReturnType<typeof vi.fn>)
            .mockResolvedValue([cast('Naruto Uzumaki', 'Naruto')]);
        (api.avatars.resolveSeriesArt as ReturnType<typeof vi.fn>)
            .mockRejectedValue(new Error('AniList → HTTP 429'));

        vm.open();
        await settle(0);

        expect(vm.candidates.value).toHaveLength(1);
        expect(vm.loading.value).toBe(false);
        expect(vm.artById.value.size).toBe(0);
    });

    test('guardar compone con el arte del personaje cuando ya ha llegado', async () => {
        const { vm, api } = makeVm();
        (api.avatars.getLibraryCharacters as ReturnType<typeof vi.fn>)
            .mockResolvedValue([cast('Naruto Uzumaki', 'Naruto')]);
        (api.avatars.resolveSeriesArt as ReturnType<typeof vi.fn>)
            .mockResolvedValue(new Map([['naruto uzumaki', 'https://art/naruto']]));

        vm.open();
        await settle(0);
        vm.select(vm.candidates.value[0]);
        await vm.apply();

        expect(api.avatars.buildAvatarFile).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'lib-Naruto Uzumaki', imageUrl: 'https://art/naruto' })
        );
    });
});

describe('guardar', () => {
    test('compone la imagen y la sube', async () => {
        const { vm, api } = makeVm();
        const chosen = cand('anime', 'anilist');
        vm.select(chosen);

        await vm.apply();

        expect(api.avatars.buildAvatarFile).toHaveBeenCalledWith(chosen);
        expect(api.users.uploadAvatar).toHaveBeenCalledTimes(1);
        expect(vm.saving.value).toBe(false);
    });

    test('sin selección no toca la red', async () => {
        const { vm, api } = makeVm();
        await vm.apply();
        expect(api.avatars.buildAvatarFile).not.toHaveBeenCalled();
        expect(api.users.uploadAvatar).not.toHaveBeenCalled();
    });

    test('un fallo al cargar la imagen sube el error con la etapa', async () => {
        const { vm, api } = makeVm();
        vm.select(cand('x'));
        (api.avatars.buildAvatarFile as ReturnType<typeof vi.fn>)
            .mockRejectedValue(new Error('Failed to fetch'));

        await expect(vm.apply()).rejects.toThrow(/Failed to fetch.*while loading the image/);
        expect(api.users.uploadAvatar).not.toHaveBeenCalled();
        expect(vm.saving.value).toBe(false);
    });

    test('un fallo al subir el avatar sube el error con su etapa', async () => {
        const { vm, api } = makeVm();
        vm.select(cand('x'));
        (api.users.uploadAvatar as ReturnType<typeof vi.fn>)
            .mockRejectedValue(new Error('Failed to fetch'));

        await expect(vm.apply()).rejects.toThrow(/Failed to fetch.*while uploading the avatar/);
        expect(api.avatars.buildAvatarFile).toHaveBeenCalledTimes(1);
        expect(vm.saving.value).toBe(false);
    });

    test('mientras guarda no reentra', async () => {
        const { vm, api } = makeVm();
        vm.select(cand('x'));
        let release: () => void = () => {};
        (api.avatars.buildAvatarFile as ReturnType<typeof vi.fn>)
            .mockImplementationOnce(() => new Promise((resolve) => {
                release = () => resolve(new File([], 'avatar.png'));
            }));

        const first = vm.apply();
        await expect(vm.apply()).resolves.toBeUndefined();
        expect(api.avatars.buildAvatarFile).toHaveBeenCalledTimes(1);

        release();
        await first;
    });
});
