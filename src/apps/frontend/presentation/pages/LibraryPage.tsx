import { useEffect, useMemo } from 'react';

import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Nav } from '../components/layout/Nav';
import { PosterCard } from '../components/cards/PosterCard';
import { MovieCard } from '../components/cards/MovieCard';
import { EAGER_CARDS, LazyCard } from '../components/cards/LazyCard';
import { POSTER_W } from '../components/cards/PosterShell';
import { ScrollTopFab } from '../components/m3/ScrollTopFab';

import { libraryVM, type SortKey } from '../../domain/viewModels/LibraryViewModel';
import {
    selectionVM, type SelectableItem
} from '../../domain/viewModels/SelectionViewModel';
import { SelectToggle } from '../components/controls/SelectToggle';
import { PageSection } from '../components/layout/PageSection';
import { CardGrid } from '../components/layout/CardGrid';
import { PageTitle } from '../components/layout/Title';
import { LoadState } from '../components/controls/LoadState';
import { useViewModelLoad } from '../../domain/bridge/useViewModel';
import { useResponsive } from '../theme/responsive';
import type { Navigate } from '../../app/router';

type Props = { kind: 'series' | 'movies'; navigate: Navigate };

export function LibraryPage({ kind, navigate }: Props) {
    const r = useResponsive();
    useViewModelLoad(libraryVM, (vm) => vm.load(kind), [kind]);

    const isSeries = kind === 'series';

    const items = isSeries ? libraryVM.sortedShows.value : libraryVM.sortedMovies.value;
    const title = globalize.translate(isSeries ? 'Shows' : 'Movies');
    const loading = libraryVM.loading.value || libraryVM.kind.value !== kind;
    const error = libraryVM.error.value;
    // Ancho de la tarjeta para el hueco que deja `LazyCard` mientras está
    // desmontada: null = llena la columna (todas las películas y las series en
    // móvil/tablet), y en desktop las series fijan ancho.
    const cardWidth = !isSeries || r.touch ? null : POSTER_W;
    // Lo que «seleccionar todo» abarca: exactamente lo que hay en la rejilla.
    const selectable: SelectableItem[] = useMemo(() => items.map((i) => ({
        id: i.id,
        title: i.title,
        kind: isSeries ? 'show' : 'movie',
        poster: i.poster,
        year: i.year
    })), [items, isSeries]);

    // Registrar los items visibles para que la barra de selección global sepa qué seleccionar en lote
    useEffect(() => {
        selectionVM.setVisibleItems(selectable);
        return () => {
            selectionVM.setVisibleItems([]);
            selectionVM.stop();
        };
    }, [selectable]);

    return (
        <>
            <Nav navigate={navigate} active={isSeries ? 'series' : 'movies'} />
            <PageSection>
                <div style={{
                    display: 'flex', alignItems: 'baseline', gap: 16,
                    marginBottom: r.touch ? 22 : 44
                }}>
                    <PageTitle>{title}</PageTitle>
                    {!loading && (
                        <span style={{ fontFamily: T.ui, fontSize: 13, color: T.dim }}>
                            {globalize.translate(isSeries ? 'ShowCount' : 'MovieCount', items.length)}
                        </span>
                    )}
                    {!loading && items.length > 0 && (
                        <>
                            <SortControl
                                value={libraryVM.sortKey.value}
                                onChange={libraryVM.setSort}
                            />
                            <SelectToggle />
                        </>
                    )}
                </div>
                <LoadState
                    variant='page'
                    loading={loading}
                    error={error}
                    count={items.length}
                    emptyTitle={globalize.translate(isSeries ? 'MessageNoShowsYet' : 'MessageNoMoviesYet')}
                    emptyHint={globalize.translate('MessageAddContentAndRescan')}
                >
                    <CardGrid minWidth={r.touch ? r.cardW : 200} gap={r.touch ? r.gap : 28}>
                        {isSeries ?
                            libraryVM.sortedShows.value.map((s, i) => (
                                <LazyCard key={s.id} width={cardWidth} eager={i < EAGER_CARDS}>
                                    <PosterCard slide={s} navigate={navigate} fluid={r.touch} />
                                </LazyCard>
                            )) :
                            libraryVM.sortedMovies.value.map((m, i) => (
                                <LazyCard key={m.id} width={cardWidth} eager={i < EAGER_CARDS}>
                                    <MovieCard movie={m} navigate={navigate} fluid />
                                </LazyCard>
                            ))}
                    </CardGrid>
                </LoadState>
            </PageSection>
            <ScrollTopFab />
        </>
    );
}

// Etiqueta de cada criterio. Se traducen con claves que ya existían salvo

// «Ordenar por», que es la del propio control.
const SORT_LABELS: { id: SortKey; key: string }[] = [
    { id: 'title', key: 'Name' },
    { id: 'year', key: 'LabelYear' },
    { id: 'rating', key: 'CommunityRating' },
    { id: 'runtime', key: 'Runtime' },
    { id: 'random', key: 'OptionRandom' }
];

/**
 * Selector de orden. Es un `<select>` nativo a propósito: son cinco opciones
 * que no necesitan un menú propio, y así se comporta bien con teclado y con
 * los selectores nativos de móvil sin código extra.
 */
function SortControl({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
    return (
        <label style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: T.ui, fontSize: 12, color: T.dim
        }}>
            {globalize.translate('SortByLabel')}
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as SortKey)}
                style={{
                    background: 'rgba(255,255,255,0.08)', color: 'inherit',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 999,
                    padding: '6px 12px', fontFamily: T.ui, fontSize: 12,
                    cursor: 'pointer', outline: 'none'
                }}
            >
                {/* Sin estilo en línea: un color fijo aquí pisaría la regla
                    global de global.css (select/option) que ya tiñe el popup
                    nativo para el tema oscuro, y el texto quedaba casi
                    invisible (negro sobre el fondo oscuro del desplegable). */}
                {SORT_LABELS.map((s) => (
                    <option key={s.id} value={s.id}>
                        {globalize.translate(s.key)}
                    </option>
                ))}
            </select>
        </label>
    );
}
