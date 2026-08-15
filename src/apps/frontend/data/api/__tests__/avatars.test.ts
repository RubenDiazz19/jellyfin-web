// La fuente local del selector de avatares: la traducción de «items con su
// reparto» a candidatos de avatar. Lo que se prueba es el etiquetado por
// PERSONAJE (no por intérprete), el dedupe de papeles repetidos y los topes
// que evitan que un solo título copie la rejilla entera.

import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../http', () => ({
    fetchUserItems: vi.fn()
}));
// Solo interesa que devuelva una URL distinta por persona; el formato real
// (tag, maxHeight) ya lo prueba el módulo de imágenes.
vi.mock('../images', () => ({
    imageUrl: (id: string) => `img:${id}`
}));

import { fetchUserItems } from '../http';
import {
    buildAvatarFile, getLibraryCharacters, searchLibraryCharacters, type AvatarCandidate
} from '../avatars';
import type { JFItem } from '../types';

function person(
    id: string, name: string, opts: Partial<{ role: string; tag: string; type: string }> = {}
) {
    return {
        Id: id,
        Name: name,
        Role: opts.role,
        Type: opts.type ?? 'Actor',
        PrimaryImageTag: opts.tag ?? 'tag-1'
    };
}

function show(id: string, name: string, people: JFItem['People']): JFItem {
    return { Id: id, Name: name, People: people };
}

const mocked = vi.mocked(fetchUserItems);

beforeEach(() => { mocked.mockReset(); });

describe('getLibraryCharacters', () => {
    test('etiqueta con el personaje y acompaña con título e intérprete', async () => {
        mocked.mockResolvedValue([
            show('m1', 'Buffy', [
                person('p1', 'Sarah Michelle Gellar', { role: 'Buffy Summers' })
            ])
        ]);

        const [cand] = await getLibraryCharacters();

        expect(cand).toMatchObject({
            id: 'lib-p1-m1',
            name: 'Buffy Summers',
            subtitle: 'Buffy · Sarah Michelle Gellar',
            series: 'Buffy',
            imageUrl: 'img:p1',
            source: 'library'
        });
    });

    test('sin papel conocido, el nombre del intérprete hace de etiqueta', async () => {
        mocked.mockResolvedValue([
            show('m1', 'Frágil', [person('p1', 'Fernando Fernán Gómez')])
        ]);

        const [cand] = await getLibraryCharacters();

        expect(cand?.name).toBe('Fernando Fernán Gómez');
        expect(cand?.subtitle).toBe('Frágil');
        expect(cand?.series).toBe('Frágil');
    });

    test('solo actores con foto: se saltan dobladores sin cara y no-actores', async () => {
        mocked.mockResolvedValue([
            show('m1', 'Serie', [
                person('p1', 'Actor sin foto', { tag: '' }),
                person('p2', 'Director', { type: 'Director' }),
                person('p3', 'Actor bueno')
            ])
        ]);

        const cands = await getLibraryCharacters();

        expect(cands.map((c) => c.id)).toEqual(['lib-p3-m1']);
    });

    test('un papel repetido en varios títulos sale una vez; papeles distintos, cada uno el suyo', async () => {
        mocked.mockResolvedValue([
            show('m1', 'Primera', [person('p1', 'Interprete', { role: 'Papel' })]),
            show('m2', 'Segunda', [person('p1', 'Interprete', { role: 'Papel' })]),
            show('m3', 'Tercera', [person('p1', 'Interprete', { role: 'Otro papel' })])
        ]);

        const cands = await getLibraryCharacters();

        expect(cands.map((c) => c.name)).toEqual(['Papel', 'Otro papel']);
        // El id lleva el item: el mismo papel «visto desde» títulos distintos
        // deduplica, y quedarse con la primera aparición es suficiente.
        expect(new Set(cands.map((c) => c.id)).size).toBe(2);
    });

    test('tope de reparto por item y de candidatos por consulta', async () => {
        // 3 títulos × 10 actores: 6 por título pasan el corte → 18 en juego,
        // que no alcanzan el tope global… así que este lote prueba el primero.
        const cast = Array.from({ length: 10 }, (_, i) =>
            person(`p${i}`, `Actor ${i}`, { role: `Rol ${i}` })
        );
        mocked.mockResolvedValue([
            show('m1', 'A', cast), show('m2', 'B', cast.map((p) => ({ ...p, Id: `b${p.Id}` })))
        ]);

        const cands = await getLibraryCharacters();

        expect(cands).toHaveLength(12); // 2 títulos × CAST_PER_ITEM

        // 5 títulos × 6 actores = 30 > LOCAL_LIMIT: el global también corta.
        const five = Array.from({ length: 5 }, (_, t) =>
            show(`t${t}`, `T${t}`, Array.from({ length: 6 }, (_j, j) =>
                person(`p${t}-${j}`, `Actor ${t}-${j}`, { role: `Rol ${t}-${j}` })))
        );
        mocked.mockResolvedValue(five);
        const capped = await getLibraryCharacters();
        expect(capped).toHaveLength(24);
    });
});

describe('searchLibraryCharacters', () => {
    test('busca por título y codifica el término', async () => {
        mocked.mockResolvedValue([]);

        await searchLibraryCharacters('el señor de las moscas');

        expect(mocked).toHaveBeenCalledWith(
            expect.stringContaining(`SearchTerm=${encodeURIComponent('el señor de las moscas')}`)
        );
        expect(mocked).toHaveBeenCalledWith(expect.stringContaining('Fields=People'));
    });
});

describe('buildAvatarFile', () => {
    // El pipeline completo (canvas, toBlob) no corre en jsdom; lo que importa
    // aquí es la petición, que es donde vivía el bug del «Failed to fetch».
    const candidate: AvatarCandidate = {
        id: 'ani-1', name: 'N', subtitle: 'S', imageUrl: 'https://cdn/art.png', source: 'anilist'
    };

    test('la imagen se pide saltando la caché HTTP', async () => {
        // La rejilla ya enseñó esa URL como tile (sin CORS) y el CDN la cachea
        // un mes: reutilizar esa entrada en el fetch con CORS rompe la
        // comprobación con un «Failed to fetch». Se exige `cache: 'reload'`.
        const fetchMock = vi.fn(() => Promise.resolve({ ok: false } as Response));
        vi.stubGlobal('fetch', fetchMock);

        await expect(buildAvatarFile(candidate)).rejects.toThrow();
        expect(fetchMock).toHaveBeenCalledWith(candidate.imageUrl, { cache: 'reload' });

        vi.unstubAllGlobals();
    });
});
