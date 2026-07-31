// Lectura del JSON generado. Lo importante que se prueba aquí: el fichero se
// valida AL LEERLO, así que editar el vocabulario no obliga a regenerarlo y un
// JSON tocado a mano no puede meter etiquetas fuera de la lista.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { MAX_TAGS_PER_ITEM } from '../vocabulary';

vi.mock('../autoTags.json', () => ({
    default: {
        _generatedAt: '2026-07-31T00:00:00.000Z',
        items: {
            ok: ['Anime', 'Venganza'],
            grafia: ['anime', '  WESTERN '],
            inventadas: ['Comedia romántica', 'Bélico'],
            todoInventado: ['Chorrada'],
            vacio: [],
            duplicadas: ['Anime', 'ANIME'],
            demasiadas: ['Anime', 'Venganza', 'Western', 'Bélico', 'Musical', 'Prisión', 'Terror'],
            noEsLista: 'Anime'
        }
    }
}));

describe('autoTagsFor', () => {
    let mod: typeof import('../index');

    beforeEach(async () => {
        vi.resetModules();
        mod = await import('../index');
    });

    test('devuelve las etiquetas del item', () => {
        expect(mod.autoTagsFor('ok')).toEqual(['Anime', 'Venganza']);
    });

    test('normaliza la grafía a la del vocabulario', () => {
        expect(mod.autoTagsFor('grafia')).toEqual(['Anime', 'Western']);
    });

    test('descarta lo que no está en el vocabulario', () => {
        expect(mod.autoTagsFor('inventadas')).toEqual(['Bélico']);
    });

    test('un item cuyas etiquetas ya no existen desaparece', () => {
        expect(mod.autoTagsFor('todoInventado')).toEqual([]);
    });

    test('la lista vacía es un item ya procesado sin etiquetas', () => {
        expect(mod.autoTagsFor('vacio')).toEqual([]);
    });

    test('deduplica', () => {
        expect(mod.autoTagsFor('duplicadas')).toEqual(['Anime']);
    });

    test('recorta al máximo por item', () => {
        expect(mod.autoTagsFor('demasiadas')).toHaveLength(MAX_TAGS_PER_ITEM);
    });

    test('tolera un valor que no es lista', () => {
        expect(mod.autoTagsFor('noEsLista')).toEqual([]);
    });

    test('un id desconocido no rompe', () => {
        expect(mod.autoTagsFor('no-existe')).toEqual([]);
        expect(mod.autoTagsFor(undefined)).toEqual([]);
    });

    test('cuenta solo los items con etiquetas útiles', () => {
        // ok, grafia, inventadas, duplicadas, demasiadas
        expect(mod.autoTaggedCount()).toBe(5);
    });

    test('expone cuándo se generó', () => {
        expect(mod.autoTagsGeneratedAt()).toBe('2026-07-31T00:00:00.000Z');
    });
});
