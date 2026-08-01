// El puente entre los favoritos del servidor y el store local.
//
// Lo que se prueba de verdad es la traducción de ids: el servidor identifica
// temporadas y episodios por su id, y el store por su posición dentro de la
// serie. Un fallo aquí no rompe nada visible — simplemente el corazón deja de
// viajar entre dispositivos, en silencio.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fetchUserItems: vi.fn(),
    toggleFavorite: vi.fn(),
    getShow: vi.fn()
}));

vi.mock('../http', () => ({
    fetchUserItems: mocks.fetchUserItems,
    noSessionError: () => new Error('sin sesión')
}));
vi.mock('../items', () => ({ toggleFavorite: mocks.toggleFavorite }));
vi.mock('../shows', () => ({ getShow: mocks.getShow }));

import { FAVS } from '../../stores/favsStore';
import { favoriteServerId, getFavoriteKeys, hydrateFavorites } from '../favorites';

/** Una serie con una temporada y dos capítulos, con sus ids de servidor. */
const SHOW = {
    id: 'serie1',
    seasons: [{
        n: 1,
        jfId: 'temporada-jf',
        episodes: [
            { n: 1, jfId: 'ep1-jf' },
            { n: 2, jfId: 'ep2-jf' }
        ]
    }]
};

/** Deja el store con exactamente estas claves. */
function seedFavs(keys: string[]) {
    FAVS._reset();
    localStorage.setItem('jfp-favs', JSON.stringify(keys));
    FAVS._reset();
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    FAVS._reset();
    mocks.fetchUserItems.mockResolvedValue([]);
    mocks.toggleFavorite.mockResolvedValue(undefined);
    mocks.getShow.mockResolvedValue(SHOW);
});

describe('getFavoriteKeys', () => {
    test('traduce cada tipo del servidor a su clave del store', async () => {
        mocks.fetchUserItems.mockResolvedValue([
            { Id: 'peli1', Name: 'Peli', Type: 'Movie' },
            { Id: 'serie1', Name: 'Serie', Type: 'Series' },
            { Id: 'temporada-jf', Name: 'T1', Type: 'Season', SeriesId: 'serie1', IndexNumber: 1 },
            {
                Id: 'ep2-jf', Name: 'E2', Type: 'Episode',
                SeriesId: 'serie1', ParentIndexNumber: 1, IndexNumber: 2
            }
        ]);
        expect(await getFavoriteKeys()).toEqual([
            'movie-peli1', 'serie1', 'serie1-s1', 'serie1-s1-e2'
        ]);
    });

    test('descarta lo que no sabe situar', async () => {
        mocks.fetchUserItems.mockResolvedValue([
            // Un episodio sin serie no se puede colocar bajo ninguna clave.
            { Id: 'huerfano', Name: 'E1', Type: 'Episode', IndexNumber: 1 },
            // Y un tipo que este frontend no pinta tampoco.
            { Id: 'disco', Name: 'Album', Type: 'MusicAlbum' }
        ]);
        expect(await getFavoriteKeys()).toEqual([]);
    });
});

describe('favoriteServerId', () => {
    test('películas y series lo llevan en la propia clave', async () => {
        expect(await favoriteServerId('movie-peli1')).toBe('peli1');
        expect(await favoriteServerId('serie1')).toBe('serie1');
        expect(mocks.getShow).not.toHaveBeenCalled();
    });

    test('temporadas y episodios lo sacan de la serie', async () => {
        expect(await favoriteServerId('serie1-s1')).toBe('temporada-jf');
        expect(await favoriteServerId('serie1-s1-e2')).toBe('ep2-jf');
    });

    test('null si el item ya no está en la serie', async () => {
        expect(await favoriteServerId('serie1-s9')).toBeNull();
        expect(await favoriteServerId('serie1-s1-e9')).toBeNull();
    });
});

describe('hydrateFavorites', () => {
    test('el servidor manda: entra lo suyo y sale lo que no lista', async () => {
        // 'viejo' quedó marcado en este navegador y ya se había subido en su
        // día; que el servidor no lo liste significa que se desmarcó fuera.
        seedFavs(['viejo']);
        localStorage.setItem('jfp-favs-synced', '1');
        mocks.fetchUserItems.mockResolvedValue([
            { Id: 'peli1', Name: 'Peli', Type: 'Movie' }
        ]);

        await hydrateFavorites();

        expect(FAVS.has('movie-peli1')).toBe(true);
        expect(FAVS.has('viejo')).toBe(false);
    });

    test('la primera vez sube los favoritos que solo existían en local', async () => {
        seedFavs(['movie-peli1', 'serie1-s1-e2']);

        await hydrateFavorites();

        expect(mocks.toggleFavorite.mock.calls).toEqual([
            ['peli1', true],
            ['ep2-jf', true]
        ]);
        // Y siguen marcados: se acaban de adoptar, aunque el listado que
        // trajimos antes de subirlos no los tuviera.
        expect(FAVS.has('movie-peli1')).toBe(true);
        expect(FAVS.has('serie1-s1-e2')).toBe(true);
    });

    test('lo que el servidor rechaza al subir se pierde, no se queda a medias', async () => {
        seedFavs(['movie-borrada']);
        mocks.toggleFavorite.mockRejectedValue(new Error('HTTP 404'));

        await hydrateFavorites();

        expect(FAVS.has('movie-borrada')).toBe(false);
    });

    test('la adopción es una sola vez en la vida de la instalación', async () => {
        seedFavs(['movie-peli1']);
        await hydrateFavorites();
        expect(mocks.toggleFavorite).toHaveBeenCalledTimes(1);

        // Segunda hidratación: el servidor sigue sin listarlo (p. ej. porque
        // el usuario lo quitó desde otro cliente). No se vuelve a subir.
        mocks.toggleFavorite.mockClear();
        await hydrateFavorites();
        expect(mocks.toggleFavorite).not.toHaveBeenCalled();
        expect(FAVS.has('movie-peli1')).toBe(false);
    });

    test('dos hidrataciones a la vez comparten una sola petición', async () => {
        await Promise.all([hydrateFavorites(), hydrateFavorites()]);
        expect(mocks.fetchUserItems).toHaveBeenCalledTimes(1);
    });
});
