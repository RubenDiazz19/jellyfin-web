import { useEffect, type ReactNode } from 'react';

import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Nav } from '../components/layout/Nav';
import { PosterCard } from '../components/cards/PosterCard';
import { SeasonCard } from '../components/cards/SeasonCard';
import { EpCard } from '../components/cards/EpCard';
import { MovieCard } from '../components/cards/MovieCard';
import { EmptyState, SkeletonRow } from '../components/skeleton/Skeleton';
import { PageSection } from '../components/layout/PageSection';
import { CardGrid } from '../components/layout/CardGrid';
import { ListBackLink } from './ListsPage';
import { favoritesVM } from '../../domain/viewModels/FavoritesViewModel';
import { useViewModel } from '../../domain/bridge/useViewModel';
import { useFavListener } from '../../domain/bridge/useFav';
import type { Navigate } from '../../app/router';
import { episodeKey, seasonKey } from '../../domain/stores';

type Props = { navigate: Navigate };

export function FavoritesPage({ navigate }: Props) {
    useViewModel(favoritesVM);

    useEffect(() => {
        void favoritesVM.load();
    }, []);
    useFavListener(() => favoritesVM.syncWithStore());

    const { shows, movies, seasons, episodes, loading, error } = favoritesVM;
    const isEmpty = shows.value.length === 0 && movies.value.length === 0
        && seasons.value.length === 0 && episodes.value.length === 0;

    return (
        <>
            <Nav navigate={navigate} active='lists' />
            <PageSection>
                <ListBackLink navigate={navigate} />
                <h1 style={{
                    fontFamily: T.display, fontStyle: 'italic', fontWeight: 300,
                    fontSize: 52, margin: 0, letterSpacing: -0.5, marginBottom: 44
                }}>
                    {globalize.translate('Favorites')}
                </h1>

                {loading.value ? (
                    <SkeletonRow title='' />
                ) : error.value ? (
                    <EmptyState title={globalize.translate('FavoritesLoadError')} hint={error.value} />
                ) : isEmpty ? (
                    <EmptyState
                        title={globalize.translate('MessageNoFavoritesYet')}
                        hint={globalize.translate('MessageNoFavoritesYetHelp')}
                        icon='♡'
                    />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 56 }}>
                        {shows.value.length > 0 && (
                            <FavSection title={globalize.translate('Shows')}>
                                {shows.value.map((s) => (
                                    <PosterCard key={s.id} slide={s} navigate={navigate} />
                                ))}
                            </FavSection>
                        )}
                        {movies.value.length > 0 && (
                            <FavSection title={globalize.translate('Movies')}>
                                {movies.value.map((m) => (
                                    <MovieCard key={m.id} movie={m} navigate={navigate} fluid />
                                ))}
                            </FavSection>
                        )}
                        {seasons.value.length > 0 && (
                            <FavSection title={globalize.translate('HeaderSeasons')}>
                                {seasons.value.map(({ show, season }) => (
                                    <SeasonCard key={seasonKey(show.id, season.n)} show={show} season={season} navigate={navigate} />
                                ))}
                            </FavSection>
                        )}
                        {episodes.value.length > 0 && (
                            <FavSection title={globalize.translate('Episodes')} minWidth={260}>
                                {episodes.value.map(({ show, season, episode }) => (
                                    <EpCard
                                        key={episodeKey(show.id, season.n, episode.n)}
                                        show={show} season={season} ep={episode} navigate={navigate}
                                    />
                                ))}
                            </FavSection>
                        )}
                    </div>
                )}
            </PageSection>
        </>
    );
}

function FavSection({
    title, minWidth = 200, children
}: {
    title: string; minWidth?: number; children: ReactNode;
}) {
    return (
        <div>
            <h3 style={{
                fontFamily: T.display, fontStyle: 'italic', fontSize: 26, fontWeight: 300,
                margin: '0 0 20px', letterSpacing: -0.3
            }}>
                {title}
            </h3>
            <CardGrid minWidth={minWidth} gap={24}>
                {children}
            </CardGrid>
        </div>
    );
}
