// Filtrado por etiquetas: chips, sintaxis `#tag` y la unión que alimenta la
// fila de chips.

import { beforeEach, describe, expect, test, vi } from 'vitest';

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
import { MANUAL_TAGS } from '../../../data/stores/manualTagsStore';

function show(id: string, title: string, tags?: string[], autoTags?: string[]): Show {
    return { id, title, tags, autoTags, genres: [], seasons: [] } as unknown as Show;
}
function movie(id: string, title: string, tags?: string[], autoTags?: string[]): Movie {
    return { id, title, tags, autoTags, genres: [] } as unknown as Movie;
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
        [movie('m1', 'Peli', ['anime', 'cine'])]
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
        v.setQuery('#cine');
        expect(ids(v)).toEqual(['m1']);
    });

    test('`#tag` y texto libre se combinan', () => {
        const v = vm();
        v.setQuery('#anime Serie');
        expect(ids(v)).toEqual(['s1']);
    });

    test('chip y `#tag` se acumulan: hacen falta las dos etiquetas', () => {
        const v = vm();
        v.toggleTagFilter('cine');
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
        MANUAL_TAGS._reset();
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

    test('los keywords crudos de TMDB no salen: son los que llenaban la fila', () => {
        const v = makeVm([show('s1', 'A', ['aftercreditsstinger', 'blind girl'])]);
        expect(v.allTags.value).toEqual([]);
    });

    test('las etiquetas escritas a mano sí salen, aunque no sean del vocabulario', () => {
        MANUAL_TAGS.add(['Para ver']);
        const v = makeVm([show('s1', 'A', ['Para ver', 'blind girl'])]);
        expect(v.allTags.value).toEqual(['Para ver']);
    });

    test('automáticas y manuales conviven en la misma fila', () => {
        MANUAL_TAGS.add(['Pendiente']);
        const v = makeVm([show('s1', 'A', ['Pendiente', 'college'], ['Anime'])]);
        expect(v.allTags.value).toEqual(['Anime', 'Pendiente']);
    });

    test('sin etiquetas devuelve lista vacía (la fila de chips se oculta)', () => {
        expect(makeVm([show('s1', 'A')]).allTags.value).toEqual([]);
    });
});

describe('etiquetas automáticas y filtrado', () => {
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

    test('una automática y una manual se acumulan', () => {
        const v = makeVm([
            show('s1', 'A', ['Pendiente'], ['Anime']),
            show('s2', 'B', [], ['Anime'])
        ]);
        v.toggleTagFilter('Anime');
        v.setQuery('#pendiente');
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
        expect(v.typeFilter.value).toBe('todo');
        expect(v.stateFilter.value).toBe('todo');
        expect(v.anyFilterActive.value).toBe(false);
    });
});
