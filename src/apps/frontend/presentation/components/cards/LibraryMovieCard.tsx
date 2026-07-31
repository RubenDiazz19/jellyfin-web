import globalize from 'lib/globalize';

import React from 'react';
import { useWatchedVersion } from '../../../domain/bridge/useWatched';
import { MovieWatchedButton } from '../controls/MovieWatchedButton';
import { FavButton } from '../controls/FavButton';
import { PosterShell } from './PosterShell';
import { useSelectionMode } from '../controls/useSelectionMode';
import type { Movie } from '../../../domain/models';
import type { Navigate } from '../../../app/router';

type Props = { movie: Movie; navigate: Navigate };

// El grid arranca el degradado más abajo que las filas: las cards son más
// pequeñas y con el corte al 25% el título perdía contraste.
const GRID_GRADIENT = 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.9))';

// Tarjeta de película en formato póster para el grid de la librería
// (ancho flexible en vez de fila con ancho fijo).
export const LibraryMovieCard = React.memo(function LibraryMovieCardBase({ movie, navigate }: Props) {
    useWatchedVersion();
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
            width={null}
            gradient={GRID_GRADIENT}
            watchedButton={<MovieWatchedButton movie={movie} size={16} badge />}
            favButton={<FavButton id={`movie-${movie.id}`} size={16} />}
            logo={movie.logo}
            title={movie.title}
            progress={movie.watched ?? 0}
            caption={`${movie.year} · ${globalize.translate('Movie')}`}
        />
    );
});
