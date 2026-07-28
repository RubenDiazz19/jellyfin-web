import { useEffect } from 'react';

import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Nav } from '../components/layout/Nav';
import { PosterCard } from '../components/cards/PosterCard';
import { LibraryMovieCard } from '../components/cards/LibraryMovieCard';
import { EmptyState, SkeletonRow } from '../components/skeleton/Skeleton';
import { ScrollTopFab } from '../components/m3/ScrollTopFab';
import { libraryVM } from '../../domain/viewModels/LibraryViewModel';
import { useViewModel } from '../../domain/bridge/useViewModel';
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
    const items = isSeries ? libraryVM.shows.value : libraryVM.movies.value;
    const title = globalize.translate(isSeries ? 'Shows' : 'Movies');
    const loading = libraryVM.loading.value || libraryVM.kind.value !== kind;
    const error = libraryVM.error.value;

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
                            libraryVM.shows.value.map((s) => (
                                <PosterCard key={s.id} slide={s} navigate={navigate} fluid={r.touch} />
                            )) :
                            libraryVM.movies.value.map((m) => <LibraryMovieCard key={m.id} movie={m} navigate={navigate} />)}
                    </div>
                )}
            </section>
            <ScrollTopFab />
        </>
    );
}
