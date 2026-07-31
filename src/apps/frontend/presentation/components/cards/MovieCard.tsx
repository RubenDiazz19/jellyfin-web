import React from 'react';
import { formatRuntime } from '../../theme/format';
import { MovieWatchedButton } from '../controls/MovieWatchedButton';
import { FavButton } from '../controls/FavButton';
import { useResponsive } from '../../theme/responsive';
import { PosterShell } from './PosterShell';
import { useSelectionMode } from '../controls/useSelectionMode';
import type { Movie } from '../../../domain/models';
import type { Navigate } from '../../../app/router';

type Props = { movie: Movie; navigate: Navigate };

// Póster vertical de película para las filas de la home.
export const MovieCard = React.memo(function MovieCardBase({ movie, navigate }: Props) {
    const r = useResponsive();
    const w = r.touch ? r.cardW : 230;
    const sel = useSelectionMode(
        { id: movie.id, title: movie.title, kind: 'movie', poster: movie.poster, year: movie.year },
        () => navigate({ page: 'movie', movieId: movie.id })
    );
    return (
        <PosterShell
            cover={movie.poster || movie.backdrop}
            onClick={sel.onClick}
            selecting={sel.selecting}
            selected={sel.selected}
            width={w}
            watchedButton={<MovieWatchedButton movie={movie} size={16} badge />}
            favButton={<FavButton id={`movie-${movie.id}`} size={16} />}
            logo={movie.logo}
            title={movie.title}
            progress={movie.watched ?? 0}
            caption={`${movie.year} · ${formatRuntime(movie.runtime)}`}
        />
    );
});
