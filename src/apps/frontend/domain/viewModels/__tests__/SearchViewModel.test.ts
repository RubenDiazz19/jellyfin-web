// Filtrado por etiquetas (chips, sintaxis `#tag` y la unión que alimenta la
// fila de chips) y la búsqueda que sale al servidor.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// El VM importa ApiService, que llega a ServerConnections y con él al
// bootstrap legacy (router raíz + playbackmanager) con efectos a nivel de
// módulo. Se corta en la misma frontera que playbackHarness.
vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        getApi: () => null,
        getCurrentUserId: () => null,
        getCurrentServerId: () => null,
        connect: () => Promise.resolve(),
        logout: () => Promise.resolve()
    }
}));

import { parseQuery, SearchViewModel } from '../SearchViewModel';
import type { ApiService } from '../../../data/api/ApiService';
import type { Movie, Show } from '../../../data/models';

function show(id: string, title: string, tags?: string[], autoTags?: string[], genres: string[] = [], rating?: { imdb: number; age: string }): Show {
    return { id, title, tags, autoTags, genres, rating: rating ?? { imdb: 0, age: 'N/A' }, seasons: [] } as unknown as Show;
}
function movie(id: string, title: string, tags?: string[], autoTags?: string[], genres: string[] = [], rating?: { imdb: number; age: string }): Movie {
    return { id, title, tags, autoTags, genres, rating: rating ?? { imdb: 0, age: 'N/A' } } as unknown as Movie;
}

/** VM con la biblioteca ya cargada; sin sesión para que `load()` no dispare. */
function makeVm(shows: Show[] = [], movies: Movie[] = []) {
    const api = {
        session: { load: () => null },
        catalog: { getShows: vi.fn(), getMovies: vi.fn() }
    } as unknown as ApiService;
    const vm = new SearchViewModel(api);
    vm.shows.value = shows;
    vm.movies.value = movies;
    return vm;
}

/** Ids de los resultados, para afirmar sin arrastrar el objeto entero. */
function ids(vm: SearchViewModel): string[] {
    return vm.results.value.map((r) => r.id);
}

describe('parseQuery', () => {
    test('separa etiquetas del texto libre', () => {
        expect(parseQuery('#anime cine')).toEqual({ text: 'cine', tags: ['anime'] });
    });

    test('varias etiquetas', () => {
        expect(parseQuery('#a #b')).toEqual({ text: '', tags: ['a', 'b'] });
    });

    test('una almohadilla suelta no filtra: es una etiqueta a medio escribir', () => {
        expect(parseQuery('# ')).toEqual({ text: '', tags: [] });
    });

    test('normaliza a minúsculas', () => {
        expect(parseQuery('#Anime')).toEqual({ text: '', tags: ['anime'] });
    });
});

describe('filtro por etiqueta', () => {
    const vm = () => makeVm(
        [show('s1', 'Serie A', ['anime']), show('s2', 'Serie B')],
        [movie('m1', 'Peli', ['anime', 'comedia'])]
    );

    test('sin filtro salen todos', () => {
        expect(ids(vm())).toEqual(['s1', 's2', 'm1']);
    });

    test('el chip filtra por esa etiqueta', () => {
        const v = vm();
        v.toggleTagFilter('anime');
        expect(ids(v)).toEqual(['s1', 'm1']);
    });

    test('la etiqueta del chip ignora mayúsculas', () => {
        const v = vm();
        v.toggleTagFilter('ANIME');
        expect(ids(v)).toEqual(['s1', 'm1']);
    });

    test('`#tag` en la caja filtra igual que el chip', () => {
        const v = vm();
        v.setQuery('#comedia');
        expect(ids(v)).toEqual(['m1']);
    });

    test('`#tag` y texto libre se combinan', () => {
        const v = vm();
        v.setQuery('#anime Serie');
        expect(ids(v)).toEqual(['s1']);
    });

    test('chip y `#tag` se acumulan: hacen falta las dos etiquetas', () => {
        const v = vm();
        v.toggleTagFilter('comedia');
        v.setQuery('#anime');
        expect(ids(v)).toEqual(['m1']);
    });

    test('clearTagFilters desactiva el filtro', () => {
        const v = vm();
        v.toggleTagFilter('anime');
        v.clearTagFilters();
        expect(ids(v)).toEqual(['s1', 's2', 'm1']);
    });

    test('volver a pulsar el mismo chip lo quita', () => {
        const v = vm();
        v.toggleTagFilter('anime');
        v.toggleTagFilter('anime');
        expect(v.tagFilters.value).toEqual([]);
        expect(ids(v)).toEqual(['s1', 's2', 'm1']);
    });

    test('quitar un chip ignora la grafía con la que se puso', () => {
        const v = vm();
        v.toggleTagFilter('Anime');
        v.toggleTagFilter('ANIME');
        expect(v.tagFilters.value).toEqual([]);
    });

    test('cuenta como filtro activo', () => {
        const v = vm();
        expect(v.anyFilterActive.value).toBe(false);
        v.toggleTagFilter('anime');
        expect(v.anyFilterActive.value).toBe(true);
    });
});

describe('allTags (los chips que se pintan)', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('une las automáticas de series y películas, ordenadas', () => {
        const v = makeVm(
            [show('s1', 'A', [], ['Western', 'Anime'])],
            [movie('m1', 'B', [], ['Bélico'])]
        );
        expect(v.allTags.value).toEqual(['Anime', 'Bélico', 'Western']);
    });

    test('deduplica ignorando mayúsculas y conserva la primera grafía', () => {
        const v = makeVm(
            [show('s1', 'A', [], ['Anime'])],
            [movie('m1', 'B', [], ['anime'])]
        );
        expect(v.allTags.value).toEqual(['Anime']);
    });

    test('las etiquetas de servidor y automáticas conviven en la lista', () => {
        const v = makeVm([show('s1', 'A', ['Comedia'], ['Anime'])]);
        expect(v.allTags.value).toEqual(['Anime', 'Comedia']);
    });

    test('los géneros no se incluyen como chips de etiquetas ya que pertenecen a la categoría de géneros', () => {
        const v = makeVm(
            [show('s1', 'A', [], [], ['War & Politics', 'Drama'])],
            [movie('m1', 'B', [], [], ['Action & Adventure'])]
        );
        expect(v.allTags.value).toEqual([]);
    });

    test('sin etiquetas devuelve lista vacía (la fila de chips se oculta)', () => {
        expect(makeVm([show('s1', 'A')]).allTags.value).toEqual([]);
    });
});

describe('availableTags (filtrado dinámico por facetas)', () => {
    test('sin filtros activos devuelve todas las etiquetas', () => {
        const v = makeVm(
            [show('s1', 'A', ['Acción', 'Superhéroes'])],
            [movie('m1', 'B', ['Comedia', 'Romance'])]
        );
        expect(v.availableTags.value).toEqual(['Acción', 'Comedia', 'Romance', 'Superhéroes']);
    });

    test('con varios resultados muestra las etiquetas conjuntas que permiten refinar', () => {
        const v = makeVm(
            [
                show('s1', 'A', ['Acción', 'Superhéroes']),
                show('s2', 'B', ['Acción', 'Comedia'])
            ],
            [movie('m1', 'C', ['Romance'])]
        );
        v.toggleTagFilter('Acción');
        // Hay 2 resultados (s1 y s2): se muestran las etiquetas conjuntas para poder seguir refinando
        expect(v.availableTags.value).toEqual(['Acción', 'Comedia', 'Superhéroes']);
    });

    test('si todos los resultados filtrados comparten una etiqueta, no se ofrece por no discriminar', () => {
        const v = makeVm([
            show('s1', 'Amagami', ['Comedia', 'Anime', 'Romance']),
            show('s2', 'Grand Blue', ['Comedia', 'Anime', 'Deportes']),
            show('s3', 'Polar Opposites', ['Comedia', 'Anime', 'Instituto'])
        ]);
        v.toggleTagFilter('Comedia');
        // Los 3 resultados tienen 'Anime': seleccionar 'Anime' no acotaría nada,
        // por lo que no se ofrece. 'Deportes', 'Instituto' y 'Romance' sí acotan.
        expect(v.availableTags.value).toEqual(['Comedia', 'Deportes', 'Instituto', 'Romance']);
    });

    test('si al filtrar solo queda 1 resultado, desaparecen las demás opciones irrelevantes', () => {
        const v = makeVm(
            [show('s1', 'A', ['Acción', 'Superhéroes'])],
            [movie('m1', 'B', ['Comedia', 'Romance'])]
        );
        v.toggleTagFilter('Acción');
        // Solo queda s1: 'Superhéroes' daría el mismo contenido, así que desaparece y solo queda la activa
        expect(v.availableTags.value).toEqual(['Acción']);
    });

    test('al desmarcar la etiqueta se restaura la lista completa de opciones', () => {
        const v = makeVm(
            [show('s1', 'A', ['Acción', 'Superhéroes'])],
            [movie('m1', 'B', ['Comedia', 'Romance'])]
        );
        v.toggleTagFilter('Acción');
        expect(v.availableTags.value).toEqual(['Acción']);
        v.toggleTagFilter('Acción');
        expect(v.availableTags.value).toEqual(['Acción', 'Comedia', 'Romance', 'Superhéroes']);
    });

    test('al filtrar por tipo (ej. películas) solo muestra etiquetas presentes en películas', () => {
        const v = makeVm(
            [show('s1', 'A', ['Acción', 'Superhéroes'])],
            [movie('m1', 'B', ['Comedia', 'Romance'])]
        );
        v.toggleTypeFilter('peliculas');
        expect(v.availableTags.value).toEqual(['Comedia', 'Romance']);
    });
});

describe('etiquetas y géneros: filtrado', () => {
    test('la búsqueda por texto encuentra por género traducido', () => {
        const v = makeVm(
            [show('s1', 'A', [], [], ['War & Politics'])],
            [movie('m1', 'B', [], [], ['Comedy'])]
        );
        v.setQuery('bélico');
        expect(ids(v)).toEqual(['s1']);
    });
    test('el chip de una automática filtra', () => {
        const v = makeVm(
            [show('s1', 'A', [], ['Anime'])],
            [movie('m1', 'B', [], ['Western'])]
        );
        v.toggleTagFilter('Anime');
        expect(ids(v)).toEqual(['s1']);
    });

    test('`#` encuentra las automáticas de una sola palabra', () => {
        const v = makeVm([show('s1', 'A', [], ['Anime']), show('s2', 'B')]);
        v.setQuery('#anime');
        expect(ids(v)).toEqual(['s1']);
    });

    test('`#` no llega a las etiquetas de varias palabras: para eso está el chip', () => {
        // `parseQuery` corta por espacios, así que «#terror psicológico» son
        // una etiqueta «terror» y el texto libre «psicológico». Es la razón de
        // que el chip siga siendo la vía principal de filtrado.
        const v = makeVm([show('s1', 'A', [], ['Terror psicológico'])]);
        v.setQuery('#terror');
        expect(ids(v)).toEqual([]);
        v.clearQuery();
        v.toggleTagFilter('Terror psicológico');
        expect(ids(v)).toEqual(['s1']);
    });

    test('los keywords de TMDB se siguen pudiendo filtrar aunque no se pinten', () => {
        // Es el desahogo de esconderlos: dejan de estorbar en la fila, pero no
        // se pierde la capacidad de llegar a ellos.
        const v = makeVm([show('s1', 'A', ['anime']), show('s2', 'B')]);
        v.setQuery('#anime');
        expect(ids(v)).toEqual(['s1']);
    });

    test('una automática y una del servidor se acumulan', () => {
        const v = makeVm([
            show('s1', 'A', ['Comedia'], ['Anime']),
            show('s2', 'B', [], ['Anime'])
        ]);
        v.toggleTagFilter('Anime');
        v.setQuery('#comedia');
        expect(ids(v)).toEqual(['s1']);
    });
});

describe('varias etiquetas a la vez', () => {
    const vm = () => makeVm([
        show('s1', 'A', [], ['Anime', 'Instituto', 'Romance']),
        show('s2', 'B', [], ['Anime', 'Aventura']),
        show('s3', 'C', [], ['Instituto'])
    ]);

    test('dos chips se cruzan en Y, no en O', () => {
        const v = vm();
        v.toggleTagFilter('Anime');
        v.toggleTagFilter('Instituto');
        expect(ids(v)).toEqual(['s1']);
    });

    test('tres chips siguen acotando', () => {
        const v = vm();
        v.toggleTagFilter('Anime');
        v.toggleTagFilter('Instituto');
        v.toggleTagFilter('Romance');
        expect(ids(v)).toEqual(['s1']);
    });

    test('una combinación sin coincidencias no devuelve nada', () => {
        const v = vm();
        v.toggleTagFilter('Aventura');
        v.toggleTagFilter('Instituto');
        expect(ids(v)).toEqual([]);
    });

    test('quitar uno de los dos ensancha el resultado', () => {
        const v = vm();
        v.toggleTagFilter('Anime');
        v.toggleTagFilter('Instituto');
        v.toggleTagFilter('Instituto');
        expect(ids(v)).toEqual(['s1', 's2']);
    });

    test('hasTagFilter refleja lo puesto, ignorando mayúsculas', () => {
        const v = vm();
        v.toggleTagFilter('Anime');
        expect(v.hasTagFilter('anime')).toBe(true);
        expect(v.hasTagFilter('Instituto')).toBe(false);
    });

    test('los chips y los `#` de la caja se suman todos', () => {
        const v = vm();
        v.toggleTagFilter('Anime');
        v.setQuery('#romance');
        expect(ids(v)).toEqual(['s1']);
    });
});

describe('vistas guardadas con varias etiquetas', () => {
    test('currentView guarda todas las etiquetas', () => {
        const v = makeVm();
        v.toggleTagFilter('Anime');
        v.toggleTagFilter('Instituto');
        expect(v.currentView('mi vista').tags).toEqual(['Anime', 'Instituto']);
    });

    test('sin etiquetas no guarda el campo', () => {
        expect(makeVm().currentView('x').tags).toBeUndefined();
    });

    test('applyView restaura varias etiquetas', () => {
        const v = makeVm();
        v.applyView({
            id: '1', name: 'x', typeFilter: 'todo', stateFilter: 'todo',
            tags: ['Anime', 'Instituto']
        });
        expect(v.tagFilters.value).toEqual(['Anime', 'Instituto']);
    });

    test('una vista del formato viejo (`tag` en singular) sigue funcionando', () => {
        // Las vistas ya guardadas en el localStorage de alguien no se pueden
        // invalidar por cambiar el formato.
        const v = makeVm();
        v.applyView({
            id: '1', name: 'x', typeFilter: 'todo', stateFilter: 'todo', tag: 'Anime'
        });
        expect(v.tagFilters.value).toEqual(['Anime']);
    });

    test('una vista sin etiquetas limpia las que hubiera', () => {
        const v = makeVm();
        v.toggleTagFilter('Anime');
        v.applyView({ id: '1', name: 'x', typeFilter: 'todo', stateFilter: 'todo' });
        expect(v.tagFilters.value).toEqual([]);
    });
});

describe('capa de búsqueda', () => {
    test('empieza cerrada', () => {
        expect(makeVm().overlayOpen.value).toBe(false);
    });

    test('openOverlay la abre', () => {
        const v = makeVm();
        v.openOverlay();
        expect(v.overlayOpen.value).toBe(true);
    });

    test('cerrarla deja los filtros limpios para la próxima vez', () => {
        const v = makeVm([show('s1', 'A', [], ['Anime'])]);
        v.openOverlay();
        v.setQuery('algo');
        v.toggleTagFilter('Anime');
        v.setTypeFilter('series');
        v.setStateFilter('favs');

        v.closeOverlay();

        expect(v.overlayOpen.value).toBe(false);
        expect(v.query.value).toBe('');
        expect(v.tagFilters.value).toEqual([]);
        expect(v.typeFilters.value).toEqual([]);
        expect(v.stateFilters.value).toEqual([]);
        expect(v.anyFilterActive.value).toBe(false);
    });
});

describe('búsqueda en el servidor', () => {
    /** VM con sesión y un buscador de servidor controlable. */
    function makeRemoteVm(shows: Show[] = [], movies: Movie[] = []) {
        const searchCatalog = vi.fn(() => Promise.resolve({ shows, movies }));
        const api = {
            session: { load: () => ({ accessToken: 'tok' }) },
            catalog: { getShows: vi.fn(), getMovies: vi.fn() },
            discover: { searchCatalog }
        } as unknown as ApiService;
        return { vm: new SearchViewModel(api), searchCatalog };
    }

    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    /** Deja pasar el debounce y la respuesta pendiente. */
    async function settle() {
        await vi.runAllTimersAsync();
    }

    test('lo que encuentra el servidor se añade a lo local', async () => {
        const { vm } = makeRemoteVm([show('remoto', 'De otra biblioteca')]);
        vm.shows.value = [show('local', 'De casa')];
        const stop = vm.start();

        vm.setQuery('de');
        await settle();

        expect(ids(vm)).toEqual(['local', 'remoto']);
        stop();
    });

    test('los del servidor no se vuelven a filtrar por texto', async () => {
        // Es el motivo de existir de la llamada: el servidor ignora acentos y
        // aquí «senyor» nunca casaría con «Señor».
        const { vm } = makeRemoteVm([show('remoto', 'El Señor de los Anillos')]);
        const stop = vm.start();

        vm.setQuery('senyor');
        await settle();

        expect(ids(vm)).toEqual(['remoto']);
        stop();
    });

    test('pero sí por los chips y el tipo', async () => {
        const { vm } = makeRemoteVm(
            [show('remoto-serie', 'Serie')],
            [movie('remoto-peli', 'Peli')]
        );
        const stop = vm.start();

        vm.setQuery('cosa');
        vm.setTypeFilter('peliculas');
        await settle();

        expect(ids(vm)).toEqual(['remoto-peli']);
        stop();
    });

    test('no duplica lo que ya estaba cargado', async () => {
        const { vm } = makeRemoteVm([show('s1', 'Serie A')]);
        vm.shows.value = [show('s1', 'Serie A')];
        const stop = vm.start();

        vm.setQuery('serie');
        await settle();

        expect(ids(vm)).toEqual(['s1']);
        stop();
    });

    test('teclear no dispara una petición por letra', async () => {
        const { vm, searchCatalog } = makeRemoteVm();
        const stop = vm.start();

        vm.setQuery('ex');
        vm.setQuery('exp');
        vm.setQuery('expediente');
        await settle();

        expect(searchCatalog).toHaveBeenCalledTimes(1);
        expect(searchCatalog).toHaveBeenCalledWith('expediente');
        stop();
    });

    test('una letra suelta no sale a la red', async () => {
        const { vm, searchCatalog } = makeRemoteVm();
        const stop = vm.start();

        vm.setQuery('a');
        await settle();

        expect(searchCatalog).not.toHaveBeenCalled();
        stop();
    });

    test('borrar la caja retira lo que había traído el servidor', async () => {
        const { vm } = makeRemoteVm([show('remoto', 'De otra biblioteca')]);
        const stop = vm.start();

        vm.setQuery('otra');
        await settle();
        expect(ids(vm)).toEqual(['remoto']);

        vm.clearQuery();
        await settle();
        expect(ids(vm)).toEqual([]);
        stop();
    });

    test('un fallo del servidor deja la búsqueda local en pie', async () => {
        const api = {
            session: { load: () => ({ accessToken: 'tok' }) },
            catalog: { getShows: vi.fn(), getMovies: vi.fn() },
            discover: { searchCatalog: () => Promise.reject(new Error('HTTP 500')) }
        } as unknown as ApiService;
        const vm = new SearchViewModel(api);
        vm.shows.value = [show('local', 'De casa')];
        const stop = vm.start();

        vm.setQuery('casa');
        await settle();

        expect(ids(vm)).toEqual(['local']);
        expect(vm.searching.value).toBe(false);
        stop();
    });

    test('sin sesión no se le pregunta a nadie', async () => {
        const searchCatalog = vi.fn();
        const api = {
            session: { load: () => null },
            catalog: { getShows: vi.fn(), getMovies: vi.fn() },
            discover: { searchCatalog }
        } as unknown as ApiService;
        const vm = new SearchViewModel(api);
        const stop = vm.start();

        vm.setQuery('lo que sea');
        await settle();

        expect(searchCatalog).not.toHaveBeenCalled();
        stop();
    });

    test('el cleanup de start() cancela la petición programada', async () => {
        const { vm, searchCatalog } = makeRemoteVm();
        const stop = vm.start();

        vm.setQuery('expediente');
        stop();
        await settle();

        expect(searchCatalog).not.toHaveBeenCalled();
    });
});

describe('filtros múltiples de tipo y estado', () => {
    const vm = () => makeVm(
        [show('s1', 'Serie A'), show('s2', 'Serie B')],
        [movie('m1', 'Peli 1'), movie('m2', 'Peli 2')]
    );

    test('toggleTypeFilter activa y desactiva tipo individualmente', () => {
        const v = vm();
        expect(ids(v)).toEqual(['s1', 's2', 'm1', 'm2']);
        expect(v.typeFilters.value).toEqual([]);

        v.toggleTypeFilter('series');
        expect(v.typeFilters.value).toEqual(['series']);
        expect(ids(v)).toEqual(['s1', 's2']);

        v.toggleTypeFilter('peliculas');
        expect(v.typeFilters.value).toEqual(['series', 'peliculas']);
        expect(ids(v)).toEqual(['s1', 's2', 'm1', 'm2']);

        v.toggleTypeFilter('series');
        expect(v.typeFilters.value).toEqual(['peliculas']);
        expect(ids(v)).toEqual(['m1', 'm2']);

        v.toggleTypeFilter('peliculas');
        expect(v.typeFilters.value).toEqual([]);
        expect(ids(v)).toEqual(['s1', 's2', 'm1', 'm2']);
    });

    test('toggleStateFilter activa y desactiva estado', () => {
        const v = vm();
        expect(v.stateFilters.value).toEqual([]);
        v.toggleStateFilter('favs');
        expect(v.stateFilters.value).toEqual(['favs']);
        expect(v.hasStateFilter('favs')).toBe(true);
        v.toggleStateFilter('favs');
        expect(v.stateFilters.value).toEqual([]);
        expect(v.hasStateFilter('favs')).toBe(false);
    });

    test('openCategory, closeCategory y toggleCategory gestionan la categoría activa', () => {
        const v = vm();
        expect(v.categoryMode.value).toBeNull();
        expect(v.categoryQuery.value).toBe('');

        v.openCategory('generos');
        expect(v.categoryMode.value).toBe('generos');

        v.setCategoryQuery('com');
        expect(v.categoryQuery.value).toBe('com');

        v.toggleCategory('generos');
        expect(v.categoryMode.value).toBeNull();
        expect(v.categoryQuery.value).toBe('');

        v.toggleCategory('tipo');
        expect(v.categoryMode.value).toBe('tipo');

        v.closeCategory();
        expect(v.categoryMode.value).toBeNull();
    });
});

describe('filtro de valoración', () => {
    const vm = () => makeVm(
        [
            show('s1', 'Serie Regular', [], [], [], { imdb: 5.5, age: '12' }),
            show('s2', 'Serie Buena', [], [], [], { imdb: 8.2, age: '16' })
        ],
        [
            movie('m1', 'Peli Mala', [], [], [], { imdb: 4.0, age: 'TP' }),
            movie('m2', 'Peli Obra Maestra', [], [], [], { imdb: 9.0, age: '18' })
        ]
    );

    test('filtra por >= (mayor o igual que)', () => {
        const v = vm();
        expect(ids(v)).toEqual(['s1', 's2', 'm1', 'm2']);

        v.setRatingFilter('>=', 8.0);
        expect(ids(v)).toEqual(['s2', 'm2']);
    });

    test('filtra por > (mayor que)', () => {
        const v = vm();
        v.setRatingFilter('>', 8.2);
        expect(ids(v)).toEqual(['m2']);
    });

    test('filtra por <= (menor o igual que)', () => {
        const v = vm();
        v.setRatingFilter('<=', 5.5);
        expect(ids(v)).toEqual(['s1', 'm1']);
    });

    test('filtra por < (menor que)', () => {
        const v = vm();
        v.setRatingFilter('<', 5.5);
        expect(ids(v)).toEqual(['m1']);
    });

    test('filtra por = (igual que)', () => {
        const v = vm();
        v.setRatingFilter('=', 8.2);
        expect(ids(v)).toEqual(['s2']);
    });

    test('clearRatingFilter limpia el filtro', () => {
        const v = vm();
        v.setRatingFilter('>=', 8.0);
        expect(v.anyFilterActive.value).toBe(true);
        expect(ids(v)).toEqual(['s2', 'm2']);

        v.clearRatingFilter();
        expect(v.ratingFilters.value).toEqual([]);
        expect(ids(v)).toEqual(['s1', 's2', 'm1', 'm2']);
    });

    test('las vistas guardadas guardan y restauran ratingFilter', () => {
        const v = vm();
        v.setRatingFilter('>=', 8.5);

        const view = v.currentView('Vistas top');
        expect(view.ratingFilter).toEqual({ operator: '>=', value: 8.5 });

        const v2 = vm();
        expect(v2.ratingFilters.value).toEqual([]);

        v2.applyView({ id: 'v1', ...view });
        expect(v2.ratingFilters.value).toEqual([{ operator: '>=', value: 8.5 }]);
        expect(ids(v2)).toEqual(['m2']);
    });

    test('soporta múltiples filtros de valoración conjuntos (ej. >= 5.5 y < 9.0)', () => {
        const v = vm();
        v.setRatingFilter('>=', 5.5, 0);
        v.setRatingFilter('<', 9.0, 1);
        expect(v.ratingFilters.value).toHaveLength(2);
        expect(ids(v)).toEqual(['s1', 's2']);

        // Eliminar el segundo filtro
        v.removeRatingFilter(1);
        expect(v.ratingFilters.value).toHaveLength(1);
        expect(ids(v)).toEqual(['s1', 's2', 'm2']);
    });
});

