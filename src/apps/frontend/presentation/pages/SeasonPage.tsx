import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { findSeason, type Show, type Season } from '../../domain/models';
import { HeroFrame } from '../components/layout/DetailHero';
import {
    DetailBody, DetailHeading, DetailRow, DetailStatus, DetailTable, SectionLabel
} from '../components/layout/DetailSections';
import { Nav } from '../components/layout/Nav';
import { ScrollHint } from '../components/layout/ScrollHint';
import { PlayBtn } from '../components/controls/PlayBtn';
import { MoreButton } from '../components/controls/MoreButton';
import { usePlayer } from '../components/player/PlayerProvider';
import { EpCard } from '../components/cards/EpCard';
import type { Navigate } from '../../app/router';
import { ticksFromProgress } from '../../domain/player/format';
import { useLeaveWhen, useShowEntity } from './useDetailEntity';

type PageProps = { showId: string; seasonN: number; navigate: Navigate };

/** Diámetro del play del hero y hueco hasta el botón de opciones. */
const PLAY_SIZE = 104;
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
    const { play } = usePlayer();
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
    return (
        <HeroFrame
            // La imagen es la de la serie, no la de la temporada: desenfocada
            // pasa a ser textura y el número gigante manda en la pantalla.
            blurred
            scrim={0}
            pos='Centro'
            pad='0 48px 110px'
            backdrop={show.backdrop || ''}
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
            </>
        </HeroFrame>
    );
}

function SeasonDetail({ show, season, navigate }: { show: Show; season: Season; navigate: Navigate }) {
    return (
        <DetailBody>
            <DetailHeading title={globalize.translate('Episodes')} marginBottom={28}>
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
            </DetailHeading>

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
                    <SectionLabel>Sinopsis de la temporada</SectionLabel>
                    <p style={{
                        fontFamily: T.ui, fontSize: 17, lineHeight: 1.55, margin: 0,
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
            </div>
        </DetailBody>
    );
}
