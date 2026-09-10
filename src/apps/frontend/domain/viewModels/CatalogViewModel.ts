// Base de los ViewModels que enseñan un recorte del catálogo: la biblioteca,
// las pantallas de género/persona/similares y los favoritos.
//
// Los tres publican las mismas cuatro cosas —series, películas, si está
// cargando y el error— y hacían la misma ceremonia alrededor de cada carga:
// abrir la guardia de carreras, poner el spinner, y en el `finally` bajarlo
// solo si esa carga sigue siendo la vigente. Eso es lo que vive aquí; QUÉ se
// pide y cómo se reacciona a las mutaciones se queda en cada subclase, que es
// donde de verdad se diferencian.
//
// Fuera se quedan a propósito HomeViewModel (dos cargas independientes con su
// propio par loading/ready cada una) y las fichas de serie y película, que no
// son catálogos sino una entidad suelta.
//
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';
import type { Movie, Show } from '../../data/models';
import { LoadableViewModel } from './LoadableViewModel';

export abstract class CatalogViewModel extends LoadableViewModel {
    shows = signal<Show[]>([]);
    movies = signal<Movie[]>([]);

    /**
     * `loadsOnMount` arranca el spinner encendido. Lo quieren las pantallas
     * que SIEMPRE piden datos al montar: empezar en false pinta el estado
     * vacío durante el frame que va hasta que sale la petición. La biblioteca
     * no lo quiere, porque puede resolver desde caché en el mismo tick.
     */
    constructor({ loadsOnMount = false } = {}) {
        super({ loadsOnMount });
    }
}
