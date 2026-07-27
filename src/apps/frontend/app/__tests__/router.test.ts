// El router del frontend es la frontera entre la URL y el estado de la app:
// todo lo que navega pasa por routeToPath (al hacer pushState) y por
// pathToRoute (al arrancar y en popstate). Un fallo aquí no rompe un
// componente concreto, rompe los enlaces compartidos y el botón atrás.

import { describe, expect, it } from 'vitest';

import { fromAppPath, pathToRoute, routeToPath, toAppPath, type Route } from '../router';

// Una muestra de cada variante de Route, incluyendo ids que obligan a
// escapar: el ida y vuelta tiene que devolver exactamente lo mismo.
const ROUTES: Route[] = [
    { page: 'home' },
    { page: 'series' },
    { page: 'movies' },
    { page: 'favorites' },
    { page: 'search' },
    { page: 'settings' },
    { page: 'profile' },
    { page: 'show', showId: 'abc123' },
    { page: 'season', showId: 'abc123', seasonN: 2 },
    { page: 'episode', showId: 'abc123', seasonN: 2, epN: 7 },
    { page: 'movie', movieId: 'movie-42' },
    { page: 'genre', genre: 'Ciencia ficción' },
    { page: 'person', name: 'Ana Díaz' }
];

describe('router del frontend', () => {
    describe('ida y vuelta Route → URL → Route', () => {
        it.each(ROUTES)('conserva la ruta %j', (route) => {
            expect(pathToRoute(routeToPath(route))).toEqual(route);
        });

        it('escapa ids con caracteres especiales sin perderlos', () => {
            // Una barra dentro del id partiría el path si no se escapara, y
            // acabaríamos interpretando basura como si fuera /season/N.
            const route: Route = { page: 'show', showId: 'a/b?c&d' };
            const path = routeToPath(route);
            expect(path).not.toContain('a/b');
            expect(pathToRoute(path)).toEqual(route);
        });
    });

    describe('pathToRoute', () => {
        it('la raíz y la cadena vacía son la home', () => {
            expect(pathToRoute('/')).toEqual({ page: 'home' });
            expect(pathToRoute('')).toEqual({ page: 'home' });
        });

        it('tolera barras sobrantes', () => {
            expect(pathToRoute('//series//')).toEqual({ page: 'series' });
        });

        it('cualquier ruta desconocida cae a la home en vez de romper', () => {
            expect(pathToRoute('/no-existe')).toEqual({ page: 'home' });
            expect(pathToRoute('/show')).toEqual({ page: 'home' });
            expect(pathToRoute('/movie')).toEqual({ page: 'home' });
            expect(pathToRoute('/genre')).toEqual({ page: 'home' });
            expect(pathToRoute('/person')).toEqual({ page: 'home' });
        });

        it('un número de temporada no numérico degrada a la ficha de la serie', () => {
            // Preferimos enseñar la serie antes que una temporada NaN.
            expect(pathToRoute('/show/s1/season/abc')).toEqual({ page: 'show', showId: 's1' });
        });

        it('un número de episodio no numérico degrada a la temporada', () => {
            expect(pathToRoute('/show/s1/season/3/episode/xyz')).toEqual({
                page: 'season', showId: 's1', seasonN: 3
            });
        });

        it('una palabra clave desconocida tras el id degrada a la serie', () => {
            expect(pathToRoute('/show/s1/temporada/3')).toEqual({ page: 'show', showId: 's1' });
        });
    });

    describe('toAppPath / fromAppPath', () => {
        // Hoy son la identidad (el frontend vive en la raíz del hash router),
        // pero se conservan por si algún día se rebasea la app. Estos tests
        // fijan ese contrato para que un cambio de base no pase inadvertido.
        it('toAppPath garantiza la barra inicial', () => {
            expect(toAppPath('series')).toBe('/series');
            expect(toAppPath('/series')).toBe('/series');
        });

        it('fromAppPath devuelve la raíz ante un path vacío', () => {
            expect(fromAppPath('')).toBe('/');
            expect(fromAppPath('/movies')).toBe('/movies');
        });
    });
});
