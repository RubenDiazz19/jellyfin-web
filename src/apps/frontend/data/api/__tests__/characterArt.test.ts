// El resolutor de arte de personajes (AniList): que la búsqueda de una serie
// devuelva el mapa `rol → arte` con nombres normalizados, que la caché evite
// repetir peticiones, que los llamantes concurrentes de la misma serie
// compartan la llamada y que una caída de AniList cuente como «no hay arte»
// sin romper a quien llama.

import { afterEach, describe, expect, test, vi } from 'vitest';

import { normalizeName, resolveSeriesArt } from '../characterArt';

// La caché es de módulo y vive entre tests del mismo fichero: cada caso usa
// series distintas para que ninguno herede lo que pidió el anterior.
afterEach(() => {
    vi.unstubAllGlobals();
});

function okResponse(data: unknown): Response {
    return {
        ok: true,
        status: 200,
        json: async () => data
    } as unknown as Response;
}

describe('resolveSeriesArt', () => {
    test('devuelve rol → arte de los personajes de la serie, por nombre normalizado', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okResponse({
            data: { Media: { characters: { nodes: [
                { name: { full: 'Uzumaki Naruto' }, image: { large: 'https://art/naruto' } },
                { name: { full: 'Haruno Sakura' }, image: { large: 'https://art/sakura' } },
                // Sin imagen o sin nombre: no llegan al mapa.
                { name: { full: 'Anónimo' }, image: { large: null } },
                { name: { full: null }, image: { large: 'https://art/x' } }
            ] } } }
        }));
        vi.stubGlobal('fetch', fetchMock);

        const art = await resolveSeriesArt('Naruto');

        expect(art.get(normalizeName('Uzumaki Naruto'))).toBe('https://art/naruto');
        expect(art.get(normalizeName('Haruno Sakura'))).toBe('https://art/sakura');
        expect(art.size).toBe(2);
        // La petición busca la serie por su título, con el tipo ANIME.
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [, opts] = fetchMock.mock.calls[0];
        const body = JSON.parse((opts as RequestInit).body as string);
        expect(body.variables).toEqual({ search: 'Naruto' });
        expect(body.query).toContain('type: ANIME');
    });

    test('un mismo nombre duplicado se queda con el primer arte', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okResponse({
            data: { Media: { characters: { nodes: [
                { name: { full: 'Naruto Uzumaki' }, image: { large: 'https://art/1' } },
                { name: { full: 'naruto uzumaki' }, image: { large: 'https://art/2' } }
            ] } } }
        }));
        vi.stubGlobal('fetch', fetchMock);

        const art = await resolveSeriesArt('Shippuden');

        expect(art.get('naruto uzumaki')).toBe('https://art/1');
    });

    test('la caché evita volver a preguntar por la misma serie', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okResponse({
            data: { Media: { characters: { nodes: [] } } }
        }));
        vi.stubGlobal('fetch', fetchMock);

        await resolveSeriesArt('Bleach');
        await resolveSeriesArt('bleach'); // normaliza igual
        await resolveSeriesArt('Bleach');

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('dos peticiones a la vez de la misma serie comparten la llamada', async () => {
        let release: (v: Response) => void = () => {};
        const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { release = resolve; }));
        vi.stubGlobal('fetch', fetchMock);

        const a = resolveSeriesArt('One Piece');
        const b = resolveSeriesArt('one piece');
        release(okResponse({ data: { Media: { characters: { nodes: [] } } } }));

        await Promise.all([a, b]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('una caída de AniList cuenta como «no hay arte» y no rompe al llamante', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('sin red'));
        vi.stubGlobal('fetch', fetchMock);

        const art = await resolveSeriesArt('Cowboy Bebop');

        expect(art.size).toBe(0);
        // El hueco queda recordado: la segunda vez tampoco vuelve a la red.
        await resolveSeriesArt('cowboy bebop');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('un `errors` de GraphQL o un HTTP roto también valen como vacío', async () => {
        const errorsMock = vi.fn().mockResolvedValue(okResponse({
            errors: [{ message: 'boom' }]
        }));
        vi.stubGlobal('fetch', errorsMock);

        expect((await resolveSeriesArt('Fullmetal Alchemist')).size).toBe(0);

        const httpMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
        vi.stubGlobal('fetch', httpMock);

        expect((await resolveSeriesArt('Akira')).size).toBe(0);
    });

    test('serie en blanco devuelve vacío sin tocar la red', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        expect((await resolveSeriesArt('   ')).size).toBe(0);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
