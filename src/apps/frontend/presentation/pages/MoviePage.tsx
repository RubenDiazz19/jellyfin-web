import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { formatRuntime, formatRemaining } from '../theme/format';
import { useWatched } from '../../domain/bridge/useWatched';
import type { Movie } from '../../domain/models';
import {
    HeroFrame, HeroGenres, HeroTitle, useHeroLayout, type HeroTweaks
} from '../components/layout/DetailHero';
import { HeroActionsRow, HeroPlayButton } from '../components/layout/HeroActions';
import {
    DetailBody, DetailColumns, DetailRow, DetailStatus, DetailTable, GenreLinks, SectionLabel
} from '../components/layout/DetailSections';
import { Nav } from '../components/layout/Nav';
import { ScrollHint } from '../components/layout/ScrollHint';
import { MoreButton } from '../components/controls/MoreButton';
import { MyListButton } from '../components/controls/MyListButton';
import { usePlayer } from '../components/player/PlayerProvider';
import { CastList } from '../components/cast/CastList';
import { Similar } from '../components/similar/Similar';
import { useResponsive } from '../theme/responsive';
import type { Navigate } from '../../app/router';
import { useMovieEntity } from './useDetailEntity';
import { movieKey } from '../../domain/stores';
import { ticksFromProgress } from '../../domain/player/format';

type PageProps = { movieId: string; navigate: Navigate; hero?: HeroTweaks };

export function MoviePage({ movieId, navigate, hero }: PageProps) {
    const { item: movie, error } = useMovieEntity(movieId);
    if (!movie) return <DetailStatus error={error} />;
    return (
        <>
            <MovieHero movie={movie} navigate={navigate} hero={hero} />
            <MovieDetail movie={movie} navigate={navigate} />
        </>
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
    const { play } = usePlayer();
    const startPlay = () => {
        play({
            itemId: movie.id,
            title: movie.title,
            startTicks: inProgress ? ticksFromProgress(runtimeMin, progress) : undefined
        });
    };
    return (
        <HeroFrame
            hero={hero}
            backdrop={movie.backdrop || ''}
            backdrops={movie.backdrops}
            itemId={movie.id}
            nav={
                <Nav
                    navigate={navigate}
                    breadcrumb={[
                        { label: globalize.translate('Movies'), to: { page: 'home' } },
                        { label: movie.genres[0] },
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
                alignItems: 'center', textAlign: 'center'
            }}>
                {!minimal && (
                    <HeroGenres
                        genres={movie.genres}
                        navigate={navigate}
                        fontSize={12}
                        marginBottom={26}
                        justifyContent='center'
                    />
                )}

                <HeroTitle
                    logo={movie.logo}
                    title={movie.title}
                    logoMaxWidth={r.touch ? 'min(78vw, 360px)' : 580}
                    logoMaxHeight={r.touch ? 120 : 200}
                    logoShadow='rgba(0,0,0,0.6)'
                    fontSize={r.touch ? 'clamp(38px, 10vw, 72px)' : 'clamp(82px, 10vw, 150px)'}
                    letterSpacing={r.touch ? -1 : -2}
                    balance
                />

                {!minimal && (
                    <div style={{
                        marginTop: 22, display: 'flex', alignItems: 'center', gap: 18,
                        flexWrap: 'wrap', justifyContent: 'center',
                        fontFamily: T.ui, fontSize: 13, color: 'rgba(255,255,255,0.78)'
                    }}>
                        <span>{movie.year}</span><Ic.Dot />
                        <span>{formatRuntime(movie.runtime)}</span><Ic.Dot />
                        <span style={{
                            border: '1px solid rgba(255,255,255,0.35)', padding: '2px 6px',
                            fontSize: 10, letterSpacing: 1
                        }}>
                            {movie.rating.age}
                        </span>
                        <Ic.Dot />
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Ic.Imdb /> {movie.rating.imdb}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Ic.Tomato /> {movie.rating.rt}%
                        </span>
                    </div>
                )}

                <HeroActionsRow
                    center
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
        </HeroFrame>
    );
}

function MovieDetail({ movie, navigate }: { movie: Movie; navigate: Navigate }) {
    return (
        <DetailBody>
            <DetailColumns>
                <div>
                    <SectionLabel>{globalize.translate('Overview')}</SectionLabel>
                    <p style={{
                        fontFamily: T.ui, fontSize: 17, lineHeight: 1.55, margin: 0,
                        color: 'rgba(255,255,255,0.82)', maxWidth: 640, textWrap: 'pretty', fontWeight: 400
                    }}>
                        {movie.synopsis}
                    </p>

                    <div style={{ marginTop: 48 }}>
                        <CastList cast={movie.cast} navigate={navigate} />
                    </div>
                </div>

                <div>
                    <SectionLabel>{globalize.translate('HeaderDetails')}</SectionLabel>
                    <DetailTable>
                        <DetailRow label={globalize.translate('Director')}>{movie.director}</DetailRow>
                        <DetailRow label={globalize.translate('Studio')}>{movie.studio}</DetailRow>
                        <DetailRow label={globalize.translate('Country')}>{movie.country}</DetailRow>
                        <DetailRow label={globalize.translate('Genres')}>
                            <GenreLinks genres={movie.genres} navigate={navigate} />
                        </DetailRow>
                        <DetailRow label={globalize.translate('LabelRuntimeMinutes')}>
                            {formatRuntime(movie.runtime)}
                        </DetailRow>
                        <DetailRow label={globalize.translate('OptionPremiereDate')}>{movie.premiere}</DetailRow>
                    </DetailTable>
                </div>
            </DetailColumns>

            <Similar currentId={movie.id} currentGenres={movie.genres} kind='movie' navigate={navigate} />
        </DetailBody>
    );
}
