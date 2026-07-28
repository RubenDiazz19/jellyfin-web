import globalize from 'lib/globalize';

import { useEffect } from 'react';
import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { formatDateLong, formatRemainingCompact } from '../theme/format';
import { PROTO_DATA, findSeason, type Show, type Season, type Episode } from '../../domain/models';
import { showVM } from '../../domain/viewModels/ShowViewModel';
import { useVmSignals } from '../../domain/bridge/useViewModel';
import { useWatched } from '../../domain/bridge/useWatched';
import { Backdrop } from '../components/layout/Backdrop';
import { Nav } from '../components/layout/Nav';
import { ScrollHint } from '../components/layout/ScrollHint';
import { PlayBtn } from '../components/controls/PlayBtn';
import { usePlayer } from '../components/player/PlayerProvider';
import { MoreButton } from '../components/controls/MoreButton';
import { FavButton } from '../components/controls/FavButton';
import { WatchedButton } from '../components/controls/WatchedButton';
import { CastList } from '../components/cast/CastList';
import { MC, useResponsive } from '../theme/responsive';
import type { Navigate } from '../../app/router';

type PageProps = { showId: string; seasonN: number; epN: number; navigate: Navigate };

export function EpisodePage({ showId, seasonN, epN, navigate }: PageProps) {
    const proto = PROTO_DATA.shows[showId];
    useVmSignals(showVM, (vm) => [vm.show, vm.error]);
    useEffect(() => {
        if (!proto) void showVM.load(showId);
    }, [proto, showId]);
    const show = proto ?? showVM.showFor(showId);
    const season = show ? findSeason(show, seasonN) : null;
    const ep = season ? season.episodes.find((e) => e.n === epN) : null;
    if (!show || !season || !ep) {
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
        if (!show) {
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
        // Serie cargada pero temporada/episodio inexistentes en la URL.
        return null;
    }
    const nextEp = season.episodes.find((e) => e.n === epN + 1);
    return (
        <>
            <EpisodeHero show={show} season={season} ep={ep} navigate={navigate} />
            <EpisodeDetail show={show} season={season} ep={ep} nextEp={nextEp} navigate={navigate} />
        </>
    );
}

function EpisodeHero({
    show, season, ep, navigate
}: {
    show: Show; season: Season; ep: Episode; navigate: Navigate;
}) {
    const r = useResponsive();
    const { play } = usePlayer();
    // El tick del Nav escribe en el store local; leerlo aquí mantiene el play
    // en sincronía al instante (sin esperar a que se recargue la serie).
    const [localWatched] = useWatched(`${show.id}-s${season.n}-e${ep.n}`);
    const watched = localWatched || ep.watched >= 1;
    const inProgress = !watched && ep.watched > 0 && ep.watched < 1;
    // Texto que sale SOLO al pasar el ratón por el círculo: «Ver de nuevo» si
    // está visto, minutos restantes si está a medias. El resto del tiempo el
    // botón muestra el tick / el play, sin ningún texto suelto debajo.
    const hoverText = watched ?
        globalize.translate('WatchAgain') :
        inProgress && ep.runtime ?
            formatRemainingCompact(Math.round((1 - ep.watched) * ep.runtime)) :
            null;
    const startPlay = () => {
        if (!ep.jfId) return;
        play({
            itemId: ep.jfId,
            title: `${show.title} · T${season.n} E${String(ep.n).padStart(2, '0')} — ${ep.title ?? ''}`,
            startTicks: ep.watched > 0 && ep.watched < 1 && ep.runtime ?
                Math.round(ep.runtime * 60 * ep.watched * 10_000_000) :
                undefined
        });
    };
    return (
        <section style={{
            position: 'relative', height: '100vh', width: '100%', overflow: 'hidden', background: '#000'
        }}>
            <Nav
                navigate={navigate}
                breadcrumb={[
                    { label: globalize.translate('Shows'), to: { page: 'home' } },
                    { label: show.title, to: { page: 'show', showId: show.id } },
                    { label: `Temporada ${season.n}`, to: { page: 'season', showId: show.id, seasonN: season.n } },
                    { label: `Episodio ${ep.n}` }
                ]}
                actionId={`${show.id}-s${season.n}-e${ep.n}`}
                actionData={ep.jfId ? { type: 'episode', id: ep.jfId } : undefined}
            />
            <Backdrop src={ep.thumbHD || ep.thumb || ''} fadeBottom={0.92} sharp />

            <div style={{
                position: 'absolute', inset: 0, padding: r.touch ? `0 ${r.pagePad + 4}px 36px` : '0 56px 100px',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'flex-end',
                textAlign: 'center'
            }}>
                <PlayBtn
                    size={108} onClick={startPlay}
                    progress={inProgress ? ep.watched : null}
                    watched={watched}
                    hoverText={hoverText}
                />

                <div style={{
                    marginTop: 28, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 8
                }}>
                    <div style={{
                        fontFamily: T.ui, fontSize: 11, letterSpacing: 4, textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.55)'
                    }}>
                        {show.title} · T{season.n} · E{String(ep.n).padStart(2, '0')}
                    </div>

                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                        alignItems: 'center', columnGap: 16, width: '100%'
                    }}>
                        <span aria-hidden='true' style={{
                            visibility: 'hidden', justifySelf: 'end',
                            display: 'inline-flex', fontSize: 'clamp(32px, 4vw, 58px)',
                            transform: 'translateY(0.15em)'
                        }}>
                            <MoreButton id={ep.jfId ?? 'spacer'} size={28} type='episode' />
                        </span>
                        <h1 style={{
                            fontFamily: T.display, fontSize: 'clamp(32px, 4vw, 58px)', lineHeight: 1.05,
                            margin: 0, fontWeight: 300, letterSpacing: -0.5,
                            textShadow: '0 2px 24px rgba(0,0,0,0.7)', textWrap: 'balance'
                        }}>
                            {ep.title}
                        </h1>
                        <span style={{
                            justifySelf: 'start',
                            display: 'inline-flex', fontSize: 'clamp(32px, 4vw, 58px)',
                            transform: 'translateY(0.15em)'
                        }}>
                            <MoreButton
                                id={ep.jfId ?? `${show.id}-s${season.n}-e${ep.n}`}
                                size={28} type='episode' itemTitle={ep.title}
                                queueSubtitle={`${show.title} · ${globalize.translate('ValueSeasonEpisode', season.n, ep.n)}`}
                                queuePoster={ep.thumb ?? show.poster}
                            />
                        </span>
                    </div>

                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        flexWrap: 'wrap', justifyContent: 'center',
                        fontFamily: T.ui, fontSize: 13, color: 'rgba(255,255,255,0.6)'
                    }}>
                        {ep.runtime != null && <><span>{ep.runtime} min</span><Ic.Dot /></>}
                        {ep.date && (
                            <>
                                <span>
                                    {formatDateLong(ep.date)}
                                </span>
                                <Ic.Dot />
                            </>
                        )}
                        {ep.video && <span>{ep.video}</span>}
                    </div>
                </div>
            </div>

            <ScrollHint label={globalize.translate('HeaderDetails')} />
        </section>
    );
}

function EpisodeDetail({
    show, season, ep, nextEp, navigate
}: {
    show: Show; season: Season; ep: Episode; nextEp?: Episode; navigate: Navigate;
}) {
    const r = useResponsive();
    return (
        <section style={{
            background: r.touch ? MC.bg : '#000', color: r.touch ? MC.fg : '#fff',
            padding: r.touch ? `24px ${r.pagePad}px 56px` : '32px 56px 96px', fontFamily: T.ui
        }}>
            {/* minmax(0,…): sin él los tracks 1fr valen minmax(auto,1fr) y su
                mínimo es el min-content del hijo (la fila de reparto, muy
                ancha) → la rejilla se desborda y en pantalla completa el
                sobrante se ve como una columna negra a la derecha. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 80 }}>
                <div>
                    <div style={{
                        fontSize: 10, letterSpacing: 4, textTransform: 'uppercase',
                        color: T.dim, marginBottom: 18
                    }}>
                        {globalize.translate('Overview')}
                    </div>
                    <p style={{
                        fontFamily: T.ui, fontSize: 17, lineHeight: 1.55, margin: 0,
                        color: 'rgba(255,255,255,0.82)', textWrap: 'pretty', fontWeight: 400
                    }}>
                        {`${show.title} — Temporada ${season.n}, episodio ${ep.n}: «${ep.title}». ${season.synopsis ?? ''}`}
                    </p>

                    <div style={{ marginTop: 56 }}>
                        <CastList cast={show.cast} navigate={navigate} label={globalize.translate('HeaderCastAndCrew')} />
                    </div>
                </div>

                <div>
                    <div style={{
                        fontSize: 10, letterSpacing: 4, textTransform: 'uppercase',
                        color: T.dim, marginBottom: 18
                    }}>
                        {globalize.translate('HeaderTechnicalInfo')}
                    </div>
                    <div style={{
                        display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: 14, fontSize: 13
                    }}>
                        {show.directors && (
                            <>
                                <span style={{ color: T.dim }}>{globalize.translate('Director')}</span>
                                <span>{show.directors}</span>
                            </>
                        )}
                        {show.creator && (
                            <>
                                <span style={{ color: T.dim }}>{globalize.translate('Writer')}</span>
                                <span>{show.creator}</span>
                            </>
                        )}
                        {ep.date && (
                            <>
                                <span style={{ color: T.dim }}>{globalize.translate('AirDate')}</span>
                                <span>
                                    {formatDateLong(ep.date)}
                                </span>
                            </>
                        )}
                        {ep.runtime != null && (
                            <>
                                <span style={{ color: T.dim }}>{globalize.translate('LabelRuntimeMinutes')}</span>
                                <span>{ep.runtime} min</span>
                            </>
                        )}
                        <span style={{ color: T.dim }}>{globalize.translate('Video')}</span>
                        <span>{ep.video ?? '—'}</span>
                        <span style={{ color: T.dim }}>{globalize.translate('Audio')}</span>
                        <span>{ep.audio ?? '—'}</span>
                        <span style={{ color: T.dim }}>{globalize.translate('Subtitles')}</span>
                        <span>{ep.subtitles ?? '—'}</span>
                        {ep.container && (
                            <>
                                <span style={{ color: T.dim }}>{globalize.translate('MediaInfoContainer')}</span>
                                <span>{ep.container.toUpperCase()}</span>
                            </>
                        )}
                        {show.studio && (
                            <>
                                <span style={{ color: T.dim }}>{globalize.translate('Studio')}</span>
                                <span>{show.studio}</span>
                            </>
                        )}
                    </div>

                    {nextEp && (
                        <div style={{ marginTop: 56 }}>
                            <div style={{
                                fontSize: 10, letterSpacing: 4, textTransform: 'uppercase',
                                color: T.dim, marginBottom: 18
                            }}>
                                {globalize.translate('Next')}
                            </div>
                            <div
                                onClick={() => navigate({
                                    page: 'episode', showId: show.id, seasonN: season.n, epN: nextEp.n
                                })}
                                style={{
                                    borderRadius: 6, overflow: 'hidden',
                                    border: `1px solid ${T.hairline}`, cursor: 'pointer'
                                }}
                                className='jfp-hoverlift'
                            >
                                <div style={{ aspectRatio: '16/9', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        backgroundImage: `url(${nextEp.thumbHD || nextEp.thumb || ''})`,
                                        backgroundSize: 'cover', backgroundPosition: 'center',
                                        filter: 'blur(12px)', transform: 'scale(1.25)'
                                    }} />
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent 50%)'
                                    }} />
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <NextEpPlay
                                            id={`${show.id}-s${season.n}-e${nextEp.n}`}
                                            dataWatched={nextEp.watched}
                                        />
                                    </div>
                                    <div
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                            position: 'absolute', right: 12, bottom: 10,
                                            display: 'flex', alignItems: 'center', gap: 6
                                        }}
                                    >
                                        <FavButton id={`${show.id}-s${season.n}-e${nextEp.n}`} size={15} />
                                        <WatchedButton
                                            id={`${show.id}-s${season.n}-e${nextEp.n}`}
                                            serverId={nextEp.jfId} size={15}
                                        />
                                    </div>
                                    <div style={{
                                        position: 'absolute', left: 16, bottom: 12,
                                        fontFamily: T.display, fontSize: 22, fontStyle: 'italic'
                                    }}>
                                        {String(nextEp.n).padStart(2, '0')} · {nextEp.title}
                                    </div>
                                </div>
                                <div style={{
                                    padding: '12px 16px', fontSize: 12, color: T.dim,
                                    display: 'flex', justifyContent: 'space-between'
                                }}>
                                    <span>{nextEp.runtime} min</span>
                                    <span>
                                        {nextEp.date
                      && formatDateLong(nextEp.date)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

// Play de la tarjeta "siguiente episodio": el estado visto sale del store
// local para que el tick de al lado lo actualice al instante.
function NextEpPlay({ id, dataWatched }: { id: string; dataWatched: number }) {
    const [local] = useWatched(id);
    return <PlayBtn size={52} watched={local || dataWatched >= 1} />;
}
