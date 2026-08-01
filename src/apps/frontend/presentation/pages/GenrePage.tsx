import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { PROTO_DATA } from '../../domain/models';
import { Nav } from '../components/layout/Nav';
import { CatalogPage } from './CatalogPage';
import type { Navigate } from '../../app/router';

type Props = { genre: string; navigate: Navigate };

// Página de género: agrupa series y películas cuyo `genres` contiene el género.
export function GenrePage({ genre, navigate }: Props) {
    const g = genre.toLowerCase();
    const shows = Object.values(PROTO_DATA.shows).filter((s) =>
        s.genres.some((x) => x.toLowerCase() === g)
    );
    const movies = Object.values(PROTO_DATA.movies).filter((m) =>
        m.genres.some((x) => x.toLowerCase() === g)
    );

    return (
        <CatalogPage
            navigate={navigate}
            shows={shows}
            movies={movies}
            nav={
                <Nav navigate={navigate} breadcrumb={[
                    { label: globalize.translate('Home'), to: { page: 'home' } },
                    { label: `${globalize.translate('Genre')} · ${genre}` }
                ]} />
            }
            header={
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 44 }}>
                    <h1 style={{
                        fontFamily: T.display, fontStyle: 'italic', fontWeight: 300,
                        fontSize: 52, margin: 0, letterSpacing: -0.5
                    }}>
                        {genre}
                    </h1>
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
