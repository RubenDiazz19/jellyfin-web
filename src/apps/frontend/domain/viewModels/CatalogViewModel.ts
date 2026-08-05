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

import { signal, type Signal } from '@preact/signals-core';
import type { Movie, Show } from '../../data/models';
import { LoadGuard } from './loadGuard';

export abstract class CatalogViewModel {
    shows = signal<Show[]>([]);
    movies = signal<Movie[]>([]);
    loading: Signal<boolean>;
    error = signal<string | null>(null);

    protected loads = new LoadGuard();

    /**
     * `loadsOnMount` arranca el spinner encendido. Lo quieren las pantallas
     * que SIEMPRE piden datos al montar: empezar en false pinta el estado
     * vacío durante el frame que va hasta que sale la petición. La biblioteca
     * no lo quiere, porque puede resolver desde caché en el mismo tick.
     */
    constructor({ loadsOnMount = false } = {}) {
        this.loading = signal(loadsOnMount);
    }

    /**
     * Corre una carga bajo la guardia de carreras.
     *
     * `body` recibe el test de vigencia y debe consultarlo después de cada
     * `await`: si el usuario ha navegado y ha empezado otra carga, la
     * respuesta lenta no puede escribir encima de la rápida.
     *
     * El error de la carga vigente se publica en `error`; `onError` permite
     * añadir limpieza (vaciar las listas, por ejemplo) o quedárselo devolviendo
     * `false`, que es lo que hace una ficha que prefiere conservar los datos
     * anteriores antes que enseñar un fallo.
     */
    protected async guarded(
        body: (isLatest: () => boolean) => Promise<void>,
        onError?: (error: Error) => boolean | void
    ): Promise<void> {
        const isLatest = this.loads.begin();
        try {
            await body(isLatest);
        } catch (e) {
            if (!isLatest()) return;
            const error = e as Error;
            if (onError?.(error) !== false) this.error.value = error.message;
        } finally {
            if (isLatest()) this.loading.value = false;
        }
    }
}
