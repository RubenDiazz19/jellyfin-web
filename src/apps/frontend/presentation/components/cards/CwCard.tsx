import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { T } from '../../theme/tokens';
import { WatchedButton } from '../controls/toggles/WatchedButton';
import { FavButton } from '../controls/buttons/FavButton';
import { PlayBtn } from '../controls/buttons/PlayBtn';
import { SelectionMark } from './SelectionMark';
import { useResponsive } from '../../theme/responsive';
import type { Navigate } from '../../../app/router';
import type { CarouselSlide } from '../../../domain/models';
import { episodeKey } from '../../../domain/stores';
import { useCardInteractions } from './useCardInteractions';
import { LandscapeCardShell } from './LandscapeCardShell';
import { formatEndTime, formatRemainingCompact, formatEpisodeCode } from '../../utils/format';
import { usePlayer } from '../player/PlayerProvider';
import { logger } from '../../../shared/logger';

type Props = { slide: CarouselSlide; navigate: Navigate };

// Tarjeta horizontal 16:9 de "continuar viendo" con fondo de la serie/película y barra de progreso.
export const CwCard = memo(function CwCardBase({ slide, navigate }: Props) {
    const r = useResponsive();
    const { play, prewarm } = usePlayer();
    // Ancho optimizado a 340px en desktop para mantener proporción áurea con pósters de 185px
    const w = r.touch ? (r.mobile ? 312 : 364) : 340;
    const epId = slide.jfEpisodeId ?? slide.id;
    const wKey = slide.season != null && slide.episode != null ?
        episodeKey(slide.id, slide.season as number, slide.episode as number) : slide.id;

    const onPlay = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        const epTitle = slide.season != null && slide.episode != null ?
            `${slide.title} · ${formatEpisodeCode(slide.season as number, slide.episode as number)} — ${slide.episodeTitle}` :
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
        poster: slide.backdrop || slide.poster,
        year: slide.year,
        watchedKey: wKey,
        queueSubtitle: slide.season != null && slide.episode != null ?
            formatEpisodeCode(slide.season as number, slide.episode as number) :
            String(slide.year),
        queuePoster: slide.poster,
        onOpen: onPlay
    }, navigate);

    const endTime = formatEndTime(slide.remaining);

    // Formato estructurado: "TX · EY · Nombre del episodio" para series, o info para películas
    const epParts: string[] = [];
    if (slide.season != null) epParts.push(`T${slide.season}`);
    if (slide.episode != null) epParts.push(`E${slide.episode}`);
    if (slide.episodeTitle) epParts.push(slide.episodeTitle);
    const epSubtitle = epParts.length > 0 ? epParts.join(' · ') : (slide.year ? `${slide.year} · Película` : slide.title);

    const remainingText = slide.remaining ?
        (formatRemainingCompact(slide.remaining) || (slide.remaining.includes('min') ? slide.remaining : `${slide.remaining} min`)) :
        '';

    const [manualState, setManualState] = useState<'rem' | 'end' | null>(null);

    // Al hacer clic sobre el tiempo, alterna manualmente el estado y pausa la animación
    const onToggleTime = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setManualState((prev) => prev === 'end' ? 'rem' : 'end');
    }, []);

    // Medición de desbordamiento horizontal para scroll suave del título y subtítulo
    const titleContRef = useRef<HTMLDivElement>(null);
    const titleTextRef = useRef<HTMLSpanElement>(null);
    const [titleOverflow, setTitleOverflow] = useState(0);

    const subContRef = useRef<HTMLDivElement>(null);
    const subTextRef = useRef<HTMLSpanElement>(null);
    const [subOverflow, setSubOverflow] = useState(0);

    useEffect(() => {
        let active = true;
        const titleEl = titleContRef.current;
        const textEl = titleTextRef.current;
        const subContEl = subContRef.current;
        const subTextEl = subTextRef.current;
        if (!titleEl || !textEl || !subContEl || !subTextEl) return;

        const measure = () => {
            if (!active) return;
            const tDiff = textEl.scrollWidth - titleEl.clientWidth;
            setTitleOverflow(tDiff > 3 ? Math.ceil(tDiff) : 0);
            const sDiff = subTextEl.scrollWidth - subContEl.clientWidth;
            setSubOverflow(sDiff > 3 ? Math.ceil(sDiff) : 0);
        };

        const ro = new ResizeObserver(measure);
        ro.observe(titleEl);
        ro.observe(subContEl);

        if (typeof document !== 'undefined' && document.fonts?.ready) {
            document.fonts.ready.then(() => {
                if (active) measure();
            }).catch((e) => {
                logger.debug('Error waiting for document fonts', e);
            });
        }

        return () => {
            active = false;
            ro.disconnect();
        };
    }, [slide.title, epSubtitle, w]);

    const onHoverPlay = useCallback(() => {
        if (slide.jfEpisodeId) prewarm(slide.jfEpisodeId);
    }, [slide.jfEpisodeId, prewarm]);

    return (
        <LandscapeCardShell
            cover={slide.backdrop || slide.poster}
            width={w}
            flex={`0 0 ${w}px`}
            selected={card.selected}
            onClick={card.onClick}
            onContextMenu={card.onContextMenu}
            contextMenu={card.contextMenu}
            progress={slide.progress ?? 0}
            style={{
                scrollSnapAlign: r.touch ? 'start' : undefined
            }}
            topLeft={
                card.selecting ? (
                    <SelectionMark selected={card.selected} />
                ) : (
                    <WatchedButton
                        id={wKey}
                        serverId={slide.jfEpisodeId}
                        size={16}
                        badge
                    />
                )
            }
            topRight={!card.selecting ? <FavButton id={slide.id} size={16} /> : null}
            centerOverlay={!card.selecting ? (
                <div
                    style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    className='jfp-playover'
                >
                    <PlayBtn
                        size={52}
                        onClick={onPlay}
                        onHover={onHoverPlay}
                    />
                </div>
            ) : null}
            bottomOverlay={remainingText ? (
                <div
                    className={`jfp-cw-remaining ${manualState ? 'paused-anim' : ''} ${manualState === 'end' ? 'force-end' : ''} ${manualState === 'rem' ? 'force-rem' : ''}`}
                    onClick={onToggleTime}
                    style={{
                        position: 'absolute',
                        right: 10,
                        bottom: (slide.progress && slide.progress > 0) ? 10 : 6,
                        fontFamily: T.ui,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                        color: 'rgba(255, 255, 255, 0.95)',
                        textShadow: '0 1px 4px rgba(0, 0, 0, 0.95), 0 2px 8px rgba(0, 0, 0, 0.85)',
                        whiteSpace: 'nowrap',
                        cursor: endTime ? 'pointer' : 'default',
                        pointerEvents: 'auto',
                        userSelect: 'none',
                        zIndex: 2,
                        transition: 'opacity 0.2s ease'
                    }}
                    title={endTime || remainingText}
                >
                    {endTime ? (
                        <span className='jfp-cw-time-container'>
                            <span className='jfp-cw-time-text jfp-cw-time-rem'>{remainingText}</span>
                            <span className='jfp-cw-time-text jfp-cw-time-end'>{endTime}</span>
                        </span>
                    ) : (
                        <span>{remainingText}</span>
                    )}
                </div>
            ) : null}
            footer={
                <div style={{ marginTop: 9, padding: '0 2px' }}>
                    {/* Título de la Serie / Película: Límite estricto a una sola línea */}
                    <div
                        role='button'
                        tabIndex={0}
                        onClick={onOpenDetails}
                        className='jfp-poster-logo-btn'
                        style={{
                            width: '100%',
                            cursor: 'pointer',
                            display: 'block',
                            overflow: 'hidden',
                            height: 20,
                            lineHeight: '20px'
                        }}
                    >
                        <div
                            ref={titleContRef}
                            style={{
                                overflow: 'hidden',
                                width: '100%',
                                whiteSpace: 'nowrap',
                                height: 20,
                                lineHeight: '20px'
                            }}
                        >
                            <span
                                ref={titleTextRef}
                                className={titleOverflow > 0 ? 'jfp-title-scroller' : undefined}
                                style={{
                                    display: 'inline-block',
                                    maxWidth: titleOverflow > 0 ? undefined : '100%',
                                    overflow: titleOverflow > 0 ? undefined : 'hidden',
                                    textOverflow: titleOverflow > 0 ? undefined : 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    fontFamily: T.ui,
                                    fontSize: 15,
                                    fontWeight: 600,
                                    color: '#fff',
                                    letterSpacing: '-0.01em',
                                    '--jfp-scroll-x': `-${titleOverflow + 8}px`
                                } as CSSProperties}
                                title={slide.title}
                            >
                                {slide.title}
                            </span>
                        </div>
                    </div>

                    {/* Subtítulo: Límite estricto a una sola línea */}
                    <div
                        role='button'
                        tabIndex={0}
                        onClick={onOpenEpisode}
                        style={{
                            width: '100%',
                            cursor: 'pointer',
                            marginTop: 3,
                            display: 'block',
                            overflow: 'hidden',
                            height: 18,
                            lineHeight: '18px'
                        }}
                    >
                        <div
                            ref={subContRef}
                            style={{
                                overflow: 'hidden',
                                width: '100%',
                                whiteSpace: 'nowrap',
                                height: 18,
                                lineHeight: '18px'
                            }}
                        >
                            <span
                                ref={subTextRef}
                                className={subOverflow > 0 ? 'jfp-title-scroller' : undefined}
                                style={{
                                    display: 'inline-block',
                                    maxWidth: subOverflow > 0 ? undefined : '100%',
                                    overflow: subOverflow > 0 ? undefined : 'hidden',
                                    textOverflow: subOverflow > 0 ? undefined : 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    fontFamily: T.ui,
                                    fontSize: 13,
                                    fontWeight: 400,
                                    color: 'rgba(255, 255, 255, 0.65)',
                                    '--jfp-scroll-x': `-${subOverflow + 8}px`
                                } as CSSProperties}
                                title={epSubtitle}
                            >
                                {epSubtitle}
                            </span>
                        </div>
                    </div>
                </div>
            }
        />
    );
});
