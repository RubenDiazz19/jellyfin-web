import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cachedPlayback, invalidatePlayback } from '../playbackCache';

describe('playbackCache', () => {
    beforeEach(() => {
        invalidatePlayback();
    });

    it('devuelve la promesa de load y la comparte en lecturas sucesivas', async () => {
        const loadFn = vi.fn().mockResolvedValue({ id: 'res-1' });

        const p1 = cachedPlayback('item-1', 'main', loadFn);
        const p2 = cachedPlayback('item-1', 'main', loadFn);

        expect(loadFn).toHaveBeenCalledTimes(1);
        const [res1, res2] = await Promise.all([p1, p2]);
        expect(res1).toEqual({ id: 'res-1' });
        expect(res2).toEqual({ id: 'res-1' });
    });

    it('ejecuta una nueva carga si se pide fresh: true', async () => {
        const loadFn = vi.fn()
            .mockResolvedValueOnce({ id: 'old' })
            .mockResolvedValueOnce({ id: 'new' });

        await cachedPlayback('item-1', 'main', loadFn);
        expect(loadFn).toHaveBeenCalledTimes(1);

        const freshRes = await cachedPlayback('item-1', 'main', loadFn, { fresh: true });
        expect(loadFn).toHaveBeenCalledTimes(2);
        expect(freshRes).toEqual({ id: 'new' });
    });

    it('separa variantes de un mismo itemId', async () => {
        const load1 = vi.fn().mockResolvedValue({ variant: 1 });
        const load2 = vi.fn().mockResolvedValue({ variant: 2 });

        const r1 = await cachedPlayback('item-1', 'v1', load1);
        const r2 = await cachedPlayback('item-1', 'v2', load2);

        expect(r1).toEqual({ variant: 1 });
        expect(r2).toEqual({ variant: 2 });
        expect(load1).toHaveBeenCalledTimes(1);
        expect(load2).toHaveBeenCalledTimes(1);
    });

    it('elimina la entrada de la caché si la carga falla', async () => {
        const loadFail = vi.fn().mockRejectedValueOnce(new Error('fail'));
        const loadOk = vi.fn().mockResolvedValueOnce({ ok: true });

        await expect(cachedPlayback('item-fail', 'v', loadFail)).rejects.toThrow('fail');

        const res = await cachedPlayback('item-fail', 'v', loadOk);
        expect(res).toEqual({ ok: true });
        expect(loadOk).toHaveBeenCalledTimes(1);
    });

    it('invalidatePlayback(itemId) invalida solo las variantes de ese item', async () => {
        const load1 = vi.fn().mockResolvedValue('item1');
        const load2 = vi.fn().mockResolvedValue('item2');

        await cachedPlayback('item-1', 'v1', load1);
        await cachedPlayback('item-2', 'v1', load2);

        invalidatePlayback('item-1');

        await cachedPlayback('item-1', 'v1', load1);
        expect(load1).toHaveBeenCalledTimes(2);

        await cachedPlayback('item-2', 'v1', load2);
        expect(load2).toHaveBeenCalledTimes(1);
    });

    it('invalidatePlayback() sin argumentos limpia toda la caché', async () => {
        const load1 = vi.fn().mockResolvedValue('item1');
        const load2 = vi.fn().mockResolvedValue('item2');

        await cachedPlayback('item-1', 'v1', load1);
        await cachedPlayback('item-2', 'v1', load2);

        invalidatePlayback();

        await cachedPlayback('item-1', 'v1', load1);
        await cachedPlayback('item-2', 'v1', load2);

        expect(load1).toHaveBeenCalledTimes(2);
        expect(load2).toHaveBeenCalledTimes(2);
    });
});
