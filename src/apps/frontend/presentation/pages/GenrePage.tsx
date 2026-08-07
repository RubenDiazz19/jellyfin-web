import { useEffect } from 'react';

import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Nav } from '../components/layout/Nav';
import { PageTitle } from '../components/layout/Title';
import { CatalogPage } from './CatalogPage';
import { genreVM } from '../../domain/viewModels/DiscoverViewModel';
import { useViewModel } from '../../domain/bridge/useViewModel';
import type { Navigate } from '../../app/router';

type Props = { genre: string; navigate: Navigate };

// Página de género: series y películas que el servidor clasifica bajo él. La
// consulta va al servidor y no al catálogo en memoria porque este puede no
// haberse cargado —se llega aquí desde el chip de género de una ficha, sin
// pasar por la biblioteca— y porque así se ve la biblioteca entera.
export function GenrePage({ genre, navigate }: Props) {
    useViewModel(genreVM);
    useEffect(() => {
        void genreVM.load(genre);
    }, [genre]);

    const shows = genreVM.shows.value;
    const movies = genreVM.movies.value;

    return (
        <CatalogPage
            navigate={navigate}
            shows={shows}
            movies={movies}
            loading={genreVM.loading.value}
            error={genreVM.error.value}
            nav={
                <Nav navigate={navigate} breadcrumb={[
                    { label: globalize.translate('Home'), to: { page: 'home' } },
                    { label: `${globalize.translate('Genre')} · ${genre}` }
                ]} />
            }
            header={
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 44 }}>
                    <PageTitle>{genre}</PageTitle>
                    <span style={{ fontFamily: T.ui, fontSize: 13, color: T.dim }}>
                        {globalize.translate('TitleCount', shows.length + movies.length)}
                    </span>
                </div>
            }
            empty={{
                title: globalize.translate('MessageNoTitlesForGenre', genre),
                hint: globalize.translate('MessageNoTitlesForGenreHelp')
            }}
        />
    );
}
