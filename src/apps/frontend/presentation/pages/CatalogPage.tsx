// El armazón de las páginas que enseñan un recorte del catálogo bajo una
// cabecera: género y persona. Las dos se diferencian solo en esa cabecera —un
// título grande frente a una foto con el nombre y los papeles—; de ahí abajo
// pintan lo mismo: las series, después las películas, y el estado vacío si no
// hay ninguna de las dos.

import type { CSSProperties, ReactNode } from 'react';
import { T } from '../theme/tokens';
import { MovieCard } from '../components/cards/MovieCard';
import { PosterCard } from '../components/cards/PosterCard';
import { EmptyState, SkeletonRow } from '../components/skeleton/Skeleton';
import { PageSection } from '../components/layout/PageSection';
import { SectionTitle } from '../components/layout/Title';
import type { Movie, Show } from '../../domain/models';
import type { Navigate } from '../../app/router';

import globalize from 'lib/globalize';

const GRID: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 28
};

/** Separación entre la sección de series y la de películas. */
const SECTION_GAP = 56;

type Props = {
    /** La barra de navegación, con las migas que ponga cada página. */
    nav: ReactNode;
    /** Cabecera propia de la página, encima de las rejillas. */
    header: ReactNode;
    shows: Show[];
    movies: Movie[];
    /** Qué decir cuando no hay ni series ni películas. */
    empty: { title: string; hint: string };
    /** Mientras el servidor contesta: esqueleto, no el estado vacío. */
    loading?: boolean;
    /** Mensaje del servidor si la consulta falló. */
    error?: string | null;
    navigate: Navigate;
};

export function CatalogPage({
    nav, header, shows, movies, empty, loading, error, navigate
}: Props) {
    return (
        <>
            {nav}
            <PageSection>
                {header}

                {shows.length > 0 && (
                    <>
                        <SectionHead label={globalize.translate('Shows')} count={shows.length} />
                        <div style={GRID}>
                            {shows.map((s) => <PosterCard key={s.id} slide={s} navigate={navigate} />)}
                        </div>
                    </>
                )}

                {movies.length > 0 && (
                    <>
                        {shows.length > 0 && <div style={{ height: SECTION_GAP }} />}
                        <SectionHead label={globalize.translate('Movies')} count={movies.length} />
                        <div style={GRID}>
                            {movies.map((m) => <MovieCard key={m.id} movie={m} navigate={navigate} fluid />)}
                        </div>
                    </>
                )}

                {shows.length === 0 && movies.length === 0 && (
                    loading ? (
                        <SkeletonRow />
                    ) : (
                        <EmptyState
                            title={error ? globalize.translate('MessageCatalogQueryFailed') : empty.title}
                            hint={error ?? empty.hint}
                        />
                    )
                )}
            </PageSection>
        </>
    );
}

function SectionHead({ label, count }: { label: string; count: number }) {
    return (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
            <SectionTitle size={28} margin={0}>{label}</SectionTitle>
            <span style={{ fontSize: 12, color: T.dim }}>{count}</span>
        </div>
    );
}
