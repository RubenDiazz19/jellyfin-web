import globalize from 'lib/globalize';

import { useEffect, useState } from 'react';
import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { formatRemaining } from '../theme/format';
import { WATCHED } from '../../domain/stores';
import { useWatchedVersion } from '../../domain/bridge/useWatched';
import { PROTO_DATA, type Show } from '../../domain/models';
import { showVM } from '../../domain/viewModels/ShowViewModel';
import { useVmSignals } from '../../domain/bridge/useViewModel';
import {
    HeroFrame, HeroGenres, HeroTitle, useHeroLayout, type HeroTweaks
} from '../components/layout/DetailHero';
import { Nav } from '../components/layout/Nav';
import { ScrollHint } from '../components/layout/ScrollHint';
import { MoreButton } from '../components/controls/MoreButton';
import { MyListButton } from '../components/controls/MyListButton';
import { usePlayer } from '../components/player/PlayerProvider';
import { SeasonCard } from '../components/cards/SeasonCard';
import { CastList } from '../components/cast/CastList';
import { Similar } from '../components/similar/Similar';
import { MC, useResponsive } from '../theme/responsive';
import type { Navigate } from '../../app/router';

type PageProps = { showId: string; navigate: Navigate; hero?: HeroTweaks };

export function ShowPage({ showId, navigate, hero }: PageProps) {
    const proto = PROTO_DATA.shows[showId];
    // Si la ID no está en el catálogo prototipo asumimos que viene de Jellyfin.
    // La página no lee `loading` (pinta «Cargando…» cuando show es null), así
    // que no se suscribe a él.
    useVmSignals(showVM, (vm) => [vm.show, vm.error]);
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
    const { minimal, inlineJustify } = useHeroLayout(hero);
    const r = useResponsive();
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
        <HeroFrame
            hero={hero}
            backdrop={show.backdrop || ''}
            backdrops={show.backdrops}
            itemId={show.id}
            nav={
                <Nav
                    navigate={navigate}
                    breadcrumb={[
                        { label: globalize.translate('Shows'), to: { page: 'home' } },
                        { label: 'Drama' },
                        { label: show.title }
                    ]}
                    actionId={show.id}
                    actionData={{ type: 'show', id: show.id }}
                />
            }
            footer={<ScrollHint label={globalize.translate('Episodes')} />}
        >
            <>
                {!minimal && (
                    <HeroGenres
                        genres={show.genres}
                        navigate={navigate}
                        fontSize={10}
                        marginBottom={18}
                        justifyContent={inlineJustify}
                    />
                )}

                <HeroTitle
                    logo={show.logo}
                    title={show.title}
                    logoMaxWidth={r.touch ? 'min(78vw, 340px)' : 500}
                    logoMaxHeight={r.touch ? 110 : 170}
                    logoShadow='rgba(0,0,0,0.5)'
                    fontSize={r.touch ? 'clamp(36px, 9vw, 68px)' : 'clamp(76px, 9vw, 134px)'}
                    letterSpacing={r.touch ? -1 : -3}
                />

                {!minimal && (
                    <div style={{
                        marginTop: 18, display: 'flex', alignItems: 'center', gap: 14,
                        flexWrap: 'wrap',
                        justifyContent: inlineJustify,
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

                <div style={{
                    marginTop: r.touch ? 20 : 28, display: 'flex', alignItems: 'center',
                    gap: r.touch ? 12 : 16, flexWrap: 'wrap'
                }}>
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
                                inProgress ? epLabel :
                                    complete ? globalize.translate(btnHover ? 'WatchAgain' : 'Watched') :
                                        `${globalize.translate('Play')} ${label}`
                            )}
                        </span>
                    </button>
                    {/* En touch se oculta (añadir a lista vive en el bottom
                        sheet del botón de más opciones). */}
                    {!r.touch && (
                        <>
                            <MyListButton itemId={show.id} itemTitle={show.title} size='sm' />
                            <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.18)', margin: '0 4px' }} />
                        </>
                    )}
                    <MoreButton
                        id={show.id} size={18} type='show' itemTitle={show.title}
                        nextEpisodeId={
                            show.seasons
                                .find((s) => s.n === (show.cont?.seasonN ?? show.defaultSeason))
                                ?.episodes.find((e) => e.n === (show.cont?.epN ?? 1))?.jfId
                        }
                        queueSubtitle={globalize.translate(
                            'ValueSeasonEpisode',
                            show.cont?.seasonN ?? show.defaultSeason,
                            show.cont?.epN ?? 1
                        )}
                        queuePoster={show.poster}
                    />
                </div>
            </>
        </HeroFrame>
    );
}

function ShowDetail({ show, navigate }: { show: Show; navigate: Navigate }) {
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
                        fontFamily: T.ui, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase',
                        color: T.dim, marginBottom: 18
                    }}>
                        {globalize.translate('Overview')}
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
                        {globalize.translate('HeaderDetails')}
                    </div>
                    <div style={{
                        display: 'grid', gridTemplateColumns: '120px 1fr',
                        rowGap: 14, columnGap: 18, fontSize: 13
                    }}>
                        <span style={{ color: T.dim }}>{globalize.translate('Creator')}</span><span>{show.creator}</span>
                        <span style={{ color: T.dim }}>{globalize.translate('Director')}</span><span>{show.directors}</span>
                        <span style={{ color: T.dim }}>{globalize.translate('Studio')}</span><span>{show.studio}</span>
                        <span style={{ color: T.dim }}>{globalize.translate('Country')}</span><span>{show.country}</span>
                        <span style={{ color: T.dim }}>{globalize.translate('Genres')}</span>
                        <span>
                            {show.genres.map((g, i) => (
                                <span key={g}>
                                    <button
                                        onClick={() => navigate({ page: 'genre', genre: g })}
                                        style={{
                                            background: 'none', border: 'none', padding: 0,
                                            font: 'inherit', color: 'inherit', cursor: 'pointer',
                                            textDecoration: 'underline dotted', textUnderlineOffset: 3
                                        }}
                                    >{g}</button>
                                    {i < show.genres.length - 1 && ', '}
                                </span>
                            ))}
                        </span>
                        <span style={{ color: T.dim }}>{globalize.translate('LabelRuntimeMinutes')}</span><span>{show.runtime}</span>
                        <span style={{ color: T.dim }}>{globalize.translate('OptionPremiereDate')}</span><span>{show.premiere}</span>
                        <span style={{ color: T.dim }}>{globalize.translate('HeaderStatus')}</span><span style={{ color: '#fff' }}>{show.status}</span>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: r.touch ? 44 : 88 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: r.touch ? 18 : 32 }}>
                    <h3 style={{
                        fontFamily: T.display, fontStyle: 'italic', fontSize: 30, fontWeight: 300, margin: 0
                    }}>
                        {globalize.translate('HeaderSeasons')}
                    </h3>
                    <div style={{ marginLeft: 14, fontFamily: T.ui, fontSize: 12, color: T.dim }}>
                        {show.seasons.length} temporadas · {show.seasons.reduce((a, s) => a + s.total, 0)} episodios
                    </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: r.touch ? r.gap : 22 }}>
                    {show.seasons.map((s) => (
                        <SeasonCard key={s.n} show={show} season={s} navigate={navigate} />
                    ))}
                </div>
            </div>

            <Similar currentId={show.id} currentGenres={show.genres} kind='show' navigate={navigate} />
        </section>
    );
}
