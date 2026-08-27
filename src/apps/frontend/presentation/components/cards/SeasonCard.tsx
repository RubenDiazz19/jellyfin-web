import globalize from 'lib/globalize';

import React from 'react';
import { T } from '../../theme/tokens';
import { SeasonWatchedButton } from '../controls/SeasonWatchedButton';
import { FavButton } from '../controls/FavButton';
import { CardProgress } from './CardProgress';
import { CardOverlay } from './CardOverlay';
import { PosterFrame } from './PosterFrame';
import { useItemContextMenu } from '../controls/useItemContextMenu';
import type { Show, Season } from '../../../domain/models';
import type { Navigate } from '../../../app/router';
import { seasonKey } from '../../../domain/stores';

type Props = { show: Show; season: Season; navigate: Navigate };

export const SeasonCard = React.memo(function SeasonCardBase({ show, season, navigate }: Props) {
    const pct = season.total ? season.watched / season.total : 0;
    // Primer episodio no visto: lo mismo que calcula la ficha de temporada,
    // para que «Reproducir siguiente» del menú contextual arranque bien.
    const nextEp = season.episodes.find((e) => e.watched < 1) || season.episodes[0];
    const ctx = useItemContextMenu({
        id: season.jfId ?? seasonKey(show.id, season.n),
        type: 'season',
        itemTitle: `${show.title} · ${globalize.translate('ValueSeason', season.n)}`,
        nextEpisodeId: nextEp?.jfId,
        queueSubtitle: nextEp?.title,
        queuePoster: show.poster
    });
    return (
        <div
            onClick={() => navigate({ page: 'season', showId: show.id, seasonN: season.n })}
            onContextMenu={ctx.onContextMenu}
            style={{ cursor: 'pointer', width: 230, flex: '0 0 230px' }}
            className='jfp-hoverlift'
        >
            {/* Una temporada sin póster propio (el proveedor no siempre lo
                tiene) se queda con el de la serie: es lo que Jellyfin enseña
                en su sitio, y mejor eso que un rectángulo gris. */}
            <PosterFrame style={{
                backgroundImage: `url(${season.backdrop ?? show.poster})`,
                backgroundSize: 'cover', backgroundPosition: 'center'
            }}>
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 30%, transparent 55%, rgba(0,0,0,0.94) 100%)'
                }} />

                <CardOverlay
                    top={14}
                    left={14}
                    right={14}
                    topLeft={
                        <div style={{
                            fontFamily: T.ui, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.78)', fontWeight: 500
                        }}>
                            Temporada
                        </div>
                    }
                    topRight={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <SeasonWatchedButton show={show} season={season} size={15} />
                            <FavButton id={seasonKey(show.id, season.n)} size={15} />
                        </div>
                    }
                />

                <div style={{
                    position: 'absolute', left: 14, right: 14, bottom: 0, padding: '0 0 18px 0'
                }}>
                    <div style={{
                        fontFamily: T.display, fontStyle: 'italic', fontSize: 40, lineHeight: 0.9,
                        margin: 0, fontWeight: 300, letterSpacing: -0.5,
                        textShadow: '0 2px 16px rgba(0,0,0,0.5)',
                        color: 'rgba(255,255,255,0.92)'
                    }}>
                        {String(season.n).padStart(2, '0')}
                    </div>
                    <div style={{
                        marginTop: 6,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontFamily: T.ui, fontSize: 10, color: 'rgba(255,255,255,0.78)',
                        letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500
                    }}>
                        <span>{season.total} episodios</span>
                        <span>{season.year}</span>
                    </div>
                </div>

                <CardProgress value={pct} />
            </PosterFrame>
            {ctx.menu}
        </div>
    );
});

