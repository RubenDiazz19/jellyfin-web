// Etiquetas: normalización y escritura. Lo que se prueba de verdad es que el
// guardado NO pierda campos del item: `POST /Items/{id}` reescribe el item
// entero, así que un merge mal hecho borra metadatos ajenos.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    apiFetch: vi.fn(),
    apiSend: vi.fn(),
    clearShowCache: vi.fn(),
    emitItemMutated: vi.fn()
}));

vi.mock('../http', () => ({
    apiFetch: mocks.apiFetch,
    apiSend: mocks.apiSend,
    noSessionError: () => new Error('sin sesión')
}));
vi.mock('../cache', () => ({ clearShowCache: mocks.clearShowCache }));
vi.mock('../mutations', () => ({ emitItemMutated: mocks.emitItemMutated }));
vi.mock('../../session/session', () => ({ loadSession: () => ({ userId: 'u1' }) }));

import { normalizeTags, setItemTags, setItemsTags } from '../metadata';

/** Cuerpo del n-ésimo POST /Items/{id}. */
function postedBody(nth = 0): Record<string, unknown> {
    return mocks.apiSend.mock.calls[nth][2] as Record<string, unknown>;
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiSend.mockResolvedValue(new Response(null, { status: 204 }));
});

describe('normalizeTags', () => {
    test('recorta, quita vacíos y ordena', () => {
        expect(normalizeTags([' cine ', '', '  ', 'anime'])).toEqual(['anime', 'cine']);
    });

    test('deduplica ignorando mayúsculas pero conserva la primera grafía', () => {
        expect(normalizeTags(['Cine', 'cine', 'CINE'])).toEqual(['Cine']);
    });
});

describe('setItemTags', () => {
    test('reemplaza las etiquetas conservando el resto del item', async () => {
        mocks.apiFetch.mockResolvedValue({
            Id: 'i1', Name: 'Peli', Overview: 'sinopsis', Tags: ['viejo']
        });

        await setItemTags('i1', ['nuevo', 'nuevo', ' otro ']);

        const body = postedBody();
        expect(body.Tags).toEqual(['nuevo', 'otro']);
        // Lo que no se toca tiene que seguir ahí.
        expect(body.Name).toBe('Peli');
        expect(body.Overview).toBe('sinopsis');
        expect(mocks.emitItemMutated).toHaveBeenCalledWith('i1');
    });
});

describe('setItemsTags', () => {
    test('suma a las etiquetas que ya tuviera cada item', async () => {
        mocks.apiFetch
            .mockResolvedValueOnce({ Id: 'i1', Name: 'A', Tags: ['ya'] })
            .mockResolvedValueOnce({ Id: 'i2', Name: 'B' });

        await setItemsTags(['i1', 'i2'], ['nueva']);

        expect(postedBody(0).Tags).toEqual(['nueva', 'ya']);
        expect(postedBody(1).Tags).toEqual(['nueva']);
    });

    test('emite una sola invalidación para todo el lote', async () => {
        mocks.apiFetch.mockResolvedValue({ Id: 'x' });

        await setItemsTags(['i1', 'i2', 'i3'], ['t']);

        expect(mocks.apiSend).toHaveBeenCalledTimes(3);
        expect(mocks.emitItemMutated).toHaveBeenCalledTimes(1);
    });

    test('sin items o sin etiquetas no toca el servidor', async () => {
        await setItemsTags([], ['t']);
        await setItemsTags(['i1'], ['  ']);
        expect(mocks.apiSend).not.toHaveBeenCalled();
        expect(mocks.emitItemMutated).not.toHaveBeenCalled();
    });
});
