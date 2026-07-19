import { useEffect, useState } from 'react';
import { T, HERO_POS, HERO_SCRIM, type HeroPosKey, type HeroScrimKey } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { formatRemaining } from '../theme/format';
import { WATCHED } from '../../domain/stores';
import { useWatchedVersion } from '../../domain/bridge/useWatched';
import { PROTO_DATA, type Show } from '../../domain/models';
import { showVM } from '../../domain/viewModels/ShowViewModel';
import { useViewModel } from '../../domain/bridge/useViewModel';
import { Backdrop } from '../components/layout/Backdrop';
import { Nav } from '../components/layout/Nav';
import { ScrollHint } from '../components/layout/ScrollHint';
import { MoreButton } from '../components/controls/MoreButton';
import { usePlayer } from '../components/player/PlayerProvider';
import { SeasonCard } from '../components/cards/SeasonCard';
import { CastList } from '../components/cast/CastList';
import { Similar } from '../components/similar/Similar';
import type { Navigate } from '../../app/router';

export type HeroTweaks = {
    heroPos?: HeroPosKey;
    heroInfo?: 'Mínima' | 'Completa';
    heroScrim?: HeroScrimKey;
};

type PageProps = { showId: string; navigate: Navigate; hero?: HeroTweaks };

export function ShowPage({ showId, navigate, hero }: PageProps) {
    const proto = PROTO_DATA.shows[showId];
    // Si la ID no está en el catálogo prototipo asumimos que viene de Jellyfin.
    useViewModel(showVM);
    useEffect(() => {
        if (!proto) void showVM.load(showId);
    }, [proto, showId]);
    const show = proto ?? showVM.showFor(showId);
    if (!show) {
        if (showVM.error.value) {
            return (
                <section style={{
                    minHeight: '100vh', background: '#000', color: '#ff6b6b', fontFamily: T.ui,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
                }}>
                    {showVM.error.value}
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
            <ShowHero show={show} navigate={navigate} hero={hero} />
            <ShowDetail show={show} navigate={navigate} />
        </>
    );
}

function ShowHero({ show, navigate, hero }: { show: Show; navigate: Navigate; hero?: HeroTweaks }) {
    const cont = show.cont;
    const target = cont ?
        { seasonN: cont.seasonN, epN: cont.epN } :
        { seasonN: show.seasons[0].n, epN: 1 };
    const label = `T${target.seasonN}:E${String(target.epN).padStart(2, '0')}`;
    useWatchedVersion();
    const allEpIds = (show.seasons || []).flatMap((s) =>
        (s.episodes || []).map((ep) => `${show.id}-s${s.n}-e${ep.n}`)
    );
    const complete = allEpIds.length > 0 && allEpIds.every((id) => WATCHED.has(id));
    const progress = complete ? 0 : cont ? cont.progress : 0;
    const inProgress = !complete && !!cont && progress > 0;
    const [btnHover, setBtnHover] = useState(false);
    const epLabel = `T${target.seasonN} E${String(target.epN).padStart(2, '0')}`;
    const remaining = cont ? formatRemaining(cont.remaining, { suffix: '' }) : '';
    const pos = HERO_POS[hero?.heroPos ?? 'Esquina'];
    const minimal = hero?.heroInfo === 'Mínima';
    const scrim = HERO_SCRIM[hero?.heroScrim ?? 'Media'];
    const { play } = usePlayer();
    const targetEp = show.seasons
        .find((s) => s.n === target.seasonN)
        ?.episodes.find((e) => e.n === target.epN);
    const startPlay = () => {
        if (targetEp?.jfId) {
            play({
                itemId: targetEp.jfId,
                title: `${show.title} · T${target.seasonN} E${String(target.epN).padStart(2, '0')} — ${targetEp.title ?? ''}`,
                startTicks: cont && cont.progress > 0 && targetEp.runtime ?
                    Math.round(targetEp.runtime * 60 * cont.progress * 10_000_000) :
                    undefined
            });
        } else {
            // Fallback: al menos llevamos al usuario a la ficha del episodio.
            navigate({ page: 'episode', showId: show.id, seasonN: target.seasonN, epN: target.epN });
        }
    };
    return (
        <section style={{
            position: 'relative', height: '100vh', width: '100%', overflow: 'hidden', background: '#000'
        }}>
            <Nav
                navigate={navigate}
                breadcrumb={[
                    { label: 'Series', to: { page: 'home' } },
                    { label: 'Drama' },
                    { label: show.title }
                ]}
                actionId={show.id}
                actionData={{ type: 'show', id: show.id }}
            />
            <Backdrop
                src={show.backdrop || ''} srcs={show.backdrops}
                fadeBottom={0.92} itemId={show.id} sharp
            />
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
                {!minimal && (
                    <div style={{
                        fontFamily: T.ui, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.7)', marginBottom: 18,
                        display: 'flex', gap: 10, flexWrap: 'wrap',
                        justifyContent: pos.justify === 'flex-end' && pos.align === 'flex-start' ? 'flex-start' : 'center'
                    }}>
                        {show.genres.map((g, i) => (
                            <span key={g} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span
                                    onClick={(e) => { e.stopPropagation(); navigate({ page: 'genre', genre: g }); }}
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = '')}
                                >
                                    {g}
                                </span>
                                {i < show.genres.length - 1 && <span style={{ opacity: 0.5 }}>·</span>}
                            </span>
                        ))}
                    </div>
                )}

                {show.logo ? (
                    <img
                        src={show.logo}
                        alt={show.title}
                        decoding='async'
                        style={{
                            maxWidth: 500, maxHeight: 170, width: 'auto', height: 'auto',
                            filter: 'drop-shadow(0 4px 60px rgba(0,0,0,0.5))', objectFit: 'contain'
                        }}
                    />
                ) : (
                    <h1 style={{
                        fontFamily: T.display, fontSize: 'clamp(76px, 9vw, 134px)', lineHeight: 0.92,
                        margin: 0, fontWeight: 250, letterSpacing: -3,
                        textShadow: '0 4px 60px rgba(0,0,0,0.6)'
                    }}>
                        {show.title}
                    </h1>
                )}

                {!minimal && (
                    <div style={{
                        marginTop: 18, display: 'flex', alignItems: 'center', gap: 14,
                        flexWrap: 'wrap',
                        justifyContent: pos.justify === 'flex-end' && pos.align === 'flex-start' ? 'flex-start' : 'center',
                        fontFamily: T.ui, fontSize: 13, color: 'rgba(255,255,255,0.78)'
                    }}>
                        <span>{show.year}</span><Ic.Dot />
                        <span>{show.seasons.length} temporadas</span><Ic.Dot />
                        <span style={{
                            border: '1px solid rgba(255,255,255,0.35)', padding: '3px 8px',
                            fontSize: 11, letterSpacing: 1
                        }}>
                            {show.rating.age}
                        </span>
                        <Ic.Dot />
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Ic.Imdb /> {show.rating.imdb}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Ic.Tomato /> {show.rating.rt}%</span>
                    </div>
                )}

                <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button
                        onClick={startPlay}
                        // Mismo motivo que PlayBtn: sin bloquear el focus nativo, Chrome
                        // scrollea unos px al pulsar (el botón vive en el hero 100vh con
                        // flex-end) y el mouseup cae fuera → el click no dispara a la
                        // primera. preventDefault en mousedown mantiene el click intacto
                        // y la accesibilidad con Tab.
                        onMouseDown={(e) => e.preventDefault()}
                        style={{
                            position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center',
                            gap: 10, padding: '14px 28px',
                            background: complete ? '#fff' : 'transparent',
                            color: complete ? '#000' : '#fff',
                            border: complete ? 'none' : '1px solid rgba(255,255,255,0.4)',
                            borderRadius: 999, whiteSpace: 'nowrap',
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
                            position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center',
                            gap: 10, whiteSpace: 'nowrap'
                        }}>
                            {complete ?
                                <Ic.Check size={14} stroke='#000' /> :
                                <Ic.Play size={14} fill='#fff' />}
                            {/* Al hover: solo tiempo restante (se expande horizontalmente).
                                Sin hover: episodio (T1 E01) o estado (Visto/Reproducir). */}
                            {inProgress && btnHover && remaining ? (
                                remaining
                            ) : (
                                inProgress ? epLabel : complete ? 'Visto' : `Reproducir ${label}`
                            )}
                        </span>
                    </button>
                    <button style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px',
                        background: 'transparent', color: '#fff',
                        border: '1px solid rgba(255,255,255,0.4)', borderRadius: 999,
                        fontFamily: T.ui, fontSize: 12, fontWeight: 500, cursor: 'pointer'
                    }}>
                        <Ic.Plus size={14} /> Mi lista
                    </button>
                    <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.18)', margin: '0 4px' }} />
                    <MoreButton
                        id={show.id} size={18} type='show' itemTitle={show.title}
                        nextEpisodeId={
                            show.seasons
                                .find((s) => s.n === (show.cont?.seasonN ?? show.defaultSeason))
                                ?.episodes.find((e) => e.n === (show.cont?.epN ?? 1))?.jfId
                        }
                    />
                </div>
            </div>

            <ScrollHint label='Episodios' />
        </section>
    );
}

function ShowDetail({ show, navigate }: { show: Show; navigate: Navigate }) {
    return (
        <section style={{
            background: '#000', color: '#fff', padding: '32px 56px 96px', fontFamily: T.ui
        }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 64 }}>
                <div>
                    <div style={{
                        fontFamily: T.ui, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase',
                        color: T.dim, marginBottom: 18
                    }}>
                        Sinopsis
                    </div>
                    <p style={{
                        fontFamily: T.ui, fontSize: 17, lineHeight: 1.55, margin: 0,
                        color: 'rgba(255,255,255,0.82)', maxWidth: 640, textWrap: 'pretty', fontWeight: 400
                    }}>
                        {show.synopsis}
                    </p>

                    <div style={{ marginTop: 48 }}>
                        <CastList cast={show.cast} navigate={navigate} />
                    </div>
                </div>

                <div>
                    <div style={{
                        fontFamily: T.ui, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase',
                        color: T.dim, marginBottom: 18
                    }}>
                        Detalles
                    </div>
                    <div style={{
                        display: 'grid', gridTemplateColumns: '120px 1fr',
                        rowGap: 14, columnGap: 18, fontSize: 13
                    }}>
                        <span style={{ color: T.dim }}>Creador</span><span>{show.creator}</span>
                        <span style={{ color: T.dim }}>Dirección</span><span>{show.directors}</span>
                        <span style={{ color: T.dim }}>Estudio</span><span>{show.studio}</span>
                        <span style={{ color: T.dim }}>País</span><span>{show.country}</span>
                        <span style={{ color: T.dim }}>Géneros</span>
                        <span>
                            {show.genres.map((g, i) => (
                                <span key={g}>
                                    <span
                                        onClick={() => navigate({ page: 'genre', genre: g })}
                                        style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}
                                    >{g}</span>
                                    {i < show.genres.length - 1 && ', '}
                                </span>
                            ))}
                        </span>
                        <span style={{ color: T.dim }}>Duración</span><span>{show.runtime}</span>
                        <span style={{ color: T.dim }}>Estreno</span><span>{show.premiere}</span>
                        <span style={{ color: T.dim }}>Estado</span><span style={{ color: '#fff' }}>{show.status}</span>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: 88 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 32 }}>
                    <h3 style={{
                        fontFamily: T.display, fontStyle: 'italic', fontSize: 30, fontWeight: 300, margin: 0
                    }}>
                        Temporadas
                    </h3>
                    <div style={{ marginLeft: 14, fontFamily: T.ui, fontSize: 12, color: T.dim }}>
                        {show.seasons.length} temporadas · {show.seasons.reduce((a, s) => a + s.total, 0)} episodios
                    </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22 }}>
                    {show.seasons.map((s) => (
                        <SeasonCard key={s.n} show={show} season={s} navigate={navigate} />
                    ))}
                </div>
            </div>

            <Similar currentId={show.id} currentGenres={show.genres} kind='show' navigate={navigate} />
        </section>
    );
}
