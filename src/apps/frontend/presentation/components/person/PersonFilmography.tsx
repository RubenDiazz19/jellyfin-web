import globalize from 'lib/globalize';
import type { Navigate } from '../../../app/router';
import type { Movie, Show } from '../../../domain/models';
import { MovieCard } from '../cards/MovieCard';
import { PosterCard } from '../cards/PosterCard';
import { LoadState } from '../controls/LoadState';
import { FilmographyRow } from '../layout/FilmographyRow';

type PersonFilmographyProps = {
    movies: Movie[];
    shows: Show[];
    name: string;
    navigate: Navigate;
};

/**
 * Muestra las filas de filmografía de la persona (Películas y Series)
 * o un mensaje vacío si no tiene apariciones en la biblioteca.
 */
export function PersonFilmography({ movies, shows, name, navigate }: PersonFilmographyProps) {
    const totalCount = shows.length + movies.length;
    const moviesWatched = movies.filter((m) => m.watched).length;
    const showsWatched = shows.filter((s) => s.watched).length;

    if (totalCount === 0) {
        return (
            <div style={{ marginTop: 40 }}>
                <LoadState
                    variant='page'
                    loading={false}
                    count={0}
                    emptyTitle={globalize.translate('MessageNoAppearancesFor', name)}
                    emptyHint={globalize.translate('MessageNoAppearancesForHelp')}
                >
                    <div />
                </LoadState>
            </div>
        );
    }

    return (
        <div>
            <FilmographyRow
                title='Películas'
                items={movies}
                watchedCount={moviesWatched}
                renderCard={(m) => <MovieCard movie={m} navigate={navigate} />}
                marginBottom={40}
            />
            <FilmographyRow
                title='Series'
                items={shows}
                watchedCount={showsWatched}
                renderCard={(s) => <PosterCard slide={s} navigate={navigate} />}
            />
        </div>
    );
}
