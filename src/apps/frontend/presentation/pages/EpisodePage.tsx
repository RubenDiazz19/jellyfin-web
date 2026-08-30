import globalize from 'lib/globalize';

import { T } from '../theme/tokens';
import { formatDateLong, formatRemainingCompact } from '../theme/format';
import { findSeason, type Show, type Season, type Episode } from '../../domain/models';
import { useWatched } from '../../domain/bridge/useWatched';
import { HeroFrame, HeroMeta } from '../components/layout/DetailHero';
import {
    DetailBody, DetailColumns, DetailRow, DetailStatus, DetailTable, SectionLabel
} from '../components/layout/DetailSections';
import { Nav } from '../components/layout/Nav';
import { ScrollHint } from '../components/layout/ScrollHint';
import { PlayBtn } from '../components/controls/PlayBtn';
import { usePlayer } from '../components/player/PlayerProvider';
import { MoreButton } from '../components/controls/MoreButton';
import { useItemContextMenu } from '../components/controls/useItemContextMenu';
import { FavButton } from '../components/controls/FavButton';
import { WatchedButton } from '../components/controls/WatchedButton';
import { CastList } from '../components/cast/CastList';
import { useResponsive, useShortViewport } from '../theme/responsive';
import type { Navigate } from '../../app/router';
import { episodeKey } from '../../domain/stores';
import { ticksFromProgress } from '../../domain/player/format';
import { useLeaveWhen, useShowEntity } from './useDetailEntity';

type PageProps = { showId: string; seasonN: number; epN: number; navigate: Navigate };

export function EpisodePage({ showId, seasonN, epN, navigate }: PageProps) {
    const { item: show, error } = useShowEntity(showId, navigate);
    const season = show ? findSeason(show, seasonN) : null;
    const ep = season ? season.episodes.find((e) => e.n === epN) : null;
    // El episodio ya no está en una serie que sí existe: lo han borrado. Si lo
    // que falta es la temporada entera, se sube un nivel más.
    useLeaveWhen(!!show && !ep, season ?
        { page: 'season', showId, seasonN } :
        { page: 'show', showId }, navigate);
    if (!show || !season || !ep) {
        if (error || !show) return <DetailStatus error={error} />;
        // Serie cargada pero temporada/episodio inexistentes en la URL.
        return null;
    }
    const nextEp = season.episodes.find((e) => e.n === epN + 1);
    return (
        <div style={{ position: 'relative', width: '100%', minHeight: '100vh', background: '#000' }}>
            <EpisodeHero show={show} season={season} ep={ep} navigate={navigate} />
            <EpisodeDetail show={show} season={season} ep={ep} nextEp={nextEp} navigate={navigate} />
        </div>
    );
}

function EpisodeHero({
    show, season, ep, navigate
}: {
    show: Show; season: Season; ep: Episode; navigate: Navigate;
}) {
    const { play, prewarm } = usePlayer();
    const r = useResponsive();
    const short = useShortViewport();
    // El tick del Nav escribe en el store local; leerlo aquí mantiene el play
    // en sincronía al instante (sin esperar a que se recargue la serie).
    const [localWatched] = useWatched(episodeKey(show.id, season.n, ep.n));
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
            startTicks: ep.watched < 1 ? ticksFromProgress(ep.runtime, ep.watched) : undefined
        });
    };
    // Menú contextual sobre el hero: el mismo que el MoreButton visible, pero
    // se invoca con clic derecho sin tocar el botón.
    const ctx = useItemContextMenu({
        id: ep.jfId ?? episodeKey(show.id, season.n, ep.n),
        type: 'episode',
        itemTitle: ep.title ?? `${show.title} · E${ep.n}`,
        queueSubtitle: `${show.title} · T${season.n} E${String(ep.n).padStart(2, '0')}`,
        queuePoster: ep.thumb ?? show.poster
    });
    return (
        <HeroFrame
            // El fondo es el fotograma del propio episodio: nítido y sin
            // degradado extra, que el texto ya va sobre la parte de abajo.
            scrim={0}
            pos='Inferior'
            pad='0 56px 100px'
            backdrop={ep.thumbHD || ep.thumb || ''}
            onContextMenu={ctx.onContextMenu}
            nav={
                <Nav
                    navigate={navigate}
                    breadcrumb={[
                        { label: globalize.translate('Shows'), to: { page: 'home' } },
                        { label: show.title, to: { page: 'show', showId: show.id } },
                        { label: `Temporada ${season.n}`, to: { page: 'season', showId: show.id, seasonN: season.n } },
                        { label: `Episodio ${ep.n}` }
                    ]}
                    actionId={episodeKey(show.id, season.n, ep.n)}
                    actionData={ep.jfId ? { type: 'episode', id: ep.jfId } : undefined}
                />
            }
            footer={<ScrollHint label={globalize.translate('HeaderDetails')} />}
        >
            <>
                <PlayBtn
                    size={short ? 58 : r.touch ? 76 : 96}
                    onClick={startPlay}
                    onHover={() => ep.jfId && prewarm(ep.jfId)}
                    progress={inProgress ? ep.watched : null}
                    watched={watched}
                    hoverText={hoverText}
                />

                <div style={{
                    marginTop: short ? 12 : r.touch ? 18 : 28,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: short ? 4 : 8,
                    maxWidth: '100%'
                }}>
                    <div style={{
                        fontFamily: T.ui, fontSize: r.touch ? 10 : 11,
                        letterSpacing: r.touch ? 2.5 : 4, textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.55)',
                        maxWidth: '100%', overflow: 'hidden',
                        whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                    }}>
                        {show.title} · T{season.n} · E{String(ep.n).padStart(2, '0')}
                    </div>

                    <div style={{
                        display: 'grid',
                        // El hueco simétrico del menú solo se reserva donde hay
                        // sitio: en móvil se lo comía todo el título.
                        gridTemplateColumns: r.touch ? 'minmax(0, 1fr) auto' : '1fr auto 1fr',
                        alignItems: 'center', columnGap: r.touch ? 8 : 16, width: '100%'
                    }}>
                        {!r.touch && (
                            <span aria-hidden='true' style={{
                                visibility: 'hidden', justifySelf: 'end',
                                display: 'inline-flex', fontSize: 'clamp(29px, 3.6vw, 52px)',
                                transform: 'translateY(0.15em)'
                            }}>
                                <MoreButton id={ep.jfId ?? 'spacer'} size={28} type='episode' />
                            </span>
                        )}
                        <h1 style={{
                            fontFamily: T.display,
                            fontSize: short ? 'clamp(20px, 5vh, 30px)' :
                                r.touch ? 'clamp(24px, 6vw, 38px)' : 'clamp(29px, 3.6vw, 52px)',
                            lineHeight: 1.05,
                            margin: 0, fontWeight: 300, letterSpacing: -0.5,
                            textShadow: '0 2px 24px rgba(0,0,0,0.7)', textWrap: 'balance',
                            minWidth: 0,
                            // Un título largo no puede empujar al resto fuera
                            // del hero: como mucho, dos líneas.
                            overflow: 'hidden', display: '-webkit-box',
                            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                        }}>
                            {ep.title}
                        </h1>
                        <span style={{
                            justifySelf: 'start',
                            display: 'inline-flex', fontSize: 'clamp(29px, 3.6vw, 52px)',
                            transform: 'translateY(0.15em)'
                        }}>
                            <MoreButton
                                id={ep.jfId ?? episodeKey(show.id, season.n, ep.n)}
                                size={28} type='episode' itemTitle={ep.title}
                                queueSubtitle={`${show.title} · ${globalize.translate('ValueSeasonEpisode', season.n, ep.n)}`}
                                queuePoster={ep.thumb ?? show.poster}
                            />
                        </span>
                    </div>

                    <HeroMeta
                        items={[
                            ep.runtime != null ? `${ep.runtime} min` : null,
                            ep.date ? formatDateLong(ep.date) : null,
                            ep.video
                        ]}
                        badges={ep.mediaBadges}
                        badgeSize='sm'
                        align='center'
                        color='rgba(255,255,255,0.6)'
                        marginTop={short ? 8 : 12}
                    />
                </div>
            </>
            {ctx.menu}
        </HeroFrame>
    );
}

function EpisodeDetail({
    show, season, ep, nextEp, navigate
}: {
    show: Show; season: Season; ep: Episode; nextEp?: Episode; navigate: Navigate;
}) {
    return (
        <DetailBody>
            {/* Una sola columna en táctil: dos columnas en un móvil dejaban
                los datos técnicos en una franja de ~100px con los valores
                partidos en cuatro líneas o cortados.
                minmax(0,…): sin él los tracks 1fr valen minmax(auto,1fr) y su
                mínimo es el min-content del hijo (la fila de reparto, muy
                ancha) → la rejilla se desborda y en pantalla completa el
                sobrante se ve como una columna negra a la derecha. */}
            <DetailColumns>
                <div>
                    <SectionLabel>{globalize.translate('Overview')}</SectionLabel>
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
                    <SectionLabel>{globalize.translate('HeaderTechnicalInfo')}</SectionLabel>
                    <DetailTable>
                        {(ep.director || show.directors) && (
                            <DetailRow label={globalize.translate('Director')}>
                                {ep.director || show.directors}
                            </DetailRow>
                        )}
                        {(ep.writer || show.creator) && (
                            <DetailRow label={globalize.translate('Writer')}>
                                {ep.writer || show.creator}
                            </DetailRow>
                        )}
                        {ep.date && (
                            <DetailRow label={globalize.translate('AirDate')}>
                                {formatDateLong(ep.date)}
                            </DetailRow>
                        )}
                        {ep.runtime != null && (
                            <DetailRow label={globalize.translate('LabelRuntimeMinutes')}>
                                {ep.runtime} min
                            </DetailRow>
                        )}
                        <DetailRow label={globalize.translate('Video')}>{ep.video ?? '—'}</DetailRow>
                        <DetailRow label={globalize.translate('Audio')}>{ep.audio ?? '—'}</DetailRow>
                        <DetailRow label={globalize.translate('Subtitles')}>{ep.subtitles ?? '—'}</DetailRow>
                        {ep.container && (
                            <DetailRow label={globalize.translate('MediaInfoContainer')}>
                                {ep.container.toUpperCase()}
                            </DetailRow>
                        )}
                        {show.studio && (
                            <DetailRow label={globalize.translate('Studio')}>{show.studio}</DetailRow>
                        )}
                    </DetailTable>

                    {nextEp && (
                        <div style={{ marginTop: 56 }}>
                            <SectionLabel>{globalize.translate('Next')}</SectionLabel>
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
                                            id={episodeKey(show.id, season.n, nextEp.n)}
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
                                        <FavButton id={episodeKey(show.id, season.n, nextEp.n)} size={15} />
                                        <WatchedButton
                                            id={episodeKey(show.id, season.n, nextEp.n)}
                                            serverId={nextEp.jfId} size={15}
                                        />
                                    </div>
                                    <div style={{
                                        position: 'absolute', left: 16, bottom: 12,
                                        fontFamily: T.display, fontSize: 22
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
            </DetailColumns>
        </DetailBody>
    );
}

// Play de la tarjeta "siguiente episodio": el estado visto sale del store
// local para que el tick de al lado lo actualice al instante.
function NextEpPlay({ id, dataWatched }: { id: string; dataWatched: number }) {
    const [local] = useWatched(id);
    return <PlayBtn size={52} watched={local || dataWatched >= 1} />;
}
