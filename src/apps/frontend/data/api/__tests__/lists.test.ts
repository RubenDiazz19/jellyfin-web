// Plegado de series en las listas de reproducción.
//
// El servidor no guarda la serie que metes: la expande en TODOS sus episodios,
// una entrada por capítulo. Estas funciones deshacen eso para que la lista se
// vea y se maneje como el título que el usuario añadió.

import { describe, expect, test } from 'vitest';
import { collapseSeries, entryIndex, type PlaylistItem } from '../lists';

const movie = (id: string, entryId = `e-${id}`): PlaylistItem =>
    ({ id, title: `Peli ${id}`, kind: 'movie', entryId });

const episode = (n: number, seriesId = 's1', seriesName = 'Mi serie'): PlaylistItem => ({
    id: `ep${n}`,
    title: `Episodio ${n}`,
    kind: 'episode',
    entryId: `e-ep${n}`,
    seriesId,
    seriesName,
    poster: `frame-${n}`,
    seriesPoster: 'caratula-serie',
    seriesLogo: 'logo-serie'
});

describe('collapseSeries', () => {
    test('14 episodios de una serie son un solo título', () => {
        const items = Array.from({ length: 14 }, (_, i) => episode(i + 1));
        const out = collapseSeries(items);
        expect(out).toHaveLength(1);
        expect(out[0].title).toBe('Mi serie');
        expect(out[0].kind).toBe('show');
        expect(out[0].id).toBe('s1');
    });

    test('usa la carátula de la serie, no el fotograma del capítulo', () => {
        expect(collapseSeries([episode(1)])[0].poster).toBe('caratula-serie');
    });

    test('sin carátula de serie se queda con la del capítulo', () => {
        const ep = { ...episode(1), seriesPoster: undefined };
        expect(collapseSeries([ep])[0].poster).toBe('frame-1');
    });

    test('usa el logo de la SERIE, no el del capítulo', () => {
        // El episodio casi nunca tiene logo propio; si se dejara el suyo, la
        // tarjeta caería al título en texto y no casaría con las películas.
        const ep = { ...episode(1), logo: 'logo-del-capitulo' };
        expect(collapseSeries([ep])[0].logo).toBe('logo-serie');
    });

    test('sin logo de serie se queda sin logo, no con el del capítulo', () => {
        const ep = { ...episode(1), seriesLogo: null, logo: 'logo-del-capitulo' };
        expect(collapseSeries([ep])[0].logo).toBeNull();
    });

    test('las películas pasan intactas', () => {
        const out = collapseSeries([movie('m1')]);
        expect(out).toEqual([movie('m1')]);
    });

    test('conserva el orden y el sitio del primer capítulo', () => {
        const out = collapseSeries([movie('m1'), episode(1), episode(2), movie('m2')]);
        expect(out.map((i) => i.id)).toEqual(['m1', 's1', 'm2']);
    });

    test('dos series distintas se pliegan por separado', () => {
        const out = collapseSeries([
            episode(1, 's1', 'Serie A'),
            episode(1, 's2', 'Serie B'),
            episode(2, 's1', 'Serie A')
        ]);
        expect(out.map((i) => i.title)).toEqual(['Serie A', 'Serie B']);
    });

    test('un episodio sin serie no se pliega: no hay a qué', () => {
        const suelto: PlaylistItem = {
            id: 'x', title: 'Suelto', kind: 'episode', entryId: 'e-x'
        };
        expect(collapseSeries([suelto])).toEqual([suelto]);
    });

    test('una lista vacía sigue vacía', () => {
        expect(collapseSeries([])).toEqual([]);
    });
});

describe('entryIndex', () => {
    test('una serie agrupa las entradas de todos sus capítulos', () => {
        const index = entryIndex([episode(1), episode(2), episode(3)]);
        // Quitar la serie tiene que borrar las tres de golpe.
        expect(index.get('s1')).toEqual(['e-ep1', 'e-ep2', 'e-ep3']);
        expect(index.size).toBe(1);
    });

    test('una película es una sola entrada, indexada por su id', () => {
        expect(entryIndex([movie('m1')]).get('m1')).toEqual(['e-m1']);
    });

    test('descarta lo que no trae id de entrada: no se podría borrar', () => {
        const sinEntrada: PlaylistItem = { id: 'm9', title: 'x', kind: 'movie' };
        expect(entryIndex([sinEntrada]).size).toBe(0);
    });

    test('el mismo título dos veces guarda sus dos entradas', () => {
        const index = entryIndex([movie('m1', 'e1'), movie('m1', 'e2')]);
        expect(index.get('m1')).toEqual(['e1', 'e2']);
    });
});
