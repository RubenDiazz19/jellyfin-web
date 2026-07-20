// Tests del store de "visto": toggle/setMany y la sincronización por scope
// que usan getShow()/getMovies() para hidratar desde el server.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { WATCHED } from '../watchedStore';

describe('WATCHED store', () => {
    beforeEach(() => {
        localStorage.clear();
        // El caché en memoria del módulo sobrevive entre tests: se vacía
        // sincronizando un scope que cubra todo lo que haya.
        WATCHED.sync(['a', 'b', 'c', 's1-e1', 's1-e2', 'movie-1', 'fuera'], []);
    });

    test('toggle añade y quita', () => {
        expect(WATCHED.has('a')).toBe(false);
        WATCHED.toggle('a');
        expect(WATCHED.has('a')).toBe(true);
        WATCHED.toggle('a');
        expect(WATCHED.has('a')).toBe(false);
    });

    test('setMany marca y desmarca en bloque', () => {
        WATCHED.setMany(['a', 'b'], true);
        expect(WATCHED.has('a')).toBe(true);
        expect(WATCHED.has('b')).toBe(true);
        WATCHED.setMany(['a', 'b'], false);
        expect(WATCHED.has('a')).toBe(false);
    });

    test('sync alinea el scope con la lista del server', () => {
        WATCHED.setMany(['s1-e1', 's1-e2'], true);
        // El server dice que solo e2 está visto.
        WATCHED.sync(['s1-e1', 's1-e2'], ['s1-e2']);
        expect(WATCHED.has('s1-e1')).toBe(false);
        expect(WATCHED.has('s1-e2')).toBe(true);
    });

    test('sync no toca ids fuera del scope', () => {
        WATCHED.setMany(['fuera'], true);
        WATCHED.sync(['s1-e1'], []);
        expect(WATCHED.has('fuera')).toBe(true);
    });

    test('sync emite un único evento aunque cambien varios ids', () => {
        const spy = vi.fn();
        window.addEventListener(WATCHED.event, spy);
        WATCHED.sync(['a', 'b', 'c'], ['a', 'b', 'c']);
        expect(spy).toHaveBeenCalledTimes(1);
        window.removeEventListener(WATCHED.event, spy);
    });

    test('sync sin cambios no emite evento', () => {
        WATCHED.sync(['a'], ['a']);
        const spy = vi.fn();
        window.addEventListener(WATCHED.event, spy);
        WATCHED.sync(['a'], ['a']);
        expect(spy).not.toHaveBeenCalled();
        window.removeEventListener(WATCHED.event, spy);
    });
});
