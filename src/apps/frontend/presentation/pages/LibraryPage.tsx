import { useEffect, useMemo, useRef, useState } from 'react';

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
import { PageSection } from '../components/layout/PageSection';
import { CardGrid } from '../components/layout/CardGrid';
import { LoadState } from '../components/controls/LoadState';
import { PopupPanel } from '../components/controls/PopupPanel';
import { MenuEntry } from '../components/controls/MenuEntry';
import { BottomSheet } from '../components/m3/BottomSheet';
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
 * Selector de orden en forma de píldora minimalista con desplegable.
 * Estilo y micro-animaciones alineadas con los filtros de búsqueda (jfpPillsFadeIn / jfpSubPillIn).
 * En desktop despliega PopupPanel anclado; en móvil/táctil despliega un BottomSheet M3.
 */
function SortControl({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
    const r = useResponsive();
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top?: number; bottom?: number; right?: number } | null>(null);
    const btnRef = useRef<HTMLButtonElement>(null);

    const toggle = () => {
        if (open) {
            setOpen(false);
            return;
        }
        if (!r.touch && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            const dropUp = rect.bottom + 220 > window.innerHeight;
            setPos({
                top: dropUp ? undefined : rect.bottom + 6,
                bottom: dropUp ? window.innerHeight - rect.top + 6 : undefined,
                right: Math.max(12, window.innerWidth - rect.right)
            });
        }
        setOpen(true);
    };

    return (
        <div style={{
            position: 'relative',
            display: 'inline-flex',
            animation: 'jfpPillsFadeIn 0.24s cubic-bezier(0.2, 0.8, 0.2, 1) both'
        }}>
            <button
                ref={btnRef}
                type='button'
                onClick={toggle}
                onMouseDown={(e) => e.preventDefault()}
                aria-haspopup='menu'
                aria-expanded={open}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '6px 14px',
                    borderRadius: 999,
                    background: open ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
                    color: open ? '#fff' : T.dim,
                    border: open ? '1px solid rgba(255,255,255,0.35)' : '1px solid transparent',
                    boxShadow: open ? '0 2px 12px rgba(0,0,0,0.3)' : 'none',
                    fontFamily: T.ui,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'background .2s ease, color .2s ease, border-color .2s ease, box-shadow .2s ease, transform .2s ease',
                    whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                    if (!open) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                        e.currentTarget.style.color = '#fff';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!open) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                        e.currentTarget.style.color = T.dim;
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.transform = 'scale(1)';
                    }
                }}
            >
                <span>{globalize.translate('SortByLabel')}</span>
                <svg
                    width='10'
                    height='6'
                    viewBox='0 0 10 6'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='1.8'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    style={{
                        transition: 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.22s ease',
                        transform: open ? 'rotate(180deg)' : 'none',
                        opacity: open ? 1 : 0.6
                    }}
                >
                    <path d='M1 1L5 5L9 1' />
                </svg>
            </button>

            {!r.touch && (
                <PopupPanel
                    open={open}
                    onClose={() => setOpen(false)}
                    position={pos}
                    minWidth={160}
                    style={{
                        animation: 'jfpPillsFadeIn 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) both',
                        borderRadius: 14,
                        border: '1px solid rgba(255,255,255,0.12)',
                        boxShadow: '0 12px 36px rgba(0,0,0,0.55)'
                    }}
                >
                    {SORT_LABELS.map((s, index) => {
                        const isSelected = s.id === value;
                        return (
                            <MenuEntry
                                key={s.id}
                                onClick={() => {
                                    onChange(s.id);
                                    setOpen(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontWeight: isSelected ? 600 : 400,
                                    color: isSelected ? '#fff' : 'rgba(255,255,255,0.7)',
                                    background: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                                    padding: '8px 12px',
                                    fontSize: 13,
                                    borderRadius: 8,
                                    animation: 'jfpSubPillIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both',
                                    animationDelay: `${index * 25}ms`
                                }}
                            >
                                <span>{globalize.translate(s.key)}</span>
                                {isSelected && (
                                    <svg
                                        width='13'
                                        height='13'
                                        viewBox='0 0 24 24'
                                        fill='none'
                                        stroke='currentColor'
                                        strokeWidth='2.4'
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                    >
                                        <polyline points='20 6 9 17 4 12' />
                                    </svg>
                                )}
                            </MenuEntry>
                        );
                    })}
                </PopupPanel>
            )}

            {r.touch && (
                <BottomSheet
                    title={globalize.translate('SortByLabel')}
                    onClose={() => setOpen(false)}
                >
                    {SORT_LABELS.map((s, index) => {
                        const isSelected = s.id === value;
                        return (
                            <MenuEntry
                                key={s.id}
                                sheet
                                onClick={() => {
                                    onChange(s.id);
                                    setOpen(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontWeight: isSelected ? 600 : 400,
                                    animation: 'jfpSubPillIn 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both',
                                    animationDelay: `${index * 25}ms`
                                }}
                            >
                                <span>{globalize.translate(s.key)}</span>
                                {isSelected && (
                                    <svg
                                        width='18'
                                        height='18'
                                        viewBox='0 0 24 24'
                                        fill='none'
                                        stroke='currentColor'
                                        strokeWidth='2.4'
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                    >
                                        <polyline points='20 6 9 17 4 12' />
                                    </svg>
                                )}
                            </MenuEntry>
                        );
                    })}
                </BottomSheet>
            )}
        </div>
    );
}
