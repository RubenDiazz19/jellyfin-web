import { memo } from 'react';
import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';
import { WatchedButton } from '../controls/WatchedButton';
import { FavButton } from '../controls/FavButton';
import { PlayBtn } from '../controls/PlayBtn';
import { SelectionMark } from './SelectionMark';
import { useResponsive } from '../../theme/responsive';
import type { Navigate } from '../../../app/router';
import type { CarouselSlide } from '../../../domain/models';
import { episodeKey } from '../../../domain/stores';
import { useCardInteractions } from './useCardInteractions';
import { LandscapeCardShell } from './LandscapeCardShell';

type Props = { slide: CarouselSlide; navigate: Navigate };

// Tarjeta de "continuar viendo" (apaisada, con miniatura del episodio).
export const CwCard = memo(function CwCardBase({ slide, navigate }: Props) {
    const r = useResponsive();
    // Apaisada 16:9 aprox — 380x214 en desktop; compacta en touch.
    const w = r.touch ? (r.mobile ? 250 : 300) : 380;
    const h = Math.round(w * 214 / 380);
    const epId = slide.jfEpisodeId ?? slide.id;
    const wKey = slide.season != null && slide.episode != null ?
        episodeKey(slide.id, slide.season as number, slide.episode as number) : slide.id;

    const interactions = useCardInteractions({
        id: epId,
        title: slide.title,
        kind: slide.jfEpisodeId ? 'episode' : 'show',
        poster: slide.poster ?? slide.backdrop,
        year: slide.year,
        watchedKey: wKey,
        queueSubtitle: slide.season != null && slide.episode != null ?
            `T${slide.season} E${String(slide.episode).padStart(2, '0')}` :
            String(slide.year),
        queuePoster: slide.poster,
        onOpen: () => navigate({ page: 'show', showId: slide.id })
    }, navigate);

    return (
        <LandscapeCardShell
            width={w}
            flex={`0 0 ${w}px`}
            height={h}
            cover={slide.backdrop}
            selected={interactions.selected}
            onClick={interactions.onClick}
            onContextMenu={interactions.onContextMenu}
            contextMenu={interactions.contextMenu}
            progress={slide.progress ?? 0}
            topLeft={
                interactions.selecting ? (
                    <SelectionMark selected={interactions.selected} />
                ) : (
                    <WatchedButton
                        id={wKey}
                        serverId={slide.jfEpisodeId}
                        size={16}
                        badge
                    />
                )
            }
            topRight={interactions.selecting ? null : <FavButton id={slide.id} size={16} />}
            centerOverlay={!interactions.selecting ? (
                <div
                    style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    className='jfp-playover'
                >
                    <PlayBtn
                        size={56}
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate({
                                page: 'episode',
                                showId: slide.id,
                                seasonN: slide.season as number,
                                epN: slide.episode as number
                            });
                        }}
                    />
                </div>
            ) : null}
            footer={
                <div style={{ marginTop: 14 }}>
                    <div style={{ fontFamily: T.ui, fontSize: 22, lineHeight: 1.1 }}>{slide.title}</div>
                    <div style={{
                        marginTop: 4, fontFamily: T.ui, fontSize: 12, color: T.dim,
                        display: 'flex', gap: 8, alignItems: 'center'
                    }}>
                        <span>T{slide.season} · E{slide.episode}</span>
                        <Ic.Dot />
                        <span>{slide.remaining}</span>
                    </div>
                </div>
            }
        />
    );
});

