import { useEffect, useState } from 'react';
import { T, HERO_POS, HERO_SCRIM } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { formatRuntime, formatRemaining } from '../theme/format';
import { useWatched } from '../../domain/bridge/useWatched';
import type { Movie } from '../../domain/models';
import { movieVM } from '../../domain/viewModels/MovieViewModel';
import { useViewModel } from '../../domain/bridge/useViewModel';
import { Backdrop } from '../components/layout/Backdrop';
import { Nav } from '../components/layout/Nav';
import { ScrollHint } from '../components/layout/ScrollHint';
import { MoreButton } from '../components/controls/MoreButton';
import { CastList } from '../components/cast/CastList';
import { Similar } from '../components/similar/Similar';
import type { Navigate } from '../../app/router';
import type { HeroTweaks } from './ShowPage';

type PageProps = { movieId: string; navigate: Navigate; hero?: HeroTweaks };

export function MoviePage({ movieId, navigate, hero }: PageProps) {
    useViewModel(movieVM);
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
    const remaining = formatRemaining(movie.remaining) || movie.remaining || '';
    const pos = HERO_POS[hero?.heroPos ?? 'Esquina'];
    const minimal = hero?.heroInfo === 'Mínima';
    const scrim = HERO_SCRIM[hero?.heroScrim ?? 'Media'];
    return (
        <section style={{
            position: 'relative', height: '100vh', width: '100%', overflow: 'hidden', background: '#000'
        }}>
            <Nav
                navigate={navigate}
                breadcrumb={[
                    { label: 'Películas', to: { page: 'home' } },
                    { label: movie.genres[0] },
                    { label: movie.title }
                ]}
                actionId={`movie-${movie.id}`}
                actionData={{ type: 'movie', movie }}
            />
            <Backdrop src={movie.backdrop || ''} fadeBottom={0.92} itemId={movie.id} sharp />
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: `linear-gradient(to top, rgba(0,0,0,${scrim}) 0%, rgba(0,0,0,${(scrim * 0.45).toFixed(2)}) 24%, transparent 56%)`
            }} />

            <div style={{
                position: 'absolute', inset: 0, padding: pos.pad,
                display: 'flex', flexDirection: 'column',
                alignItems: pos.align as any, justifyContent: pos.justify as any,
                textAlign: pos.text as any
            }}>
                <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', textAlign: 'center'
                }}>
                    {!minimal && (
                        <div style={{
                            fontFamily: T.ui, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.7)', marginBottom: 26,
                            display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center'
                        }}>
                            {movie.genres.map((g, i) => (
                                <span key={g} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span
                                        onClick={(e) => { e.stopPropagation(); navigate({ page: 'genre', genre: g }); }}
                                        style={{ cursor: 'pointer' }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = '')}
                                    >
                                        {g}
                                    </span>
                                    {i < movie.genres.length - 1 && <span style={{ opacity: 0.5 }}>·</span>}
                                </span>
                            ))}
                        </div>
                    )}

                    {movie.logo ? (
                        <img
                            src={movie.logo}
                            alt={movie.title}
                            decoding='async'
                            style={{
                                maxWidth: 580, maxHeight: 200, width: 'auto', height: 'auto',
                                filter: 'drop-shadow(0 4px 60px rgba(0,0,0,0.6))', objectFit: 'contain'
                            }}
                        />
                    ) : (
                        <h1 style={{
                            fontFamily: T.display, fontSize: 'clamp(82px, 10vw, 150px)', lineHeight: 0.92,
                            margin: 0, fontWeight: 250, letterSpacing: -2,
                            textShadow: '0 4px 60px rgba(0,0,0,0.6)', textWrap: 'balance'
                        }}>
                            {movie.title}
                        </h1>
                    )}

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

                    <div style={{ marginTop: 36, display: 'flex', alignItems: 'center', gap: 18 }}>
                        <button
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
                                {inProgress ? (btnHover ? remaining : 'Continuar viendo') : watched ? 'Visto' : 'Reproducir'}
                            </span>
                        </button>
                        <button style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '13px 22px',
                            background: 'transparent', color: '#fff',
                            border: '1px solid rgba(255,255,255,0.4)', borderRadius: 999,
                            fontFamily: T.ui, fontSize: 13, fontWeight: 500, cursor: 'pointer'
                        }}>
                            <Ic.Plus size={14} /> Mi lista
                        </button>
                        <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.18)', margin: '0 4px' }} />
                        {/* id real del server: descarga/metadata/imágenes lo
                            necesitan; el prefijo movie- es solo de los stores
                            locales y lo aplica MoreButton internamente. */}
                        <MoreButton id={movie.id} size={18} type='movie' itemTitle={movie.title} />
                    </div>
                </div>
            </div>

            <ScrollHint label='Detalles' />
        </section>
    );
}

function MovieDetail({ movie, navigate }: { movie: Movie; navigate: Navigate }) {
    return (
        <section style={{
            background: '#000', color: '#fff', padding: '32px 56px 96px', fontFamily: T.ui
        }}>
            {/* minmax(0,…) evita el grid blowout: sin él el track 1fr no baja
                del min-content del reparto y la rejilla desborda el viewport. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 64 }}>
                <div>
                    <div style={{
                        fontSize: 10, letterSpacing: 4, textTransform: 'uppercase',
                        color: T.dim, marginBottom: 18
                    }}>
                        Sinopsis
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
                        Detalles
                    </div>
                    <div style={{
                        display: 'grid', gridTemplateColumns: '120px 1fr',
                        rowGap: 14, columnGap: 18, fontSize: 13
                    }}>
                        <span style={{ color: T.dim }}>Dirección</span><span>{movie.director}</span>
                        <span style={{ color: T.dim }}>Estudio</span><span>{movie.studio}</span>
                        <span style={{ color: T.dim }}>País</span><span>{movie.country}</span>
                        <span style={{ color: T.dim }}>Géneros</span>
                        <span>
                            {movie.genres.map((g, i) => (
                                <span key={g}>
                                    <span
                                        onClick={() => navigate({ page: 'genre', genre: g })}
                                        style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}
                                    >{g}</span>
                                    {i < movie.genres.length - 1 && ', '}
                                </span>
                            ))}
                        </span>
                        <span style={{ color: T.dim }}>Duración</span><span>{formatRuntime(movie.runtime)}</span>
                        <span style={{ color: T.dim }}>Estreno</span><span>{movie.premiere}</span>
                    </div>
                </div>
            </div>

            <Similar currentId={movie.id} currentGenres={movie.genres} kind='movie' navigate={navigate} />
        </section>
    );
}
