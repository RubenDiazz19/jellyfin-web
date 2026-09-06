import { memo, useRef, useState, useLayoutEffect, useCallback, type CSSProperties } from 'react';
import { T } from '../../theme/tokens';
import { WatchedButton } from '../controls/WatchedButton';
import { FavButton } from '../controls/FavButton';
import { PlayBtn } from '../controls/PlayBtn';
import { useResponsive } from '../../theme/responsive';
import type { Navigate } from '../../../app/router';
import type { CarouselSlide } from '../../../domain/models';
import { episodeKey } from '../../../domain/stores';
import { useCardInteractions } from './useCardInteractions';
import { POSTER_W, PosterShell } from './PosterShell';
import { formatEndTime } from '../../utils/format';
import { usePlayer } from '../player/PlayerProvider';

type Props = { slide: CarouselSlide; navigate: Navigate };

// Tarjeta vertical 2:3 de "continuar viendo", unificada con el formato de póster estándar.
export const CwCard = memo(function CwCardBase({ slide, navigate }: Props) {
    const r = useResponsive();
    const { play, prewarm } = usePlayer();
    const w = r.touch ? r.cardW : POSTER_W;
    const epId = slide.jfEpisodeId ?? slide.id;
    const wKey = slide.season != null && slide.episode != null ?
        episodeKey(slide.id, slide.season as number, slide.episode as number) : slide.id;

    const onPlay = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        const epTitle = slide.season != null && slide.episode != null ?
            `${slide.title} · T${slide.season} E${String(slide.episode).padStart(2, '0')} — ${slide.episodeTitle}` :
            slide.title;
        play({
            itemId: slide.jfEpisodeId ?? slide.id,
            title: epTitle,
            startTicks: slide.positionTicks
        });
    }, [slide, play]);

    const onOpenDetails = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (slide.kind === 'movie') {
            navigate({ page: 'movie', movieId: slide.id });
        } else {
            navigate({ page: 'show', showId: slide.id });
        }
    }, [slide, navigate]);

    const onOpenEpisode = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (slide.season != null && slide.episode != null) {
            navigate({
                page: 'episode',
                showId: slide.id,
                seasonN: slide.season as number,
                epN: slide.episode as number
            });
        } else {
            navigate({ page: 'movie', movieId: slide.id });
        }
    }, [slide, navigate]);

    const card = useCardInteractions({
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
        onOpen: onPlay
    }, navigate);

    const endTime = formatEndTime(slide.remaining);

    // Formato minimalista: "TX · EY · Nombre del episodio"
    const epParts: string[] = [];
    if (slide.season != null) epParts.push(`T${slide.season}`);
    if (slide.episode != null) epParts.push(`E${slide.episode}`);
    if (slide.episodeTitle) epParts.push(slide.episodeTitle);
    const epSubtitle = epParts.length > 0 ? epParts.join(' · ') : (slide.year ? `${slide.year} · Película` : slide.title);

    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [overflowPx, setOverflowPx] = useState(0);

    // Si el texto excede el ancho de la tarjeta en móvil, calcula los píxeles de desbordamiento
    useLayoutEffect(() => {
        if (!r.touch) return;
        let active = true;

        const measure = () => {
            if (!active) return;
            const cont = containerRef.current;
            const text = textRef.current;
            if (!cont || !text) return;
            const diff = text.scrollWidth - cont.clientWidth;
            setOverflowPx(diff > 3 ? Math.ceil(diff) : 0);
        };

        measure();

        if (typeof document !== 'undefined' && document.fonts?.ready) {
            document.fonts.ready.then(() => {
                if (active) measure();
            }).catch(() => {});
        }

        return () => {
            active = false;
        };
    }, [r.touch, epSubtitle, w]);

    return (
        <PosterShell
            {...card}
            cover={slide.poster || slide.backdrop}
            width={w}
            watchedButton={
                <WatchedButton
                    id={wKey}
                    serverId={slide.jfEpisodeId}
                    size={16}
                    badge
                />
            }
            favButton={<FavButton id={slide.id} size={16} />}
            logo={slide.logo}
            title={slide.title}
            progress={slide.progress ?? 0}
            onLogoClick={onOpenDetails}
            centerOverlay={!card.selecting ? (
                <div
                    style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    className='jfp-playover'
                >
                    <PlayBtn
                        size={52}
                        onClick={onPlay}
                        onHover={() => slide.jfEpisodeId && prewarm(slide.jfEpisodeId)}
                    />
                </div>
            ) : null}
            bottomOverlay={!r.touch && endTime ? (
                <div
                    className='jfp-card-hover-show'
                    style={{
                        position: 'absolute',
                        right: 8,
                        bottom: (slide.progress && slide.progress > 0 && slide.progress < 1) ? 10 : 6,
                        fontFamily: T.ui,
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                        color: 'rgba(255, 255, 255, 0.95)',
                        textShadow: '0 1px 4px rgba(0, 0, 0, 0.9), 0 2px 8px rgba(0, 0, 0, 0.7)',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        zIndex: 2
                    }}
                >
                    {endTime}
                </div>
            ) : null}
            caption={
                <div onClick={onOpenEpisode} style={{ cursor: 'pointer' }}>
                    {r.touch && endTime ? (
                        <div ref={containerRef} className='jfp-caption-rotator'>
                            <div className='jfp-caption-item-1'>
                                <span
                                    ref={textRef}
                                    className={overflowPx > 0 ? 'jfp-caption-scroller-sync' : undefined}
                                    style={{
                                        display: 'inline-block',
                                        textTransform: 'none',
                                        letterSpacing: 'normal',
                                        color: '#fff',
                                        fontSize: 12,
                                        lineHeight: 1.3,
                                        whiteSpace: 'nowrap',
                                        '--jfp-scroll-x': `-${overflowPx + 6}px`
                                    } as CSSProperties}
                                    title={epSubtitle}
                                >
                                    {epSubtitle}
                                </span>
                            </div>
                            <div className='jfp-caption-item-2'>
                                <span
                                    style={{
                                        display: 'block',
                                        textTransform: 'none',
                                        letterSpacing: 'normal',
                                        color: 'rgba(255, 255, 255, 0.85)',
                                        fontSize: 12,
                                        lineHeight: 1.3,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}
                                    title={endTime}
                                >
                                    {endTime}
                                </span>
                            </div>
                        </div>
                    ) : (
                        r.touch ? (
                            <div
                                ref={containerRef}
                                style={{
                                    overflow: 'hidden',
                                    width: '100%',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                <span
                                    ref={textRef}
                                    className={overflowPx > 0 ? 'jfp-caption-scroller-standalone' : undefined}
                                    style={{
                                        display: 'inline-block',
                                        textTransform: 'none',
                                        letterSpacing: 'normal',
                                        color: '#fff',
                                        fontSize: 12,
                                        lineHeight: 1.3,
                                        whiteSpace: 'nowrap',
                                        '--jfp-scroll-x': `-${overflowPx + 6}px`
                                    } as CSSProperties}
                                    title={epSubtitle}
                                >
                                    {epSubtitle}
                                </span>
                            </div>
                        ) : (
                            <span
                                className='jfp-card-hover-show'
                                style={{
                                    textTransform: 'none',
                                    letterSpacing: 'normal',
                                    color: '#fff',
                                    fontSize: 12,
                                    lineHeight: 1.3,
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}
                                title={epSubtitle}
                            >
                                {epSubtitle}
                            </span>
                        )
                    )}
                </div>
            }
        />
    );
});

