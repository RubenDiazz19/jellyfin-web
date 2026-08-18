import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { findSeason, type Show, type Season } from '../../domain/models';
import { HeroFrame } from '../components/layout/DetailHero';
import {
    DetailBody, DetailColumns, DetailHeading, DetailRow, DetailStatus, DetailTable, SectionLabel
} from '../components/layout/DetailSections';
import { Nav } from '../components/layout/Nav';
import { ScrollHint } from '../components/layout/ScrollHint';
import { PlayBtn } from '../components/controls/PlayBtn';
import { MoreButton } from '../components/controls/MoreButton';
import { useItemContextMenu } from '../components/controls/useItemContextMenu';
import { usePlayer } from '../components/player/PlayerProvider';
import { EpCard } from '../components/cards/EpCard';
import { useResponsive, useShortViewport } from '../theme/responsive';
import type { Navigate } from '../../app/router';
import { ticksFromProgress } from '../../domain/player/format';
import { useLeaveWhen, useShowEntity } from './useDetailEntity';

type PageProps = { showId: string; seasonN: number; navigate: Navigate };

/** Diámetro del play del hero y hueco hasta el botón de opciones. */
const PLAY_SIZE = 94;
const MORE_GAP = 26;

export function SeasonPage({ showId, seasonN, navigate }: PageProps) {
    const { item: show, error } = useShowEntity(showId, navigate);
    const season = show ? findSeason(show, seasonN) : null;
    // La temporada ya no está en una serie que sí existe: la han borrado.
    useLeaveWhen(!!show && !season, { page: 'show', showId }, navigate);
    if (!show || !season) {
        if (error || !show) return <DetailStatus error={error} />;
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
    const nextEp = season.episodes.find((e) => e.watched < 1) || season.episodes[0];
    const inProgress = nextEp && nextEp.watched > 0 && nextEp.watched < 1;
    const r = useResponsive();
    const short = useShortViewport();
    const playSize = short ? 58 : r.touch ? 76 : PLAY_SIZE;
    const { play, prewarm } = usePlayer();
    const startPlay = () => {
        if (!nextEp) return;
        if (nextEp.jfId) {
            play({
                itemId: nextEp.jfId,
                title: `${show.title} · T${season.n} E${String(nextEp.n).padStart(2, '0')} — ${nextEp.title ?? ''}`,
                startTicks: inProgress ? ticksFromProgress(nextEp.runtime, nextEp.watched) : undefined
            });
        } else {
            navigate({ page: 'episode', showId: show.id, seasonN: season.n, epN: nextEp.n });
        }
    };
    // Menú contextual sobre el hero: el mismo que el MoreButton visible, pero
    // se invoca con clic derecho sin tocar el botón.
    const ctx = useItemContextMenu({
        id: season.jfId ?? `season-${show.id}-${season.n}`,
        type: 'season',
        itemTitle: `${show.title} · ${globalize.translate('ValueSeason', season.n)}`,
        nextEpisodeId: nextEp?.jfId,
        queueSubtitle: nextEp?.title,
        queuePoster: show.poster
    });
    return (
        <HeroFrame
            // La imagen es la de la serie, no la de la temporada: desenfocada
            // pasa a ser textura y el número gigante manda en la pantalla.
            blurred
            scrim={0}
            pos='Centro'
            pad='0 48px 110px'
            backdrop={show.backdrop || ''}
            onContextMenu={ctx.onContextMenu}
            nav={
                <Nav
                    navigate={navigate}
                    breadcrumb={[
                        { label: globalize.translate('Shows'), to: { page: 'home' } },
                        { label: show.title, to: { page: 'show', showId: show.id } },
                        { label: `Temporada ${season.n}` }
                    ]}
                />
            }
            footer={<ScrollHint label={globalize.translate('Episodes')} />}
        >
            <>
                <div style={{
                    fontFamily: T.ui, fontSize: 11, letterSpacing: r.touch ? 2.5 : 4,
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.7)', marginBottom: short ? 6 : 18,
                    maxWidth: '100%', overflow: 'hidden',
                    whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                }}>
                    {show.title} · {season.year}
                </div>

                <div style={{
                    fontFamily: T.display, fontStyle: 'italic',
                    fontSize: short ? 20 : r.touch ? 26 : 36, fontWeight: 300,
                    color: 'rgba(255,255,255,0.72)', marginBottom: 6
                }}>
                    {globalize.translate('Season')}
                </div>
                <h1 style={{
                    fontFamily: T.display,
                    // El número gigante es el protagonista, pero en táctil se
                    // mide contra el alto disponible: con `clamp(160px…)` no
                    // dejaba sitio ni al dato ni al botón.
                    fontSize: short ? 'clamp(58px, 18vh, 100px)' :
                        r.touch ? 'clamp(88px, 24vh, 172px)' : 'clamp(145px, 16vw, 235px)',
                    lineHeight: 0.85,
                    margin: 0, fontWeight: 200, letterSpacing: r.touch ? -3 : -6,
                    textShadow: '0 6px 60px rgba(0,0,0,0.6)'
                }}>
                    {String(season.n).padStart(2, '0')}
                </h1>

                <div style={{
                    marginTop: short ? 8 : r.touch ? 12 : 18,
                    display: 'flex', alignItems: 'center', gap: r.touch ? 10 : 16,
                    flexWrap: 'wrap', justifyContent: 'center',
                    fontFamily: T.ui, fontSize: r.touch ? 12 : 13, color: 'rgba(255,255,255,0.78)'
                }}>
                    <span>{season.total} episodios</span><Ic.Dot />
                    <span>{season.watched}/{season.total} vistos</span><Ic.Dot />
                    <span>{season.year}</span>
                </div>

                <div style={{
                    marginTop: short ? 14 : r.touch ? 22 : 36, position: 'relative',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <PlayBtn
                        size={playSize}
                        onClick={startPlay}
                        onHover={() => nextEp?.jfId && prewarm(nextEp.jfId)}
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
                            left: `calc(50% + ${playSize / 2 + (r.touch ? 18 : MORE_GAP)}px)`,
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
                    marginTop: short ? 10 : r.touch ? 16 : 22,
                    fontFamily: T.ui, fontSize: 12, color: 'rgba(255,255,255,0.62)',
                    maxWidth: '100%', overflow: 'hidden',
                    whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                }}>
                    {inProgress ?
                        `Reanudar E${nextEp.n} · ${nextEp.title}` :
                        season.watched >= season.total ?
                            'Volver a ver desde E01' :
                            `Continuar con E${nextEp?.n} · ${nextEp?.title}`}
                </div>
            </>
            {ctx.menu}
        </HeroFrame>
    );
}

function SeasonDetail({ show, season, navigate }: { show: Show; season: Season; navigate: Navigate }) {
    const r = useResponsive();
    return (
        <DetailBody>
            <DetailHeading title={globalize.translate('Episodes')} marginBottom={28}>
                <div style={{
                    marginLeft: 'auto', display: 'flex', gap: 4,
                    // Con muchas temporadas la fila se arrastra en vez de
                    // aplastar las píldoras.
                    maxWidth: '100%', overflowX: 'auto', scrollbarWidth: 'none'
                }}>
                    {show.seasons.map((s) => (
                        <button
                            key={s.n}
                            onClick={() => navigate({ page: 'season', showId: show.id, seasonN: s.n })}
                            style={{
                                flex: '0 0 auto',
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
            </DetailHeading>

            {/* En táctil los episodios van en carrusel, no en rejilla: cuatro
                columnas en un móvil dejan las carátulas del tamaño de un
                sello. Se arrastra de lado y cada tarjeta se ve. */}
            {r.touch ? (
                <div
                    style={{
                        display: 'flex', gap: r.gap, marginBottom: 40,
                        overflowX: 'auto', overflowY: 'hidden',
                        scrollSnapType: 'x mandatory',
                        // El respiro de abajo deja sitio a la sombra M3 de las
                        // tarjetas, que si no la recorta el scroll.
                        paddingBottom: 8,
                        scrollbarWidth: 'none'
                    }}
                >
                    {season.episodes.map((ep) => (
                        <div
                            key={ep.n}
                            style={{
                                flex: '0 0 auto',
                                width: r.mobile ? 232 : 296,
                                scrollSnapAlign: 'start'
                            }}
                        >
                            <EpCard show={show} season={season} ep={ep} navigate={navigate} />
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22, marginBottom: 80
                }}>
                    {season.episodes.map((ep) => (
                        <EpCard key={ep.n} show={show} season={season} ep={ep} navigate={navigate} />
                    ))}
                </div>
            )}

            <div style={{ paddingTop: r.touch ? 28 : 48, borderTop: `1px solid ${T.hairline}` }}>
                <DetailColumns>
                    <div>
                        <SectionLabel>Sinopsis de la temporada</SectionLabel>
                        <p style={{
                            fontFamily: T.ui, fontSize: r.touch ? 15 : 17, lineHeight: 1.55, margin: 0,
                            color: 'rgba(255,255,255,0.82)', textWrap: 'pretty', fontWeight: 400
                        }}>
                            {season.synopsis}
                        </p>
                    </div>
                    <div>
                        <SectionLabel>{globalize.translate('HeaderDetails')}</SectionLabel>
                        <DetailTable>
                            <DetailRow label={globalize.translate('Episodes')}>{season.total}</DetailRow>
                            <DetailRow label={globalize.translate('LabelYear')}>{season.year}</DetailRow>
                            <DetailRow label={globalize.translate('Watched')}>
                                {season.watched} · {Math.round((season.watched / season.total) * 100)}%
                            </DetailRow>
                            <DetailRow label={globalize.translate('Director')}>{show.directors}</DetailRow>
                            <DetailRow label={globalize.translate('Studio')}>{show.studio}</DetailRow>
                        </DetailTable>
                    </div>
                </DetailColumns>
            </div>
        </DetailBody>
    );
}
