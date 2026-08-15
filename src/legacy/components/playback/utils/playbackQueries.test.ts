import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { ItemFilter } from '@jellyfin/sdk/lib/generated-client/models/item-filter';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getApi: vi.fn(),
    getCurrentUserId: vi.fn(() => 'user-1'),
    getItems: vi.fn(),
    getItem: vi.fn(),
    getIntros: vi.fn(),
    enableCinemaMode: vi.fn(() => true)
}));

vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        getApi: mocks.getApi,
        getCurrentUserId: mocks.getCurrentUserId
    }
}));
vi.mock('utils/sdk/getItems', () => ({ getItems: mocks.getItems }));
vi.mock('@jellyfin/sdk/lib/utils/api/library-api', () => ({
    getLibraryApi: () => ({ getItem: mocks.getItem, getIntros: mocks.getIntros })
}));
vi.mock('scripts/settings/userSettings', () => ({ enableCinemaMode: mocks.enableCinemaMode }));

const {
    UNLIMITED_ITEMS,
    enableIntros,
    getIntros,
    getItemsForPlayback,
    isServerItem,
    mergePlaybackQueries
} = await import('./playbackQueries');

type PlaybackQuery = Parameters<typeof mergePlaybackQueries>[0];

/** Un Api del SDK basta con que no sea undefined: las llamadas van mockeadas. */
const api = {} as Api;

/** Query con la que se llamó a getItems en último lugar. */
function lastQuery(): Record<string, unknown> {
    return mocks.getItems.mock.calls.at(-1)?.[1] as Record<string, unknown>;
}

beforeEach(() => {
    mocks.getApi.mockReturnValue(api);
    mocks.getItems.mockReset().mockResolvedValue({ Items: [] });
    mocks.enableCinemaMode.mockReturnValue(true);
    mocks.getItem.mockReset().mockResolvedValue({ data: { Id: 'a' } });
    mocks.getIntros.mockReset();
});

describe('getItemsForPlayback', () => {
    it('un solo id se pide directamente, sin pasar por el listado', async () => {
        const res = await getItemsForPlayback('srv-1', { ids: ['abc'] });

        expect(mocks.getItem).toHaveBeenCalledWith({ itemId: 'abc', userId: 'user-1' });
        expect(mocks.getItems).not.toHaveBeenCalled();
        expect(res).toEqual({ Items: [{ Id: 'a' }], TotalRecordCount: 1 });
    });

    it('varios ids pasan por el listado', async () => {
        await getItemsForPlayback('srv-1', { ids: ['a', 'b'] });

        expect(mocks.getItem).not.toHaveBeenCalled();
        expect(mocks.getItems).toHaveBeenCalledOnce();
    });

    it('sin ids también pasa por el listado', async () => {
        await getItemsForPlayback('srv-1', {});
        expect(mocks.getItems).toHaveBeenCalledOnce();
    });

    it('un ids vacío no se confunde con un id suelto', async () => {
        await getItemsForPlayback('srv-1', { ids: [] });

        expect(mocks.getItem).not.toHaveBeenCalled();
        expect(mocks.getItems).toHaveBeenCalledOnce();
    });

    it('pone un tope por defecto para no armar colas inmanejables', async () => {
        await getItemsForPlayback('srv-1', {});
        expect(lastQuery().limit).toBe(300);
    });

    it('respeta el tope que se pida', async () => {
        await getItemsForPlayback('srv-1', { limit: 10 });
        expect(lastQuery().limit).toBe(10);
    });

    it('UNLIMITED_ITEMS quita el tope en vez de mandarlo como -1', async () => {
        await getItemsForPlayback('srv-1', { limit: UNLIMITED_ITEMS });
        expect(lastQuery().limit).toBeUndefined();
    });

    it('añade lo que necesita el reproductor y descarta lo virtual', async () => {
        await getItemsForPlayback('srv-1', {});

        expect(lastQuery()).toMatchObject({
            fields: ['Chapters', 'Trickplay'],
            excludeLocationTypes: ['Virtual'],
            enableTotalRecordCount: false,
            collapseBoxSetItems: false
        });
    });

    it('sin conexión al servidor falla con un error explicativo', async () => {
        mocks.getApi.mockReturnValue(undefined);
        await expect(getItemsForPlayback('srv-x', {})).rejects.toThrow('srv-x');
    });
});

describe('mergePlaybackQueries', () => {
    it('combina las dos consultas', () => {
        const q = mergePlaybackQueries({ sortBy: ['SortName'] }, { limit: 5 });
        expect(q).toMatchObject({ sortBy: ['SortName'], limit: 5 });
    });

    it('la segunda gana sobre la primera', () => {
        expect(mergePlaybackQueries({ limit: 1 }, { limit: 2 }).limit).toBe(2);
    });

    it('nunca deja pasar carpetas', () => {
        expect(mergePlaybackQueries({}, {}).filters).toEqual(['IsNotFolder']);
    });

    it('conserva los filtros que ya hubiera', () => {
        const q = mergePlaybackQueries({ filters: ['IsUnplayed'] }, {});
        expect(q.filters).toEqual(['IsUnplayed', 'IsNotFolder']);
    });

    it('no duplica el filtro si ya estaba', () => {
        const q = mergePlaybackQueries({ filters: ['IsNotFolder'] }, {});
        expect(q.filters).toEqual(['IsNotFolder']);
    });

    it('no muta las consultas de entrada', () => {
        const base: PlaybackQuery = { filters: [ItemFilter.IsUnplayed] };
        mergePlaybackQueries(base, {});
        expect(base.filters).toEqual(['IsUnplayed']);
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
        mocks.getIntros.mockResolvedValue({ data: intros });

        await expect(getIntros(video, api, {})).resolves.toBe(intros);
    });

    it('no las pone al retomar desde una posición', async () => {
        const res = await getIntros(video, api, { startPositionTicks: 500 });

        expect(mocks.getIntros).not.toHaveBeenCalled();
        expect(res.Items).toEqual([]);
    });

    it('no las pone al saltar a un índice de la cola', async () => {
        await getIntros(video, api, { startIndex: 3 });
        expect(mocks.getIntros).not.toHaveBeenCalled();
    });

    it('no las pone fuera de pantalla completa', async () => {
        await getIntros(video, api, { fullscreen: false });
        expect(mocks.getIntros).not.toHaveBeenCalled();
    });

    it('no las pone con el modo cine desactivado', async () => {
        mocks.enableCinemaMode.mockReturnValue(false);
        await getIntros(video, api, {});
        expect(mocks.getIntros).not.toHaveBeenCalled();
    });

    it('si fallan, se reproduce igual', async () => {
        mocks.getIntros.mockRejectedValue(new Error('500'));

        await expect(getIntros(video, api, {})).resolves.toEqual({ Items: [] });
    });
});
