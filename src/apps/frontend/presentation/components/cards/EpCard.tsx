import { memo } from 'react';
import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';
import { useWatched } from '../../../domain/bridge/useWatched';
import { FavButton } from '../controls/FavButton';
import { SelectionMark } from './SelectionMark';
import type { Show, Season, Episode } from '../../../domain/models';
import type { Navigate } from '../../../app/router';
import { episodeKey } from '../../../domain/stores';
import { useCardInteractions } from './useCardInteractions';
import { LandscapeCardShell } from './LandscapeCardShell';

type Props = { show: Show; season: Season; ep: Episode; navigate: Navigate };

// Tarjeta de episodio. La preview solo se ve nítida si el episodio está
// visto o en progreso; en otro caso se desenfoca para preservar spoilers.
export const EpCard = memo(function EpCardBase({ show, season, ep, navigate }: Props) {
    const [liveW] = useWatched(episodeKey(show.id, season.n, ep.n));
    const watched = ep.watched >= 1 || liveW;
    const inProgress = !watched && ep.watched > 0 && ep.watched < 1;
    const revealed = watched || inProgress;
    const epId = ep.jfId ?? episodeKey(show.id, season.n, ep.n);
    const wKey = episodeKey(show.id, season.n, ep.n);

    const interactions = useCardInteractions({
        id: epId,
        title: ep.title ?? `${show.title} · E${ep.n}`,
        kind: 'episode',
        poster: ep.thumb ?? show.poster,
        watchedKey: wKey,
        showId: show.id,
        seasonN: season.n,
        epN: ep.n,
        queueSubtitle: `${show.title} · T${season.n} E${String(ep.n).padStart(2, '0')}`,
        queuePoster: ep.thumb ?? show.poster
    }, navigate);

    return (
        <LandscapeCardShell
            cover={ep.thumb}
            coverFilter={revealed ? 'none' : 'blur(12px)'}
            coverTransform={revealed ? 'none' : 'scale(1.25)'}
            selected={interactions.selected}
            outline={interactions.selected ? '3px solid #fff' : ep.current ? '1px solid rgba(255,255,255,0.95)' : 'none'}
            outlineOffset={interactions.selected ? -3 : ep.current ? 2 : 0}
            gradient='linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.9))'
            onClick={interactions.onClick}
            onContextMenu={interactions.onContextMenu}
            contextMenu={interactions.contextMenu}
            progress={inProgress ? ep.watched : 0}
            topLeft={
                interactions.selecting ? (
                    <SelectionMark selected={interactions.selected} />
                ) : (
                    <div style={{
                        fontFamily: T.ui, fontSize: 30, lineHeight: 1,
                        textShadow: '0 2px 14px rgba(0,0,0,0.6)',
                        marginTop: 2, marginLeft: 4
                    }}>
                        {String(ep.n).padStart(2, '0')}
                    </div>
                )
            }
            topRight={interactions.selecting ? null : <FavButton id={wKey} size={15} />}
            bottomOverlay={watched ? (
                <div style={{
                    position: 'absolute', bottom: 8, right: 8,
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.95)', color: '#000',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <Ic.Check size={12} />
                </div>
            ) : null}
        />
    );
});

