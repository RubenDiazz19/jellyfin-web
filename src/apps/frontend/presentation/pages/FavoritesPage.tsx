import type { ReactNode } from 'react';

import globalize from 'lib/globalize';

import { Nav } from '../components/layout/Nav';
import { PosterCard } from '../components/cards/PosterCard';
import { SeasonCard } from '../components/cards/SeasonCard';
import { EpCard } from '../components/cards/EpCard';
import { MovieCard } from '../components/cards/MovieCard';
import { PageSection } from '../components/layout/PageSection';
import { CardGrid } from '../components/layout/CardGrid';
import { PageTitle, SectionTitle } from '../components/layout/Title';
import { ListBackLink } from './ListsPage';
import { LoadState } from '../components/controls/LoadState';
import { favoritesVM } from '../../domain/viewModels/FavoritesViewModel';
import { useViewModelLoad } from '../../domain/bridge/useViewModel';
import { useFavListener } from '../../domain/bridge/useFav';
import type { Navigate } from '../../app/router';
import { episodeKey, seasonKey } from '../../domain/stores';

type Props = { navigate: Navigate };

export function FavoritesPage({ navigate }: Props) {
    useViewModelLoad(favoritesVM, (vm) => vm.load(), []);
    useFavListener(() => favoritesVM.syncWithStore());

    const { shows, movies, seasons, episodes, loading, error } = favoritesVM;
    const totalCount = shows.value.length + movies.value.length + seasons.value.length + episodes.value.length;

    return (
        <>
            <Nav navigate={navigate} active='lists' />
            <PageSection>
                <ListBackLink navigate={navigate} />
                <PageTitle margin='0 0 44px'>{globalize.translate('Favorites')}</PageTitle>

                <LoadState
                    variant='page'
                    loading={loading.value}
                    error={error.value}
                    count={totalCount}
                    emptyTitle={globalize.translate('MessageNoFavoritesYet')}
                    emptyHint={globalize.translate('MessageNoFavoritesYetHelp')}
                    emptyIcon='♡'
                >
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
                </LoadState>
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
            <SectionTitle>{title}</SectionTitle>
            <CardGrid minWidth={minWidth} gap={24}>
                {children}
            </CardGrid>
        </div>
    );
}
