// El prólogo de las fichas: suscribirse al ViewModel, disparar la carga al
// cambiar de id y devolver el item solo si es el que pide la URL.
//
// Las cuatro fichas lo hacían igual y a mano. Con el item ya cargado no basta
// devolver lo que tenga el ViewModel: mientras llega el nuevo, dentro sigue
// estando el anterior, y pintarlo enseñaría la ficha equivocada un instante.

import { useEffect } from 'react';
import { useVmSignals } from '../../domain/bridge/useViewModel';
import { PROTO_DATA, type Movie, type Show } from '../../domain/models';
import { movieVM } from '../../domain/viewModels/MovieViewModel';
import { showVM } from '../../domain/viewModels/ShowViewModel';

type Entity<T> = {
    /** null mientras carga, o si la carga falló. */
    item: T | null;
    error: string | null;
};

/**
 * La serie que pide la URL. La comparten las tres fichas que cuelgan de una
 * serie —serie, temporada y episodio—, que consumen el mismo Show completo
 * con sus temporadas y episodios dentro.
 *
 * Sin sesión Jellyfin la serie sale del catálogo proto y no hay nada que
 * cargar; con ella, el ViewModel cachea, así que volver atrás no repite la
 * petición.
 */
export function useShowEntity(showId: string): Entity<Show> {
    const proto = PROTO_DATA.shows[showId];
    // La ficha no lee `loading` (pinta «Cargando…» cuando no hay item), así
    // que no se suscribe a ese signal.
    useVmSignals(showVM, (vm) => [vm.show, vm.error]);
    useEffect(() => {
        if (!proto) void showVM.load(showId);
    }, [proto, showId]);
    return { item: proto ?? showVM.showFor(showId), error: showVM.error.value };
}

/** La película que pide la URL. */
export function useMovieEntity(movieId: string): Entity<Movie> {
    useVmSignals(movieVM, (vm) => [vm.movie, vm.error]);
    useEffect(() => {
        void movieVM.load(movieId);
    }, [movieId]);
    return { item: movieVM.movieFor(movieId), error: movieVM.error.value };
}
