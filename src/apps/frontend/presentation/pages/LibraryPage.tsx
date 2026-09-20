import { useEffect, useMemo, useState } from 'react';

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
    selectionVM, toSelectableItem, type SelectableItem
} from '../../domain/viewModels/SelectionViewModel';
import { PageSection } from '../components/layout/PageSection';
import { CardGrid } from '../components/layout/CardGrid';
import { LoadState } from '../components/controls/LoadState';
import { PopupPanel } from '../components/controls/PopupPanel';
import { MenuEntry } from '../components/controls/MenuEntry';
import { BottomSheet } from '../components/m3/BottomSheet';
import { SortControl } from '../components/controls/SortControl';
import { useViewModelLoad } from '../../domain/bridge/useViewModel';
import { useResponsive } from '../theme/responsive';
import type { Navigate } from '../../app/router';

type Props = { kind: 'series' | 'movies'; navigate: Navigate };

export function LibraryPage({ kind, navigate }: Props) {
    const r = useResponsive();
    useViewModelLoad(libraryVM, (vm) => vm.load(kind), [kind]);

    const isSeries = kind === 'series';

    const items = isSeries ? libraryVM.sortedShows.value : libraryVM.sortedMovies.value;
    const loading = libraryVM.loading.value || libraryVM.kind.value !== kind;
    const error = libraryVM.error.value;
    // Ancho de la tarjeta para el hueco que deja `LazyCard` mientras está
    // desmontada: null = llena la columna (todas las películas y las series en
    // móvil/tablet), y en desktop las series fijan ancho.
    const cardWidth = !isSeries || r.touch ? null : POSTER_W;
    // Lo que «seleccionar todo» abarca: exactamente lo que hay en la rejilla.
    const selectable: SelectableItem[] = useMemo(() => items.map((i) => toSelectableItem({
        ...i,
        kind: isSeries ? 'show' : 'movie'
    })), [items, isSeries]);

    // Registrar los items visibles para que la barra de selección global sepa qué seleccionar en lote
    useEffect(() => {
        selectionVM.setVisibleItems(selectable);
        return () => {
            selectionVM.setVisibleItems([]);
            selectionVM.stop();
        };
    }, [selectable]);

    const baseTitle = globalize.translate(isSeries ? 'Shows' : 'Movies');
    let pageHeading: string;
    if (loading) {
        pageHeading = baseTitle;
    } else if (items.length === 1) {
        pageHeading = isSeries ?
            (baseTitle === 'Series' ? '1 Serie' : '1 Show') :
            (baseTitle === 'Películas' ? '1 Película' : '1 Movie');
    } else {
        pageHeading = `${items.length} ${baseTitle}`;
    }

    return (
        <>
            <Nav navigate={navigate} active={isSeries ? 'series' : 'movies'} />
            <PageSection>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    marginBottom: r.touch ? 22 : 36,
                    flexWrap: 'wrap'
                }}>
                    <h1 style={{
                        fontFamily: T.ui,
                        fontSize: r.touch ? 24 : 30,
                        fontWeight: 300,
                        letterSpacing: -0.4,
                        margin: 0,
                        color: '#fff'
                    }}>
                        {pageHeading}
                    </h1>
                    {!loading && items.length > 0 && (
                        <SortControl
                            value={libraryVM.sortKey.value}
                            onChange={libraryVM.setSort}
                            options={SORT_LABELS}
                        />
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
                                    <PosterCard slide={s} navigate={navigate} fluid />
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
