import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    apiFetch: vi.fn(),
    apiSend: vi.fn(),
    emitItemMutated: vi.fn(),
    clearShowCache: vi.fn()
}));

vi.mock('../http', () => ({
    apiFetch: mocks.apiFetch,
    apiSend: mocks.apiSend,
    noSessionError: () => new Error('sin sesión')
}));

vi.mock('../cache', () => ({
    clearShowCache: mocks.clearShowCache
}));

vi.mock('../mutations', () => ({
    emitItemMutated: mocks.emitItemMutated
}));

vi.mock('../../session/session', () => ({
    loadSession: () => ({ userId: 'user-1' })
}));

import {
    applyRemoteSearchResult,
    normalizeTags,
    remoteSearch,
    setItemTags,
    updateItemMetadata
} from '../metadata';

beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiFetch.mockResolvedValue({
        Id: 'item-1',
        Name: 'Robot Chicken: Star Wars',
        ProductionYear: 2008,
        Type: 'Movie',
        ProviderIds: { TheMovieDb: '42194', Imdb: 'tt1334272' },
        Tags: ['Animación']
    });
    mocks.apiSend.mockResolvedValue({
        json: () => Promise.resolve([{ Name: 'Star Wars', ProductionYear: 1977 }])
    });
});

describe('remoteSearch', () => {
    test('no envía los ProviderIds preexistentes del item para no bloquear la búsqueda textual', async () => {
        await remoteSearch('item-1', 'Movie', { name: 'Star Wars' });

        expect(mocks.apiSend).toHaveBeenCalledWith(
            '/Items/RemoteSearch/Movie',
            'POST',
            expect.objectContaining({
                ItemId: 'item-1',
                SearchInfo: expect.objectContaining({
                    Name: 'Star Wars',
                    ProviderIds: {}
                })
            })
        );
    });

    test('no fuerza el año del item preexistente si el usuario no especifica año', async () => {
        await remoteSearch('item-1', 'Movie', { name: 'Star Wars' });

        expect(mocks.apiSend).toHaveBeenCalledWith(
            '/Items/RemoteSearch/Movie',
            'POST',
            expect.objectContaining({
                SearchInfo: expect.objectContaining({
                    Name: 'Star Wars',
                    Year: undefined
                })
            })
        );
    });

    test('envía el año si el usuario lo especifica explícitamente', async () => {
        await remoteSearch('item-1', 'Movie', { name: 'Star Wars', year: 1977 });

        expect(mocks.apiSend).toHaveBeenCalledWith(
            '/Items/RemoteSearch/Movie',
            'POST',
            expect.objectContaining({
                SearchInfo: expect.objectContaining({
                    Name: 'Star Wars',
                    Year: 1977
                })
            })
        );
    });

    test('envía los providerIds si el usuario los especifica explícitamente', async () => {
        await remoteSearch('item-1', 'Movie', {
            name: 'Star Wars',
            providerIds: { TheMovieDb: '11', Imdb: 'tt0076759', Vacio: '   ' }
        });

        expect(mocks.apiSend).toHaveBeenCalledWith(
            '/Items/RemoteSearch/Movie',
            'POST',
            expect.objectContaining({
                SearchInfo: expect.objectContaining({
                    Name: 'Star Wars',
                    ProviderIds: { TheMovieDb: '11', Imdb: 'tt0076759' }
                })
            })
        );
    });

    test('resuelve el endpoint a Series si el raw.Type del servidor es Series', async () => {
        mocks.apiFetch.mockResolvedValueOnce({
            Id: 'item-series',
            Name: 'Star Wars: The Clone Wars',
            ProductionYear: 2008,
            Type: 'Series',
            ProviderIds: { TheTVDb: '83268' }
        });

        await remoteSearch('item-series', 'Movie', { name: 'Star Wars' });

        expect(mocks.apiSend).toHaveBeenCalledWith(
            '/Items/RemoteSearch/Series',
            'POST',
            expect.objectContaining({
                ItemId: 'item-series',
                SearchInfo: expect.objectContaining({
                    Name: 'Star Wars',
                    ProviderIds: {}
                })
            })
        );
    });
});

describe('applyRemoteSearchResult', () => {
    test('llama a /Items/RemoteSearch/Apply con replaceAllImages=true y emite mutación', async () => {
        const candidate = {
            Name: 'Star Wars',
            ProductionYear: 1977,
            SearchProviderName: 'TheMovieDb'
        };

        await applyRemoteSearchResult('item-1', candidate);

        expect(mocks.apiSend).toHaveBeenCalledWith(
            '/Items/RemoteSearch/Apply/item-1?replaceAllImages=true',
            'POST',
            candidate
        );
        expect(mocks.clearShowCache).toHaveBeenCalled();
        expect(mocks.emitItemMutated).toHaveBeenCalledWith('item-1');
    });
});

describe('normalizeTags y setItemTags', () => {
    test('normaliza tags eliminando vacíos y duplicados sin distinción de mayúsculas', () => {
        const tags = normalizeTags(['Acción', '  ', 'acción', 'Aventura']);
        expect(tags).toEqual(['Acción', 'Aventura']);
    });

    test('setItemTags aplica el parche y emite mutación', async () => {
        await setItemTags('item-1', ['Sci-Fi', 'Acción']);

        expect(mocks.apiSend).toHaveBeenCalledWith(
            '/Items/item-1',
            'POST',
            expect.objectContaining({
                Tags: ['Acción', 'Sci-Fi']
            })
        );
        expect(mocks.emitItemMutated).toHaveBeenCalledWith('item-1');
    });

    test('updateItemMetadata actualiza campos y conserva el resto del item', async () => {
        await updateItemMetadata('item-1', { Name: 'Star Wars (Episodio IV)' });

        expect(mocks.apiSend).toHaveBeenCalledWith(
            '/Items/item-1',
            'POST',
            expect.objectContaining({
                Id: 'item-1',
                Name: 'Star Wars (Episodio IV)',
                ProductionYear: 2008
            })
        );
    });
});
