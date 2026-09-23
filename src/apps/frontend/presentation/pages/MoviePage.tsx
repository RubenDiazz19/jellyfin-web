import { useEffect, useCallback } from 'react';
import globalize from 'lib/globalize';

import { formatDateLong, formatRemaining } from '../utils/format';
import { useWatched } from '../../domain/bridge/useWatched';
import type { Movie } from '../../domain/models';
import {
    HeroFrame, HeroGenres, HeroMeta, HeroTitle, useHeroLayout, type HeroTweaks
} from '../components/layout/DetailHero';
import { HeroActionsRow, HeroPlayButton } from '../components/layout/HeroActions';
import {
    DetailBody, DetailColumns, DetailRow, DetailStatus, DetailTable, GenreLinks, SectionLabel
} from '../components/layout/DetailSections';
import { Nav } from '../components/layout/Nav';
import { ScrollHint } from '../components/layout/ScrollHint';
import { MoreButton } from '../components/controls/buttons/MoreButton';
import { MyListButton } from '../components/controls/buttons/MyListButton';
import { useItemContextMenu } from '../components/controls/useItemContextMenu';
import { usePlayer } from '../components/player/PlayerProvider';
import { DetailPageShell } from '../components/layout/DetailPageShell';
import { DetailOverviewSection } from '../components/layout/DetailOverviewSection';
import { Similar } from '../components/similar/Similar';
import { LazySection } from '../components/layout/LazySection';
import { RuntimeDisplay } from '../components/media/RuntimeDisplay';
import { useLandscape, useResponsive, useShortViewport } from '../theme/responsive';
import type { Navigate } from '../../app/router';
import { getHeroGenres, getItemGenres } from '../../domain/genres';
import { useMovieEntity } from '../hooks/useDetailEntity';
import { movieKey } from '../../domain/stores';
import { movieVM } from '../../domain/viewModels/MovieViewModel';
import { ticksFromProgress } from '../../domain/player/format';
import { useVmSignals } from '../../domain/bridge/useViewModel';
import { heroTrailerVM } from '../../domain/viewModels/HeroTrailerViewModel';
import { useHomeScrollTransition } from '../hooks/useHomeScrollTransition';
import { SagaSection } from '../components/collection/SagaSection';

type PageProps = { movieId: string; navigate: Navigate; hero?: HeroTweaks };

export function MoviePage({ movieId, navigate, hero }: PageProps) {
    const { item: movie, error } = useMovieEntity(movieId, navigate);
    if (!movie) return <DetailStatus error={error} />;
    return (
        <DetailPageShell hero={<MovieHero movie={movie} navigate={navigate} hero={hero} />}>
            <MovieDetail movie={movie} navigate={navigate} />
        </DetailPageShell>
    );
}

function MovieHero({
    movie, navigate, hero
}: {
    movie: Movie; navigate: Navigate; hero?: HeroTweaks;
}) {
    const [liveWatched] = useWatched(movieKey(movie.id));
    const watchedNum = movie.watched ?? 0;
    const progress = watchedNum > 0 && watchedNum < 1 ? watchedNum : 0;
    const watched = liveWatched || watchedNum >= 1;
    const inProgress = !watched && progress > 0;
    // Minutos restantes desde el progreso (movie.remaining llega vacío del server).
    const runtimeMin = parseInt(movie.runtime, 10) || 0;
    const remaining = inProgress && runtimeMin ?
        formatRemaining(Math.max(1, Math.round((1 - progress) * runtimeMin)), { suffix: '' }) :
        '';
    const { minimal } = useHeroLayout(hero);
    const r = useResponsive();
    const short = useShortViewport();
    const landscape = useLandscape();
    const { play, prewarm } = usePlayer();
    // Mismo criterio que la ficha de serie: en vertical el póster llena la
    // pantalla sin recortar; tumbado o en tablet manda el backdrop.
    const portraitPhone = r.mobile && !landscape;
    const heroImage = portraitPhone ? (movie.poster || movie.backdrop || '') : (movie.backdrop || '');
    const startPlay = () => {
        play({
            itemId: movie.id,
            title: movie.title,
            startTicks: inProgress ? ticksFromProgress(runtimeMin, progress) : undefined
        });
    };

    useVmSignals(heroTrailerVM, (vm) => [vm.state, vm.trailerSource, vm.isMuted, vm.isPaused]);
    const trailerState = heroTrailerVM.state.value;
    const isTrailerActive = trailerState === 'playing' || trailerState === 'transitioning';
    
    useEffect(() => {
        heroTrailerVM.onSlideChanged({ 
            id: movie.id, 
            hasTrailer: movie.hasTrailer, 
            localTrailerCount: movie.localTrailerCount 
        });
        return () => {
            heroTrailerVM.reset();
        };
    }, [movie.id, movie.hasTrailer, movie.localTrailerCount]);

    const trans = useHomeScrollTransition();
    useEffect(() => {
        heroTrailerVM.onHeroOffscreen(trans.progress > 0);
    }, [trans.progress]);

    const onToggleMute = useCallback(() => heroTrailerVM.toggleMute(), []);
    const onTrailerError = useCallback(() => heroTrailerVM.onError(), []);

    // Menú contextual sobre el hero: el mismo que el MoreButton visible, pero
    // se invoca con clic derecho sin tocar el botón.
    const ctx = useItemContextMenu({
        id: movie.id,
        type: 'movie',
        itemTitle: movie.title,
        queueSubtitle: String(movie.year),
        queuePoster: movie.poster
    });
    return (
        <HeroFrame
            pos={isTrailerActive ? 'Esquina' : undefined}
            hero={hero}
            backdrop={heroImage}
            backdrops={portraitPhone ? undefined : movie.backdrops}
            onContextMenu={ctx.onContextMenu}
            trailerSource={heroTrailerVM.trailerSource.value}
            trailerState={heroTrailerVM.state.value}
            isMuted={heroTrailerVM.isMuted.value}
            isPaused={heroTrailerVM.isPaused.value}
            onToggleMute={onToggleMute}
            onError={onTrailerError}
            nav={
                <Nav
                    navigate={navigate}
                    breadcrumb={[
                        { label: globalize.translate('Movies'), to: { page: 'home' } },
                        { label: getItemGenres(movie)[0] ?? globalize.translate('Movie') },
                        { label: movie.title }
                    ]}
                    actionId={movieKey(movie.id)}
                    actionData={{ type: 'movie', movie }}
                />
            }
            footer={<ScrollHint label={globalize.translate('HeaderDetails')} />}
        >
            {/* La ficha de película centra su bloque de texto dentro de la
                colocación general del hero; la de serie lo alinea a la izquierda. */}
            <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: isTrailerActive ? 'flex-start' : 'center',
                textAlign: isTrailerActive ? 'left' : 'center',
                transition: 'all 550ms cubic-bezier(0.25, 1, 0.5, 1)',
                willChange: 'align-items, text-align, transform'
            }}>
                {!minimal && (
                    <HeroGenres
                        genres={getHeroGenres(movie)}
                        navigate={navigate}
                        fontSize={r.touch ? 10 : 12}
                        marginBottom={short ? 8 : r.touch ? 16 : 26}
                        justifyContent={isTrailerActive ? 'flex-start' : 'center'}
                    />
                )}

                <HeroTitle
                    logo={movie.logo}
                    title={movie.title}
                    align={isTrailerActive ? 'left' : 'center'}
                    logoMaxWidth={r.touch ? 'min(78vw, 325px)' : (isTrailerActive ? 320 : 520)}
                    logoMaxHeight={r.touch ? (short ? 'min(20vh, 58px)' : 'min(15vh, 100px)') : (isTrailerActive ? 110 : 180)}
                    logoShadow='rgba(0,0,0,0.6)'
                    fontSize={
                        short ? 'clamp(22px, 5.5vh, 36px)' :
                            r.touch ? 'clamp(33px, 8vw, 58px)' : (isTrailerActive ? 'clamp(44px, 6vw, 85px)' : 'clamp(74px, 9vw, 135px)')
                    }
                    letterSpacing={r.touch ? -1 : -2}
                    balance
                />

                {!minimal && !isTrailerActive && (
                    <HeroMeta
                        items={[
                            movie.year,
                            movie.runtime ? <RuntimeDisplay runtime={movie.runtime} autoCycle /> : null
                        ]}
                        ageRating={movie.rating.age}
                        imdbRating={movie.rating.imdb}
                        badges={movie.mediaBadges}
                        align='center'
                        marginTop={short ? 8 : r.touch ? 14 : 22}
                    />
                )}

                <HeroActionsRow
                    center={!isTrailerActive}
                    myList={<MyListButton itemId={movie.id} itemTitle={movie.title} />}
                    more={
                        // id real del server: descarga/metadata/imágenes lo
                        // necesitan; el prefijo movie- es solo de los stores
                        // locales y lo aplica MoreButton internamente.
                        <MoreButton
                            id={movie.id} size={18} type='movie' itemTitle={movie.title}
                            queueSubtitle={String(movie.year)}
                            queuePoster={movie.poster}
                        />
                    }
                >
                    <HeroPlayButton
                        onClick={startPlay}
                        onHover={() => prewarm(movie.id)}
                        complete={watched}
                        progress={inProgress ? progress : 0}
                        // Con el ratón encima el botón dice qué va a pasar al
                        // pulsarlo: los minutos que quedan, o «ver de nuevo» si
                        // ya está visto.
                        label={(hover) => (
                            inProgress ? (hover ? remaining : globalize.translate('ContinueWatching')) :
                                watched ? globalize.translate(hover ? 'WatchAgain' : 'Watched') :
                                    globalize.translate('Play')
                        )}
                    />
                </HeroActionsRow>
            </div>
            {ctx.menu}
        </HeroFrame>
    );
}

function MovieDetail({ movie, navigate }: { movie: Movie; navigate: Navigate }) {
    const saga = movieVM.saga.value;

    return (
        <DetailBody>
            <DetailColumns>
                <DetailOverviewSection
                    synopsis={movie.synopsis}
                    cast={movie.cast}
                    navigate={navigate}
                />

                <div>
                    <SectionLabel>{globalize.translate('HeaderDetails')}</SectionLabel>
                    <DetailTable>
                        {movie.director && (
                            <DetailRow label={globalize.translate('Director')}>{movie.director}</DetailRow>
                        )}
                        {movie.studio && (
                            <DetailRow label={globalize.translate('Studio')}>{movie.studio}</DetailRow>
                        )}
                        {movie.country && (
                            <DetailRow label={globalize.translate('Country')}>{movie.country}</DetailRow>
                        )}
                        {getItemGenres(movie).length > 0 && (
                            <DetailRow label={globalize.translate('Genres')}>
                                <GenreLinks genres={getItemGenres(movie)} navigate={navigate} />
                            </DetailRow>
                        )}
                        {movie.runtime && movie.runtime !== '—' && (
                            <DetailRow label={globalize.translate('LabelRuntimeMinutes')}>
                                <RuntimeDisplay runtime={movie.runtime} />
                            </DetailRow>
                        )}
                        {movie.premiere && (
                            <DetailRow label={globalize.translate('OptionPremiereDate')}>
                                {formatDateLong(movie.premiere)}
                            </DetailRow>
                        )}
                        {movie.video && (
                            <DetailRow label={globalize.translate('Video')}>{movie.video}</DetailRow>
                        )}
                        {movie.audio && (
                            <DetailRow label={globalize.translate('Audio')}>{movie.audio}</DetailRow>
                        )}
                        {movie.subtitles && (
                            <DetailRow label={globalize.translate('Subtitles')}>{movie.subtitles}</DetailRow>
                        )}
                        {movie.container && (
                            <DetailRow label={globalize.translate('MediaInfoContainer')}>
                                {movie.container.toUpperCase()}
                            </DetailRow>
                        )}
                    </DetailTable>
                </div>
            </DetailColumns>

            {saga && <SagaSection saga={saga} currentMovieId={movie.id} navigate={navigate} />}

            <LazySection>
                <Similar currentId={movie.id} navigate={navigate} />
            </LazySection>
        </DetailBody>
    );
}
