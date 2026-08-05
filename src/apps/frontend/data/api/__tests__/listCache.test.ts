// Tests del caché de listados: qué se sirve de memoria, cuándo se vuelve a la
// red y a quién se avisa cuando una revalidación trae algo nuevo.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ userId: 'u1' }));
vi.mock('../../session/session', () => ({ loadSession: () => ({ userId: mocks.userId }) }));

import { cachedList, invalidateLists } from '../listCache';

/** El TTL del módulo; pasado de largo, la entrada se revalida. */
const PAST_TTL = 61_000;

/**
 * Deja correr las microtareas pendientes. La revalidación es un `then` sobre
 * una promesa ya resuelta, así que no hay temporizador que adelantar: lo que
 * hace falta es ceder el turno.
 */
async function settle() {
    await Promise.resolve();
    await Promise.resolve();
}

beforeEach(() => {
    vi.useFakeTimers();
    mocks.userId = 'u1';
    invalidateLists();
});
afterEach(() => {
    vi.useRealTimers();
});

describe('cachedList', () => {
    test('dentro del TTL no vuelve a la red', async () => {
        const load = vi.fn().mockResolvedValue(['a']);
        await cachedList('k', load);
        expect(await cachedList('k', load)).toEqual(['a']);
        expect(load).toHaveBeenCalledTimes(1);
    });

    // Home y Biblioteca pueden pedir la misma lista con un tick de diferencia.
    test('dos lecturas a la vez comparten una sola petición', async () => {
        const load = vi.fn(() => Promise.resolve(['a']));
        await Promise.all([cachedList('k', load), cachedList('k', load)]);
        expect(load).toHaveBeenCalledTimes(1);
    });

    test('pasado el TTL sirve lo cacheado y revalida por detrás', async () => {
        const load = vi.fn()
            .mockResolvedValueOnce(['viejo'])
            .mockResolvedValueOnce(['nuevo']);
        const onRefreshed = vi.fn();
        await cachedList('k', load, onRefreshed);
        vi.advanceTimersByTime(PAST_TTL);

        // La lectura no espera al servidor: contesta con lo que ya había.
        expect(await cachedList('k', load, onRefreshed)).toEqual(['viejo']);
        await settle();

        expect(load).toHaveBeenCalledTimes(2);
        expect(onRefreshed).toHaveBeenCalledTimes(1);
        // Y a partir de ahí, lo nuevo.
        expect(await cachedList('k', load, onRefreshed)).toEqual(['nuevo']);
    });

    // Sin este corte, cada revalidación repintaría la rejilla entera aunque el
    // servidor no tenga nada que contar.
    test('una revalidación sin cambios no avisa ni cambia el valor', async () => {
        const load = vi.fn(() => Promise.resolve(['a']));
        const onRefreshed = vi.fn();
        const first = await cachedList('k', load, onRefreshed);
        vi.advanceTimersByTime(PAST_TTL);
        await cachedList('k', load, onRefreshed);
        await settle();

        expect(load).toHaveBeenCalledTimes(2);
        expect(onRefreshed).not.toHaveBeenCalled();
        expect(await cachedList('k', load, onRefreshed)).toBe(first);
    });

    test('mientras la revalidación está en vuelo no se lanza otra', async () => {
        const load = vi.fn(() => Promise.resolve(['a']));
        await cachedList('k', load);
        vi.advanceTimersByTime(PAST_TTL);
        await cachedList('k', load);
        await cachedList('k', load);

        expect(load).toHaveBeenCalledTimes(2);
    });

    test('invalidar obliga a pedirlo de nuevo', async () => {
        const load = vi.fn().mockResolvedValue(['a']);
        await cachedList('k', load);
        invalidateLists();
        await cachedList('k', load);
        expect(load).toHaveBeenCalledTimes(2);
    });

    // Los listados llevan estado por usuario (visto, progreso): al cambiar de
    // cuenta en la misma pestaña, la nueva no puede heredar la biblioteca de
    // la anterior.
    test('cada usuario tiene su entrada', async () => {
        const load = vi.fn()
            .mockResolvedValueOnce(['de u1'])
            .mockResolvedValueOnce(['de u2']);
        await cachedList('k', load);

        mocks.userId = 'u2';
        expect(await cachedList('k', load)).toEqual(['de u2']);

        mocks.userId = 'u1';
        expect(await cachedList('k', load)).toEqual(['de u1']);
        expect(load).toHaveBeenCalledTimes(2);
    });

    // Un fallo de red no puede quedarse pegado: la siguiente pantalla que pida
    // la lista tiene que poder traerla.
    test('un error no se cachea', async () => {
        const load = vi.fn()
            .mockRejectedValueOnce(new Error('sin red'))
            .mockResolvedValueOnce(['a']);
        await expect(cachedList('k', load)).rejects.toThrow('sin red');
        expect(await cachedList('k', load)).toEqual(['a']);
    });

    test('si la revalidación falla se sigue sirviendo lo que hay', async () => {
        const load = vi.fn()
            .mockResolvedValueOnce(['viejo'])
            .mockRejectedValueOnce(new Error('sin red'));
        const onRefreshed = vi.fn();
        await cachedList('k', load, onRefreshed);
        vi.advanceTimersByTime(PAST_TTL);
        await cachedList('k', load, onRefreshed);
        await settle();

        expect(onRefreshed).not.toHaveBeenCalled();
        expect(await cachedList('k', load, onRefreshed)).toEqual(['viejo']);
    });
});
