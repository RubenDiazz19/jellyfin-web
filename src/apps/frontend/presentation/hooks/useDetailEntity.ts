// El prólogo de las fichas: suscribirse al ViewModel, disparar la carga al
// cambiar de id, sacar al usuario si lo que estaba viendo desaparece, y
// devolver el item solo si es el que pide la URL.
//
// Las cuatro fichas lo hacían igual y a mano. Con el item ya cargado no basta
// devolver lo que tenga el ViewModel: mientras llega el nuevo, dentro sigue
// estando el anterior, y pintarlo enseñaría la ficha equivocada un instante.

import { useEffect, useRef } from 'react';
import { useVmSignals } from '../../domain/bridge/useViewModel';
import { PROTO_DATA, type Movie, type Show } from '../../domain/models';
import { movieVM } from '../../domain/viewModels/MovieViewModel';
import { showVM } from '../../domain/viewModels/ShowViewModel';
import type { Navigate, Route } from '../../app/router';

type Entity<T> = {
    /** null mientras carga, o si la carga falló. */
    item: T | null;
    error: string | null;
};

/**
 * Manda al usuario a `to` en cuanto `when` se cumple.
 *
 * El destino y el `navigate` se leen por ref y no entran en las dependencias:
 * son objetos nuevos en cada render y meterlos ahí volvería a disparar la
 * navegación sola.
 */
export function useLeaveWhen(when: boolean, to: Route, navigate: Navigate) {
    const exit = useRef<() => void>(() => undefined);
    exit.current = () => navigate(to);
    useEffect(() => {
        if (when) exit.current();
    }, [when]);
}

/**
 * La serie que pide la URL. La comparten las tres fichas que cuelgan de una
 * serie —serie, temporada y episodio—, que consumen el mismo Show completo
 * con sus temporadas y episodios dentro.
 *
 * Sin sesión Jellyfin la serie sale del catálogo proto y no hay nada que
 * cargar; con ella, el ViewModel cachea, así que volver atrás no repite la
 * petición.
 */
export function useShowEntity(showId: string, navigate: Navigate): Entity<Show> {
    const proto = PROTO_DATA.shows[showId];
    // La ficha no lee `loading` (pinta «Cargando…» cuando no hay item), así
    // que no se suscribe a ese signal.
    useVmSignals(showVM, (vm) => [vm.show, vm.error, vm.gone]);
    useEffect(() => {
        if (!proto) void showVM.load(showId);
    }, [proto, showId]);
    // Si borran la serie que se está viendo, esta ficha se queda en pie sobre
    // algo que ya no existe.
    useLeaveWhen(showVM.gone.value === showId, { page: 'series' }, navigate);
    return { item: proto ?? showVM.showFor(showId), error: showVM.error.value };
}

/** La película que pide la URL. */
export function useMovieEntity(movieId: string, navigate: Navigate): Entity<Movie> {
    useVmSignals(movieVM, (vm) => [vm.movie, vm.error, vm.gone, vm.saga]);
    useEffect(() => {
        void movieVM.load(movieId);
    }, [movieId]);
    useLeaveWhen(movieVM.gone.value === movieId, { page: 'movies' }, navigate);
    return { item: movieVM.movieFor(movieId), error: movieVM.error.value };
}
