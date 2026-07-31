import { useEffect } from 'react';

import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Nav } from '../components/layout/Nav';
import { PosterCard } from '../components/cards/PosterCard';
import { LibraryMovieCard } from '../components/cards/LibraryMovieCard';
import { EmptyState, SkeletonRow } from '../components/skeleton/Skeleton';
import { ScrollTopFab } from '../components/m3/ScrollTopFab';
import { libraryVM, type SortKey } from '../../domain/viewModels/LibraryViewModel';
import {
    selectionVM, type SelectableItem
} from '../../domain/viewModels/SelectionViewModel';
import { SelectionBar } from '../components/controls/SelectionBar';
import { useViewModel, useVmSignals } from '../../domain/bridge/useViewModel';
import { MC, useResponsive } from '../theme/responsive';
import type { Navigate } from '../../app/router';

type Props = { kind: 'series' | 'movies'; navigate: Navigate };

export function LibraryPage({ kind, navigate }: Props) {
    const r = useResponsive();
    useViewModel(libraryVM);
    useEffect(() => {
        void libraryVM.load(kind);
    }, [kind]);

    const isSeries = kind === 'series';
    const items = isSeries ? libraryVM.sortedShows.value : libraryVM.sortedMovies.value;
    const title = globalize.translate(isSeries ? 'Shows' : 'Movies');
    const loading = libraryVM.loading.value || libraryVM.kind.value !== kind;
    const error = libraryVM.error.value;
    // Lo que «seleccionar todo» abarca: exactamente lo que hay en la rejilla.
    const selectable: SelectableItem[] = items.map((i) => ({
        id: i.id,
        title: i.title,
        kind: isSeries ? 'show' : 'movie',
        poster: i.poster,
        year: i.year
    }));

    // Salir de la página no debe dejar una selección viva en otra pantalla.
    useEffect(() => () => selectionVM.stop(), []);

    return (
        <>
            <Nav navigate={navigate} active={isSeries ? 'series' : 'movies'} />
            <section style={{
                background: r.touch ? MC.bg : '#000',
                color: r.touch ? MC.fg : '#fff',
                minHeight: '100vh',
                padding: r.touch ? `76px ${r.pagePad}px 48px` : '120px 56px 96px',
                fontFamily: T.ui
            }}>
                <div style={{
                    display: 'flex', alignItems: 'baseline', gap: 16,
                    marginBottom: r.touch ? 22 : 44
                }}>
                    <h1 style={{
                        fontFamily: T.display, fontStyle: 'italic', fontWeight: 300,
                        fontSize: r.touch ? 32 : 52, margin: 0, letterSpacing: -0.5
                    }}>
                        {title}
                    </h1>
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
                {loading ? (
                    <SkeletonRow title='' />
                ) : error ? (
                    <EmptyState title={globalize.translate('LibrariesLoadError')} hint={error} />
                ) : items.length === 0 ? (
                    <EmptyState
                        title={globalize.translate(isSeries ? 'MessageNoShowsYet' : 'MessageNoMoviesYet')}
                        hint={globalize.translate('MessageAddContentAndRescan')}
                    />
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(auto-fill, minmax(${r.touch ? r.cardW : 200}px, 1fr))`,
                        gap: r.touch ? r.gap : 28
                    }}>
                        {isSeries ?
                            libraryVM.sortedShows.value.map((s) => (
                                <PosterCard key={s.id} slide={s} navigate={navigate} fluid={r.touch} />
                            )) :
                            libraryVM.sortedMovies.value.map((m) => (
                                <LibraryMovieCard key={m.id} movie={m} navigate={navigate} />
                            ))}
                    </div>
                )}
            </section>
            <SelectionBar items={selectable} />
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

/** Entra y sale del modo selección. */
function SelectToggle() {
    useVmSignals(selectionVM, (vm) => [vm.selecting]);
    const on = selectionVM.selecting.value;
    return (
        <button
            onClick={() => (on ? selectionVM.stop() : selectionVM.start())}
            style={{
                padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
                background: on ? '#fff' : 'rgba(255,255,255,0.08)',
                color: on ? '#000' : T.dim,
                border: on ? 'none' : '1px solid rgba(255,255,255,0.15)',
                fontFamily: T.ui, fontSize: 12
            }}
        >
            {globalize.translate(on ? 'ButtonCancel' : 'SelectItems')}
        </button>
    );
}

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
                {SORT_LABELS.map((s) => (
                    <option key={s.id} value={s.id} style={{ color: '#000' }}>
                        {globalize.translate(s.key)}
                    </option>
                ))}
            </select>
        </label>
    );
}
