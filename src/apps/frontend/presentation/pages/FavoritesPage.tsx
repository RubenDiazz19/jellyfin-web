import { useEffect, type ReactNode } from 'react';
import { T } from '../theme/tokens';
import { Nav } from '../components/layout/Nav';
import { PosterCard } from '../components/cards/PosterCard';
import { SeasonCard } from '../components/cards/SeasonCard';
import { EpCard } from '../components/cards/EpCard';
import { LibraryMovieCard } from '../components/cards/LibraryMovieCard';
import { EmptyState, SkeletonRow } from '../components/skeleton/Skeleton';
import { favoritesVM } from '../../domain/viewModels/FavoritesViewModel';
import { useViewModel } from '../../domain/bridge/useViewModel';
import { useFavListener } from '../../domain/bridge/useFav';
import { MC, useResponsive } from '../theme/responsive';
import type { Navigate } from '../../app/router';

type Props = { navigate: Navigate };

export function FavoritesPage({ navigate }: Props) {
    const r = useResponsive();
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
            <Nav navigate={navigate} active='favorites' />
            <section style={{
                background: r.touch ? MC.bg : '#000', color: r.touch ? MC.fg : '#fff', minHeight: '100vh',
                padding: r.touch ? `76px ${r.pagePad}px 48px` : '120px 56px 96px', fontFamily: T.ui
            }}>
                <h1 style={{
                    fontFamily: T.display, fontStyle: 'italic', fontWeight: 300,
                    fontSize: 52, margin: 0, letterSpacing: -0.5, marginBottom: 44
                }}>
                    Favoritos
                </h1>

                {loading.value ? (
                    <SkeletonRow title='' />
                ) : error.value ? (
                    <EmptyState title='No se pudieron cargar los favoritos' hint={error.value} />
                ) : isEmpty ? (
                    <EmptyState
                        title='Todavía no tienes favoritos'
                        hint='Pulsa el corazón en una serie, película o episodio para añadirlo aquí.'
                        icon='♡'
                    />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 56 }}>
                        {shows.value.length > 0 && (
                            <FavSection title='Series'>
                                {shows.value.map((s) => (
                                    <PosterCard key={s.id} slide={s} navigate={navigate} />
                                ))}
                            </FavSection>
                        )}
                        {movies.value.length > 0 && (
                            <FavSection title='Películas'>
                                {movies.value.map((m) => (
                                    <LibraryMovieCard key={m.id} movie={m} navigate={navigate} />
                                ))}
                            </FavSection>
                        )}
                        {seasons.value.length > 0 && (
                            <FavSection title='Temporadas'>
                                {seasons.value.map(({ show, season }) => (
                                    <SeasonCard key={`${show.id}-s${season.n}`} show={show} season={season} navigate={navigate} />
                                ))}
                            </FavSection>
                        )}
                        {episodes.value.length > 0 && (
                            <FavSection title='Episodios' minWidth={260}>
                                {episodes.value.map(({ show, season, episode }) => (
                                    <EpCard
                                        key={`${show.id}-s${season.n}-e${episode.n}`}
                                        show={show} season={season} ep={episode} navigate={navigate}
                                    />
                                ))}
                            </FavSection>
                        )}
                    </div>
                )}
            </section>
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
            <div style={{
                display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`, gap: 24
            }}>
                {children}
            </div>
        </div>
    );
}
