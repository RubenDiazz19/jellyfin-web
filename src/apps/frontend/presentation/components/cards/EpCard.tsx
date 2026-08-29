import React from 'react';
import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';
import { useWatched } from '../../../domain/bridge/useWatched';
import { FavButton } from '../controls/FavButton';
import { CardProgress } from './CardProgress';
import { CardOverlay } from './CardOverlay';
import { useItemContextMenu } from '../controls/useItemContextMenu';
import type { Show, Season, Episode } from '../../../domain/models';
import type { Navigate } from '../../../app/router';
import { episodeKey } from '../../../domain/stores';

type Props = { show: Show; season: Season; ep: Episode; navigate: Navigate };

// Tarjeta de episodio. La preview solo se ve nítida si el episodio está
// visto o en progreso; en otro caso se desenfoca para preservar spoilers.
export const EpCard = React.memo(function EpCardBase({ show, season, ep, navigate }: Props) {
    const [liveW] = useWatched(episodeKey(show.id, season.n, ep.n));
    const watched = ep.watched >= 1 || liveW;
    const inProgress = !watched && ep.watched > 0 && ep.watched < 1;
    const revealed = watched || inProgress;
    const ctx = useItemContextMenu({
        id: ep.jfId ?? episodeKey(show.id, season.n, ep.n),
        type: 'episode',
        itemTitle: ep.title ?? `${show.title} · E${ep.n}`,
        queueSubtitle: `${show.title} · T${season.n} E${String(ep.n).padStart(2, '0')}`,
        queuePoster: ep.thumb ?? show.poster
    });
    return (
        <div
            onClick={() => navigate({ page: 'episode', showId: show.id, seasonN: season.n, epN: ep.n })}
            onContextMenu={ctx.onContextMenu}
            style={{ position: 'relative', cursor: 'pointer' }}
            className='jfp-hoverlift'
        >
            <div className='jfp-card-m3' style={{
                aspectRatio: '16/9', borderRadius: 4, overflow: 'hidden', position: 'relative',
                background: '#0b0b0b',
                outline: ep.current ? '1px solid rgba(255,255,255,0.95)' : 'none',
                outlineOffset: ep.current ? 2 : 0
            }}>
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: `url(${ep.thumb})`, backgroundSize: 'cover', backgroundPosition: 'center',
                    filter: revealed ? 'none' : 'blur(12px)',
                    transform: revealed ? 'none' : 'scale(1.25)',
                    transition: 'filter .4s, transform .4s'
                }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.9))' }} />

                <CardOverlay
                    top={8}
                    right={8}
                    topLeft={
                        <div style={{
                            fontFamily: T.display, fontSize: 30, lineHeight: 1,
                            textShadow: '0 2px 14px rgba(0,0,0,0.6)',
                            marginTop: 2, marginLeft: 4
                        }}>
                            {String(ep.n).padStart(2, '0')}
                        </div>
                    }
                    topRight={<FavButton id={episodeKey(show.id, season.n, ep.n)} size={15} />}
                />

                {watched && (
                    <div style={{
                        position: 'absolute', bottom: 8, right: 8,
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.95)', color: '#000',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Ic.Check size={12} />
                    </div>
                )}

                {inProgress && (
                    <CardProgress value={ep.watched} />
                )}
            </div>
            {ctx.menu}
        </div>
    );
});

