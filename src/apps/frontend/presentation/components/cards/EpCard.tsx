import React from 'react';
import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';
import { useWatched } from '../../../domain/bridge/useWatched';
import { FavButton } from '../controls/FavButton';
import { Progress } from '../controls/Progress';
import type { Show, Season, Episode } from '../../../domain/models';
import type { Navigate } from '../../../app/router';

type Props = { show: Show; season: Season; ep: Episode; navigate: Navigate };

// Tarjeta de episodio. La preview solo se ve nítida si el episodio está
// visto o en progreso; en otro caso se desenfoca para preservar spoilers.
export const EpCard = React.memo(function EpCardBase({ show, season, ep, navigate }: Props) {
    const [liveW] = useWatched(`${show.id}-s${season.n}-e${ep.n}`);
    const watched = ep.watched >= 1 || liveW;
    const inProgress = !watched && ep.watched > 0 && ep.watched < 1;
    const revealed = watched || inProgress;
    return (
        <div
            onClick={() => navigate({ page: 'episode', showId: show.id, seasonN: season.n, epN: ep.n })}
            style={{ position: 'relative', cursor: 'pointer' }}
            className='jfp-hoverlift'
        >
            <div style={{
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

                <div style={{
                    position: 'absolute', top: 10, left: 12,
                    fontFamily: T.display, fontSize: 30, lineHeight: 1, fontStyle: 'italic',
                    textShadow: '0 2px 14px rgba(0,0,0,0.6)'
                }}>
                    {String(ep.n).padStart(2, '0')}
                </div>

                <div style={{ position: 'absolute', top: 8, right: 8 }}>
                    <FavButton id={`${show.id}-s${season.n}-e${ep.n}`} size={15} />
                </div>

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
                    <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8 }}>
                        <Progress value={ep.watched} height={2} />
                    </div>
                )}
            </div>
        </div>
    );
});
