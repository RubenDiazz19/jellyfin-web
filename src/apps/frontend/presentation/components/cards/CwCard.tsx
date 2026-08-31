import { memo } from 'react';
import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';
import { WatchedButton } from '../controls/WatchedButton';
import { FavButton } from '../controls/FavButton';
import { PlayBtn } from '../controls/PlayBtn';
import { CardProgress } from './CardProgress';
import { CardOverlay } from './CardOverlay';
import { useItemContextMenu } from '../controls/useItemContextMenu';
import { useResponsive } from '../../theme/responsive';
import type { Navigate } from '../../../app/router';
import type { CarouselSlide } from '../../../domain/models';
import { episodeKey } from '../../../domain/stores';

type Props = { slide: CarouselSlide; navigate: Navigate };

// Tarjeta de "continuar viendo" (apaisada, con miniatura del episodio).
export const CwCard = memo(function CwCardBase({ slide, navigate }: Props) {
    const r = useResponsive();
    // Apaisada 16:9 aprox — 380x214 en desktop; compacta en touch.
    const w = r.touch ? (r.mobile ? 250 : 300) : 380;
    const h = Math.round(w * 214 / 380);
    const ctx = useItemContextMenu({
        // Con id real del servidor el menú sabe reproducir/descargar/etc.; sin
        // él (modo prototipo) cae al menú legado, que no hace daño.
        id: slide.jfEpisodeId ?? slide.id,
        type: slide.jfEpisodeId ? 'episode' : 'show',
        itemTitle: slide.title,
        queueSubtitle: slide.season != null && slide.episode != null ?
            `T${slide.season} E${String(slide.episode).padStart(2, '0')}` :
            String(slide.year),
        queuePoster: slide.poster
    });
    return (
        <div
            onClick={() => navigate({ page: 'show', showId: slide.id })}
            onContextMenu={ctx.onContextMenu}
            style={{ width: w, flex: `0 0 ${w}px`, cursor: 'pointer' }}
            className='jfp-hoverlift'
        >
            <div
                className='jfp-card-m3'
                style={{
                    height: h, borderRadius: 4, overflow: 'hidden', position: 'relative',
                    backgroundImage: `url(${slide.backdrop})`, backgroundSize: 'cover', backgroundPosition: 'center'
                }}
            >
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent 55%)' }} />
                <CardOverlay
                    topLeft={
                        <WatchedButton
                            id={episodeKey(slide.id, slide.season as number, slide.episode as number)}
                            serverId={slide.jfEpisodeId}
                            size={16} badge
                        />
                    }
                    topRight={<FavButton id={slide.id} size={16} />}
                />
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
                <CardProgress value={slide.progress ?? 0} />
            </div>
            <div style={{ marginTop: 14 }}>

                <div style={{ fontFamily: T.display, fontSize: 22, lineHeight: 1.1 }}>{slide.title}</div>
                <div style={{
                    marginTop: 4, fontFamily: T.ui, fontSize: 12, color: T.dim,
                    display: 'flex', gap: 8, alignItems: 'center'
                }}>
                    <span>T{slide.season} · E{slide.episode}</span>
                    <Ic.Dot />
                    <span>{slide.remaining}</span>
                </div>
            </div>
            {ctx.menu}
        </div>
    );
});
