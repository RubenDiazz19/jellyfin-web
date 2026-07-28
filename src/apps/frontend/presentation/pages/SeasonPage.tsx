import globalize from 'lib/globalize';

import { useEffect } from 'react';
import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { PROTO_DATA, findSeason, type Show, type Season } from '../../domain/models';
import { showVM } from '../../domain/viewModels/ShowViewModel';
import { useVmSignals } from '../../domain/bridge/useViewModel';
import { Nav } from '../components/layout/Nav';
import { ScrollHint } from '../components/layout/ScrollHint';
import { PlayBtn } from '../components/controls/PlayBtn';
import { MoreButton } from '../components/controls/MoreButton';
import { usePlayer } from '../components/player/PlayerProvider';
import { EpCard } from '../components/cards/EpCard';
import { MC, useResponsive } from '../theme/responsive';
import type { Navigate } from '../../app/router';

type PageProps = { showId: string; seasonN: number; navigate: Navigate };

/** Diámetro del play del hero y hueco hasta el botón de opciones. */
const PLAY_SIZE = 104;
const MORE_GAP = 26;

export function SeasonPage({ showId, seasonN, navigate }: PageProps) {
    const proto = PROTO_DATA.shows[showId];
    useVmSignals(showVM, (vm) => [vm.show, vm.error]);
    useEffect(() => {
        if (!proto) void showVM.load(showId);
    }, [proto, showId]);
    const show = proto ?? showVM.showFor(showId);
    const season = show ? findSeason(show, seasonN) : null;
    if (!show || !season) {
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
        // Serie cargada pero temporada inexistente en la URL.
        return null;
    }
    return (
        <>
            <SeasonHero show={show} season={season} navigate={navigate} />
            <SeasonDetail show={show} season={season} navigate={navigate} />
        </>
    );
}

function SeasonHero({ show, season, navigate }: { show: Show; season: Season; navigate: Navigate }) {
    const r = useResponsive();
    const nextEp = season.episodes.find((e) => e.watched < 1) || season.episodes[0];
    const inProgress = nextEp && nextEp.watched > 0 && nextEp.watched < 1;
    const { play } = usePlayer();
    const startPlay = () => {
        if (!nextEp) return;
        if (nextEp.jfId) {
            play({
                itemId: nextEp.jfId,
                title: `${show.title} · T${season.n} E${String(nextEp.n).padStart(2, '0')} — ${nextEp.title ?? ''}`,
                startTicks: inProgress && nextEp.runtime ?
                    Math.round(nextEp.runtime * 60 * nextEp.watched * 10_000_000) :
                    undefined
            });
        } else {
            navigate({ page: 'episode', showId: show.id, seasonN: season.n, epN: nextEp.n });
        }
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
                    { label: `Temporada ${season.n}` }
                ]}
            />

            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url(${show.backdrop})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                filter: 'blur(8px) brightness(0.5)',
                zIndex: 0
            }} />

            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1 }} />

            <div style={{
                position: 'absolute', inset: 0, padding: r.touch ? `0 ${r.pagePad + 4}px 36px` : '0 48px 110px',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', zIndex: 2
            }}>
                <div style={{
                    fontFamily: T.ui, fontSize: 11, letterSpacing: 4, textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.7)', marginBottom: 18
                }}>
                    {show.title} · {season.year}
                </div>

                <div style={{
                    fontFamily: T.display, fontStyle: 'italic', fontSize: 36, fontWeight: 300,
                    color: 'rgba(255,255,255,0.72)', marginBottom: 6
                }}>
                    {globalize.translate('Season')}
                </div>
                <h1 style={{
                    fontFamily: T.display, fontSize: 'clamp(160px, 18vw, 260px)', lineHeight: 0.85,
                    margin: 0, fontWeight: 200, letterSpacing: -6,
                    textShadow: '0 6px 60px rgba(0,0,0,0.6)'
                }}>
                    {String(season.n).padStart(2, '0')}
                </h1>

                <div style={{
                    marginTop: 18, display: 'flex', alignItems: 'center', gap: 16,
                    flexWrap: 'wrap', justifyContent: 'center',
                    fontFamily: T.ui, fontSize: 13, color: 'rgba(255,255,255,0.78)'
                }}>
                    <span>{season.total} episodios</span><Ic.Dot />
                    <span>{season.watched}/{season.total} vistos</span><Ic.Dot />
                    <span>{season.year}</span>
                </div>

                <div style={{
                    marginTop: 36, position: 'relative',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <PlayBtn
                        size={PLAY_SIZE}
                        onClick={startPlay}
                        progress={inProgress ? nextEp.watched : null}
                        watched={season.watched >= season.total && season.total > 0}
                    />
                    {/* Opciones de la temporada (entre ellas editar su
                        carátula). Requiere el id real del server: en los
                        datos de prototipo no hay nada contra lo que editar.
                        Va posicionado en absoluto y NO como hermano en la
                        fila: como hermano, su ancho entra en el centrado y
                        empujaba el círculo del play a la izquierda del eje
                        que marcan el número de temporada y el resto del hero. */}
                    {season.jfId && (
                        <div style={{
                            position: 'absolute', top: '50%',
                            left: `calc(50% + ${PLAY_SIZE / 2 + MORE_GAP}px)`,
                            transform: 'translateY(-50%)',
                            display: 'flex', alignItems: 'center'
                        }}>
                            <MoreButton
                                id={season.jfId}
                                size={28}
                                type='season'
                                itemTitle={`${show.title} · ${globalize.translate('ValueSeason', season.n)}`}
                                nextEpisodeId={nextEp?.jfId}
                                queueSubtitle={nextEp?.title}
                                queuePoster={show.poster}
                            />
                        </div>
                    )}
                </div>
                <div style={{
                    marginTop: 22, fontFamily: T.ui, fontSize: 12, color: 'rgba(255,255,255,0.62)'
                }}>
                    {inProgress ?
                        `Reanudar E${nextEp.n} · ${nextEp.title}` :
                        season.watched >= season.total ?
                            'Volver a ver desde E01' :
                            `Continuar con E${nextEp?.n} · ${nextEp?.title}`}
                </div>
            </div>

            <ScrollHint label={globalize.translate('Episodes')} />
        </section>
    );
}

function SeasonDetail({ show, season, navigate }: { show: Show; season: Season; navigate: Navigate }) {
    const r = useResponsive();
    return (
        <section style={{
            background: r.touch ? MC.bg : '#000', color: r.touch ? MC.fg : '#fff',
            padding: r.touch ? `24px ${r.pagePad}px 56px` : '32px 56px 96px', fontFamily: T.ui
        }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 28 }}>
                <h3 style={{
                    fontFamily: T.display, fontStyle: 'italic', fontSize: 30, fontWeight: 300, margin: 0
                }}>
                    {globalize.translate('Episodes')}
                </h3>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    {show.seasons.map((s) => (
                        <button
                            key={s.n}
                            onClick={() => navigate({ page: 'season', showId: show.id, seasonN: s.n })}
                            style={{
                                padding: '8px 20px', border: 'none',
                                background: s.n === season.n ? 'rgba(255,255,255,0.12)' : 'transparent',
                                color: s.n === season.n ? '#fff' : T.dim,
                                borderRadius: 999, fontFamily: T.ui, fontSize: 13,
                                cursor: 'pointer', letterSpacing: 0.3,
                                transition: 'background .2s, color .2s'
                            }}
                        >
                            Temporada {s.n}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22, marginBottom: 80
            }}>
                {season.episodes.map((ep) => (
                    <EpCard key={ep.n} show={show} season={season} ep={ep} navigate={navigate} />
                ))}
            </div>

            <div style={{
                display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 64,
                paddingTop: 48, borderTop: `1px solid ${T.hairline}`
            }}>
                <div>
                    <div style={{
                        fontSize: 10, letterSpacing: 4, textTransform: 'uppercase',
                        color: T.dim, marginBottom: 18
                    }}>
                        Sinopsis de la temporada
                    </div>
                    <p style={{
                        fontFamily: T.ui, fontSize: 17, lineHeight: 1.55, margin: 0,
                        color: 'rgba(255,255,255,0.82)', textWrap: 'pretty', fontWeight: 400
                    }}>
                        {season.synopsis}
                    </p>
                </div>
                <div>
                    <div style={{
                        fontSize: 10, letterSpacing: 4, textTransform: 'uppercase',
                        color: T.dim, marginBottom: 18
                    }}>
                        {globalize.translate('HeaderDetails')}
                    </div>
                    <div style={{
                        display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 14, fontSize: 13
                    }}>
                        <span style={{ color: T.dim }}>{globalize.translate('Episodes')}</span><span>{season.total}</span>
                        <span style={{ color: T.dim }}>{globalize.translate('LabelYear')}</span><span>{season.year}</span>
                        <span style={{ color: T.dim }}>{globalize.translate('Watched')}</span>
                        <span>{season.watched} · {Math.round((season.watched / season.total) * 100)}%</span>
                        <span style={{ color: T.dim }}>{globalize.translate('Director')}</span><span>{show.directors}</span>
                        <span style={{ color: T.dim }}>{globalize.translate('Studio')}</span><span>{show.studio}</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
