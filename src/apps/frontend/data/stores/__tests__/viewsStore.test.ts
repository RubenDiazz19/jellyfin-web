// Vistas guardadas: persistencia, reemplazo por nombre y tolerancia a
// contenido corrupto en localStorage.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPersistentStores } from '../persistentStore';
import { VIEWS } from '../viewsStore';

const base = { name: 'Anime', typeFilter: 'series', stateFilter: 'todo' };

beforeEach(() => {
    // Primero volcar: las escrituras del store van por lotes y una que
    // quedara en cola caería DESPUÉS del `clear()` —y encima del contenido
    // que los tests de abajo siembran a mano en localStorage—.
    flushPersistentStores();
    localStorage.clear();
    // El store cachea en memoria; recargar el módulo lo deja limpio.
    vi.resetModules();
});

describe('viewsStore', () => {
    test('guarda y devuelve la vista con id', () => {
        const saved = VIEWS.save(base);
        expect(saved.id).toBeTruthy();
        expect(VIEWS.all()).toHaveLength(1);
        expect(VIEWS.all()[0].name).toBe('Anime');
    });

    test('conserva tag y query', () => {
        VIEWS.save({ ...base, tag: 'anime', query: 'cine' });
        expect(VIEWS.all()[0]).toMatchObject({ tag: 'anime', query: 'cine' });
    });

    test('guardar con el mismo nombre reemplaza en su sitio, no duplica', () => {
        VIEWS.save(base);
        VIEWS.save({ ...base, stateFilter: 'favs' });
        expect(VIEWS.all()).toHaveLength(1);
        expect(VIEWS.all()[0].stateFilter).toBe('favs');
    });

    test('el reemplazo por nombre ignora mayúsculas', () => {
        VIEWS.save(base);
        VIEWS.save({ ...base, name: 'ANIME' });
        expect(VIEWS.all()).toHaveLength(1);
    });

    test('remove borra solo esa vista', () => {
        const a = VIEWS.save(base);
        VIEWS.save({ ...base, name: 'Otra' });
        VIEWS.remove(a.id);
        expect(VIEWS.all().map((v) => v.name)).toEqual(['Otra']);
    });

    test('notifica por evento para que la UI re-lea', () => {
        const seen = vi.fn();
        window.addEventListener(VIEWS.event, seen);
        VIEWS.save(base);
        expect(seen).toHaveBeenCalled();
        window.removeEventListener(VIEWS.event, seen);
    });

    test('sobrevive a un storage corrupto', async () => {
        localStorage.setItem('jfp-views', '{no es json');
        const { VIEWS: fresh } = await import('../viewsStore');
        expect(fresh.all()).toEqual([]);
    });

    test('descarta entradas con forma inválida', async () => {
        localStorage.setItem('jfp-views', JSON.stringify([{ nope: 1 }, null]));
        const { VIEWS: fresh } = await import('../viewsStore');
        expect(fresh.all()).toEqual([]);
    });
});
