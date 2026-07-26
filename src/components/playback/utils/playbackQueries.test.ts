import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getApiClient: vi.fn(),
    getItems: vi.fn(),
    enableCinemaMode: vi.fn(() => true)
}));

vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: { getApiClient: mocks.getApiClient }
}));
vi.mock('utils/jellyfin-apiclient/getItems', () => ({ getItems: mocks.getItems }));
vi.mock('scripts/settings/userSettings', () => ({ enableCinemaMode: mocks.enableCinemaMode }));

const {
    UNLIMITED_ITEMS,
    enableIntros,
    getIntros,
    getItemsForPlayback,
    isServerItem,
    mergePlaybackQueries
} = await import('./playbackQueries');

const apiClient = {
    getItem: vi.fn(),
    getCurrentUserId: () => 'user-1',
    getIntros: vi.fn()
};

/** Query con la que se llamó a getItems en último lugar. */
function lastQuery(): Record<string, unknown> {
    return mocks.getItems.mock.calls.at(-1)?.[2] as Record<string, unknown>;
}

beforeEach(() => {
    mocks.getApiClient.mockReturnValue(apiClient);
    mocks.getItems.mockReset().mockResolvedValue({ Items: [] });
    mocks.enableCinemaMode.mockReturnValue(true);
    apiClient.getItem.mockReset().mockResolvedValue({ Id: 'a' });
    apiClient.getIntros.mockReset();
});

describe('getItemsForPlayback', () => {
    it('un solo id se pide directamente, sin pasar por el listado', async () => {
        const res = await getItemsForPlayback('srv-1', { Ids: 'abc' });

        expect(apiClient.getItem).toHaveBeenCalledWith('user-1', 'abc');
        expect(mocks.getItems).not.toHaveBeenCalled();
        expect(res).toEqual({ Items: [{ Id: 'a' }], TotalRecordCount: 1 });
    });

    it('varios ids pasan por el listado', async () => {
        await getItemsForPlayback('srv-1', { Ids: 'a,b' });

        expect(apiClient.getItem).not.toHaveBeenCalled();
        expect(mocks.getItems).toHaveBeenCalledOnce();
    });

    it('sin Ids también pasa por el listado', async () => {
        await getItemsForPlayback('srv-1', {});
        expect(mocks.getItems).toHaveBeenCalledOnce();
    });

    it('un Ids vacío no se confunde con un id suelto', async () => {
        await getItemsForPlayback('srv-1', { Ids: '' });

        expect(apiClient.getItem).not.toHaveBeenCalled();
        expect(mocks.getItems).toHaveBeenCalledOnce();
    });

    it('pone un tope por defecto para no armar colas inmanejables', async () => {
        await getItemsForPlayback('srv-1', {});
        expect(lastQuery().Limit).toBe(300);
    });

    it('respeta el tope que se pida', async () => {
        await getItemsForPlayback('srv-1', { Limit: 10 });
        expect(lastQuery().Limit).toBe(10);
    });

    it('UNLIMITED_ITEMS quita el tope en vez de mandarlo como -1', async () => {
        await getItemsForPlayback('srv-1', { Limit: UNLIMITED_ITEMS });
        expect(lastQuery()).not.toHaveProperty('Limit');
    });

    it('añade lo que necesita el reproductor y descarta lo virtual', async () => {
        await getItemsForPlayback('srv-1', {});

        expect(lastQuery()).toMatchObject({
            Fields: ['Chapters', 'Trickplay'],
            ExcludeLocationTypes: 'Virtual',
            EnableTotalRecordCount: false,
            CollapseBoxSetItems: false
        });
    });

    it('sin conexión al servidor falla con un error explicativo', async () => {
        mocks.getApiClient.mockReturnValue(undefined);
        await expect(getItemsForPlayback('srv-x', {})).rejects.toThrow('srv-x');
    });
});

describe('mergePlaybackQueries', () => {
    it('combina las dos consultas', () => {
        const q = mergePlaybackQueries({ SortBy: 'SortName' }, { Limit: 5 });
        expect(q).toMatchObject({ SortBy: 'SortName', Limit: 5 });
    });

    it('la segunda gana sobre la primera', () => {
        expect(mergePlaybackQueries({ Limit: 1 }, { Limit: 2 }).Limit).toBe(2);
    });

    it('nunca deja pasar carpetas', () => {
        expect(mergePlaybackQueries({}, {}).Filters).toBe('IsNotFolder');
    });

    it('conserva los filtros que ya hubiera', () => {
        const q = mergePlaybackQueries({ Filters: 'IsUnplayed' }, {});
        expect(q.Filters).toBe('IsUnplayed,IsNotFolder');
    });

    it('no duplica el filtro si ya estaba', () => {
        const q = mergePlaybackQueries({ Filters: 'IsNotFolder' }, {});
        expect(q.Filters).toBe('IsNotFolder');
    });

    it('no muta las consultas de entrada', () => {
        const base = { Filters: 'IsUnplayed' };
        mergePlaybackQueries(base, {});
        expect(base.Filters).toBe('IsUnplayed');
    });
});

describe('isServerItem', () => {
    it('lo del servidor tiene id', () => {
        expect(isServerItem({ Id: 'x' })).toBe(true);
    });

    it('una URL suelta, no', () => {
        expect(isServerItem({})).toBe(false);
    });
});

describe('enableIntros', () => {
    const video: BaseItemDto = { Id: 'v', MediaType: 'Video' };

    it('sí para vídeo del servidor', () => {
        expect(enableIntros(video)).toBe(true);
    });

    it('no para audio', () => {
        expect(enableIntros({ Id: 'a', MediaType: 'Audio' })).toBe(false);
    });

    it('no en un canal de TV: el usuario espera imagen ya', () => {
        expect(enableIntros({ ...video, Type: 'TvChannel' })).toBe(false);
    });

    it('no en una grabación en curso', () => {
        expect(enableIntros({ ...video, Status: 'InProgress' } as BaseItemDto)).toBe(false);
    });

    it('no para algo que no viene del servidor', () => {
        expect(enableIntros({ MediaType: 'Video' })).toBe(false);
    });
});

describe('getIntros', () => {
    const video: BaseItemDto = { Id: 'v', MediaType: 'Video' };
    const intros = { Items: [{ Id: 'intro-1' }] };

    it('las pide cuando procede', async () => {
        apiClient.getIntros.mockResolvedValue(intros);

        await expect(getIntros(video, apiClient, {})).resolves.toBe(intros);
    });

    it('no las pone al retomar desde una posición', async () => {
        const res = await getIntros(video, apiClient, { startPositionTicks: 500 });

        expect(apiClient.getIntros).not.toHaveBeenCalled();
        expect(res.Items).toEqual([]);
    });

    it('no las pone al saltar a un índice de la cola', async () => {
        await getIntros(video, apiClient, { startIndex: 3 });
        expect(apiClient.getIntros).not.toHaveBeenCalled();
    });

    it('no las pone fuera de pantalla completa', async () => {
        await getIntros(video, apiClient, { fullscreen: false });
        expect(apiClient.getIntros).not.toHaveBeenCalled();
    });

    it('no las pone con el modo cine desactivado', async () => {
        mocks.enableCinemaMode.mockReturnValue(false);
        await getIntros(video, apiClient, {});
        expect(apiClient.getIntros).not.toHaveBeenCalled();
    });

    it('si fallan, se reproduce igual', async () => {
        apiClient.getIntros.mockRejectedValue(new Error('500'));

        await expect(getIntros(video, apiClient, {})).resolves.toEqual({ Items: [] });
    });
});
