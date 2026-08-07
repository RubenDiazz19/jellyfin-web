// Qué manda cada modo del diálogo de refresco.
//
// Es lo único que separa «busca capítulos nuevos» de «vuelve a bajarlo todo»,
// y el fallo no se ve al ejecutarlo: la petición se acepta igual y lo que se
// nota, media hora después, es que las carátulas han cambiado solas. Así que
// los cinco parámetros de la query se comprueban uno a uno.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    apiSend: vi.fn(),
    emitItemMutated: vi.fn()
}));

vi.mock('../http', () => ({
    apiSend: mocks.apiSend,
    noSessionError: () => new Error('sin sesión'),
    trimSlash: (u: string) => u.replace(/\/$/, '')
}));
vi.mock('../cache', () => ({ clearShowCache: vi.fn() }));
vi.mock('../deleted', () => ({ markDeleted: vi.fn() }));
vi.mock('../mutations', () => ({
    emitItemMutated: mocks.emitItemMutated,
    emitItemDeleted: vi.fn()
}));
vi.mock('../../session/session', () => ({ loadSession: () => ({ userId: 'u1' }) }));

import { refreshItemMetadata } from '../items';

/** Los parámetros con los que se llamó a `/Items/{id}/Refresh`. */
function sentQuery(): URLSearchParams {
    const path = mocks.apiSend.mock.calls[0][0] as string;
    return new URLSearchParams(path.split('?')[1]);
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiSend.mockResolvedValue(new Response(null, { status: 204 }));
});

describe('refreshItemMetadata', () => {
    test('«solo lo nuevo» no vuelve a preguntar a los proveedores', async () => {
        await refreshItemMetadata('i1', { mode: 'scan' });

        const q = sentQuery();
        expect(q.get('metadataRefreshMode')).toBe('Default');
        expect(q.get('imageRefreshMode')).toBe('Default');
        expect(q.get('replaceAllMetadata')).toBe('false');
        expect(q.get('replaceAllImages')).toBe('false');
    });

    test('«lo que falte» consulta a los proveedores pero conserva lo que hay', async () => {
        await refreshItemMetadata('i1', { mode: 'missing' });

        const q = sentQuery();
        expect(q.get('metadataRefreshMode')).toBe('FullRefresh');
        expect(q.get('replaceAllMetadata')).toBe('false');
        expect(q.get('replaceAllImages')).toBe('false');
    });

    test('«reemplazar todo» rehace los metadatos, no las imágenes', async () => {
        await refreshItemMetadata('i1', { mode: 'all' });

        const q = sentQuery();
        expect(q.get('replaceAllMetadata')).toBe('true');
        // Las imágenes van aparte a propósito: rehacer los metadatos no
        // implica tirar las carátulas que ya estaban.
        expect(q.get('replaceAllImages')).toBe('false');
    });

    test('las imágenes solo se reemplazan si se marca', async () => {
        await refreshItemMetadata('i1', { mode: 'all', replaceImages: true, replaceTrickplay: true });

        const q = sentQuery();
        expect(q.get('replaceAllImages')).toBe('true');
        expect(q.get('regenerateTrickplay')).toBe('true');
    });

    test('en modo escaneo se ignora lo marcado: no hay nada que reemplazar', async () => {
        await refreshItemMetadata('i1', { mode: 'scan', replaceImages: true, replaceTrickplay: true });

        const q = sentQuery();
        expect(q.get('replaceAllImages')).toBe('false');
        expect(q.get('regenerateTrickplay')).toBe('false');
    });

    test('avisa de que el item ha cambiado', async () => {
        await refreshItemMetadata('i1', { mode: 'scan' });
        expect(mocks.emitItemMutated).toHaveBeenCalledWith('i1');
    });
});
