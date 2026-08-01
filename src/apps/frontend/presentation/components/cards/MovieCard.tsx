import globalize from 'lib/globalize';

import React from 'react';
import { formatRuntime } from '../../theme/format';
import { MovieWatchedButton } from '../controls/MovieWatchedButton';
import { FavButton } from '../controls/FavButton';
import { useResponsive } from '../../theme/responsive';
import { PosterShell } from './PosterShell';
import { useCardInteractions } from './useCardInteractions';
import type { Movie } from '../../../domain/models';
import type { Navigate } from '../../../app/router';
import { movieKey } from '../../../domain/stores';

type Props = {
    movie: Movie;
    navigate: Navigate;
    /** En rejilla la card llena su columna en vez de fijar ancho (ver abajo). */
    fluid?: boolean;
};

// En rejilla el degradado arranca más abajo que en fila: las cards son más
// pequeñas y con el corte al 25% el título perdía contraste.
const GRID_GRADIENT = 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.9))';

// Póster vertical de película. En fila (home, similares) fija ancho y el pie
// dice la duración; en rejilla (biblioteca, género, favoritos) llena la
// columna y el pie dice el tipo, para que case con el «Serie» de PosterCard
// de al lado — ahí lo que se compara es qué es cada cosa, no cuánto dura.
export const MovieCard = React.memo(function MovieCardBase({ movie, navigate, fluid }: Props) {
    const r = useResponsive();
    const w = r.touch ? r.cardW : 230;
    const card = useCardInteractions(
        { id: movie.id, title: movie.title, kind: 'movie', poster: movie.poster, year: movie.year },
        navigate
    );
    return (
        <PosterShell
            {...card}
            cover={movie.poster || movie.backdrop}
            width={fluid ? null : w}
            gradient={fluid ? GRID_GRADIENT : undefined}
            watchedButton={<MovieWatchedButton movie={movie} size={16} badge />}
            favButton={<FavButton id={movieKey(movie.id)} size={16} />}
            logo={movie.logo}
            title={movie.title}
            progress={movie.watched ?? 0}
            caption={fluid ?
                `${movie.year} · ${globalize.translate('Movie')}` :
                `${movie.year} · ${formatRuntime(movie.runtime)}`}
        />
    );
});
