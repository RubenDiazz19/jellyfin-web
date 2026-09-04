import globalize from 'lib/globalize';

import { T } from '../theme/tokens';

import { Nav } from '../components/layout/Nav';
import { PageTitle } from '../components/layout/Title';
import { CatalogPage } from './CatalogPage';
import { useEffect } from 'react';
import { genreVM } from '../../domain/viewModels/DiscoverViewModel';
import { useViewModelLoad } from '../../domain/bridge/useViewModel';
import { expandGenre, translateGenre } from '../../domain/genres';
import type { Navigate } from '../../app/router';

type Props = { genre: string; navigate: Navigate };

// Página de género: series y películas que el servidor clasifica bajo él. La
// consulta va al servidor y no al catálogo en memoria porque este puede no
// haberse cargado —se llega aquí desde el chip de género de una ficha, sin
// pasar por la biblioteca— y porque así se ve la biblioteca entera.
export function GenrePage({ genre, navigate }: Props) {
    // Si la URL trae un género compuesto o en inglés (ej: 'Sci-Fi & Fantasy' o 'Action & Adventure'),
    // lo normalizamos a su género canónico en español y navegamos para corregir la URL.
    const cleanGenres = expandGenre(genre);
    const canonicalGenre = cleanGenres[0] ?? translateGenre(genre);

    useEffect(() => {
        if (canonicalGenre && canonicalGenre !== genre) {
            navigate({ page: 'genre', genre: canonicalGenre });
        }
    }, [canonicalGenre, genre, navigate]);

    useViewModelLoad(genreVM, (vm) => vm.load(canonicalGenre), [canonicalGenre]);

    const shows = genreVM.shows.value;
    const movies = genreVM.movies.value;
    const label = canonicalGenre;

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
                    { label: `${globalize.translate('Genre')} · ${label}` }
                ]} />
            }
            header={
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 44 }}>
                    <PageTitle>{label}</PageTitle>
                    <span style={{ fontFamily: T.ui, fontSize: 13, color: T.dim }}>
                        {globalize.translate('TitleCount', shows.length + movies.length)}
                    </span>
                </div>
            }
            empty={{
                title: globalize.translate('MessageNoTitlesForGenre', label),
                hint: globalize.translate('MessageNoTitlesForGenreHelp')
            }}
        />
    );
}
