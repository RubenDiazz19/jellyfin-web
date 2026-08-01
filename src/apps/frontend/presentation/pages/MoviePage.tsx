import globalize from 'lib/globalize';

import { useEffect, useState } from 'react';
import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { formatRuntime, formatRemaining } from '../theme/format';
import { useWatched } from '../../domain/bridge/useWatched';
import type { Movie } from '../../domain/models';
import { movieVM } from '../../domain/viewModels/MovieViewModel';
import { useVmSignals } from '../../domain/bridge/useViewModel';
import {
    HeroFrame, HeroGenres, HeroTitle, useHeroLayout, type HeroTweaks
} from '../components/layout/DetailHero';
import { Nav } from '../components/layout/Nav';
import { ScrollHint } from '../components/layout/ScrollHint';
import { MoreButton } from '../components/controls/MoreButton';
import { MyListButton } from '../components/controls/MyListButton';
import { usePlayer } from '../components/player/PlayerProvider';
import { CastList } from '../components/cast/CastList';
import { Similar } from '../components/similar/Similar';
import { MC, useResponsive } from '../theme/responsive';
import type { Navigate } from '../../app/router';

type PageProps = { movieId: string; navigate: Navigate; hero?: HeroTweaks };

export function MoviePage({ movieId, navigate, hero }: PageProps) {
    useVmSignals(movieVM, (vm) => [vm.movie, vm.error]);
    useEffect(() => {
        void movieVM.load(movieId);
    }, [movieId]);
    const movie = movieVM.movieFor(movieId);
    if (!movie) {
        if (movieVM.error.value) {
            return (
                <section style={{
                    minHeight: '100vh', background: '#000', color: '#ff6b6b', fontFamily: T.ui,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
                }}>
                    {movieVM.error.value}
                </section>
            );
        }
        return (
            <section style={{
                minHeight: '100vh', background: '#000', color: T.dim, fontFamily: T.ui,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, letterSpacing: 3, textTransform: 'uppercase'
            }}>
                Cargando…
            </section>
        );
    }
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
    const [liveWatched] = useWatched(`movie-${movie.id}`);
    const watchedNum = movie.watched ?? 0;
    const progress = watchedNum > 0 && watchedNum < 1 ? watchedNum : 0;
    const watched = liveWatched || watchedNum >= 1;
    const inProgress = !watched && progress > 0;
    const [btnHover, setBtnHover] = useState(false);
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
            startTicks: inProgress && runtimeMin ?
                Math.round(runtimeMin * 60 * progress * 10_000_000) :
                undefined
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
                    actionId={`movie-${movie.id}`}
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

                <div style={{
                    marginTop: r.touch ? 22 : 36, display: 'flex', alignItems: 'center',
                    gap: r.touch ? 12 : 18, flexWrap: 'wrap', justifyContent: 'center'
                }}>
                    <button
                        onClick={startPlay}
                        // Mismo motivo que el hero de series: sin bloquear el focus
                        // nativo, Chrome scrollea unos px al pulsar (botón en hero
                        // 100vh) y el click puede no disparar a la primera.
                        onMouseDown={(e) => e.preventDefault()}
                        style={{
                            position: 'relative', overflow: 'hidden',
                            display: 'flex', alignItems: 'center', gap: 10, padding: '14px 28px',
                            background: watched ? '#fff' : 'transparent',
                            color: watched ? '#000' : '#fff',
                            border: watched ? 'none' : '1px solid rgba(255,255,255,0.4)',
                            borderRadius: 999,
                            fontFamily: T.ui, fontSize: 12, fontWeight: 600, letterSpacing: 0.3,
                            cursor: 'pointer', transition: 'background .2s ease, border-color .2s ease'
                        }}
                        onMouseEnter={() => setBtnHover(true)}
                        onMouseLeave={() => setBtnHover(false)}
                    >
                        {inProgress && (
                            <span style={{
                                position: 'absolute', top: 0, bottom: 0, left: 0,
                                width: `${progress * 100}%`,
                                background: 'rgba(255,255,255,0.22)', pointerEvents: 'none'
                            }} />
                        )}
                        <span style={{
                            position: 'relative', zIndex: 1,
                            display: 'flex', alignItems: 'center', gap: 10
                        }}>
                            {watched ?
                                <Ic.Check size={14} stroke='#000' /> :
                                <Ic.Play size={14} fill='#fff' />}
                            {/* Con el ratón encima el botón dice qué va a
                                    pasar al pulsarlo: los minutos que quedan,
                                    o «ver de nuevo» si ya está visto. */}
                            {inProgress ? (btnHover ? remaining : globalize.translate('ContinueWatching')) :
                                watched ? globalize.translate(btnHover ? 'WatchAgain' : 'Watched') :
                                    globalize.translate('Play')}
                        </span>
                    </button>
                    {/* En touch se oculta para dejar sitio — «añadir a lista»
                            vive en el bottom sheet del botón de más opciones. */}
                    {!r.touch && (
                        <>
                            <MyListButton itemId={movie.id} itemTitle={movie.title} />
                            <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.18)', margin: '0 4px' }} />
                        </>
                    )}
                    {/* id real del server: descarga/metadata/imágenes lo
                            necesitan; el prefijo movie- es solo de los stores
                            locales y lo aplica MoreButton internamente. */}
                    <MoreButton
                        id={movie.id} size={18} type='movie' itemTitle={movie.title}
                        queueSubtitle={String(movie.year)}
                        queuePoster={movie.poster}
                    />
                </div>
            </div>
        </HeroFrame>
    );
}

function MovieDetail({ movie, navigate }: { movie: Movie; navigate: Navigate }) {
    const r = useResponsive();
    return (
        <section style={{
            background: r.touch ? MC.bg : '#000',
            color: r.touch ? MC.fg : '#fff',
            padding: r.touch ? `24px ${r.pagePad}px 56px` : '32px 56px 96px',
            fontFamily: T.ui
        }}>
            {/* minmax(0,…) evita el grid blowout: sin él el track 1fr no baja
                del min-content del reparto y la rejilla desborda el viewport.
                En touch la ficha es single column (spec 4.3). */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: r.touch ? 'minmax(0, 1fr)' : 'minmax(0, 1.6fr) minmax(0, 1fr)',
                gap: r.touch ? 36 : 64
            }}>
                <div>
                    <div style={{
                        fontSize: 10, letterSpacing: 4, textTransform: 'uppercase',
                        color: T.dim, marginBottom: 18
                    }}>
                        {globalize.translate('Overview')}
                    </div>
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
                    <div style={{
                        fontSize: 10, letterSpacing: 4, textTransform: 'uppercase',
                        color: T.dim, marginBottom: 18
                    }}>
                        {globalize.translate('HeaderDetails')}
                    </div>
                    <div style={{
                        display: 'grid', gridTemplateColumns: '120px 1fr',
                        rowGap: 14, columnGap: 18, fontSize: 13
                    }}>
                        <span style={{ color: T.dim }}>{globalize.translate('Director')}</span><span>{movie.director}</span>
                        <span style={{ color: T.dim }}>{globalize.translate('Studio')}</span><span>{movie.studio}</span>
                        <span style={{ color: T.dim }}>{globalize.translate('Country')}</span><span>{movie.country}</span>
                        <span style={{ color: T.dim }}>{globalize.translate('Genres')}</span>
                        <span>
                            {movie.genres.map((g, i) => (
                                <span key={g}>
                                    <button
                                        onClick={() => navigate({ page: 'genre', genre: g })}
                                        style={{
                                            background: 'none', border: 'none', padding: 0,
                                            font: 'inherit', color: 'inherit', cursor: 'pointer',
                                            textDecoration: 'underline dotted', textUnderlineOffset: 3
                                        }}
                                    >{g}</button>
                                    {i < movie.genres.length - 1 && ', '}
                                </span>
                            ))}
                        </span>
                        <span style={{ color: T.dim }}>{globalize.translate('LabelRuntimeMinutes')}</span><span>{formatRuntime(movie.runtime)}</span>
                        <span style={{ color: T.dim }}>{globalize.translate('OptionPremiereDate')}</span><span>{movie.premiere}</span>
                    </div>
                </div>
            </div>

            <Similar currentId={movie.id} currentGenres={movie.genres} kind='movie' navigate={navigate} />
        </section>
    );
}
