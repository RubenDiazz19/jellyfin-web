import React from 'react';
import { T } from '../../theme/tokens';
import { Ic } from '../../theme/icons';
import { formatEpisodeCode, formatRemainingCompact } from '../../utils/format';
import { PROTO_DATA, type CarouselSlide } from '../../../domain/models';
import { usePlayer } from '../player/PlayerProvider';
import { Backdrop } from '../layout/Backdrop';
import { PlayBtn } from '../controls/buttons/PlayBtn';
import { TextButton } from '../controls/buttons/TextButton';
import { useItemContextMenu } from '../controls/useItemContextMenu';
import { HeroTrailerVideo } from './HeroTrailerVideo';
import { HeroGenres } from '../layout/DetailHero';
import { cleanGenres } from '../../../domain/genres';
import type { HeroTrailerState, TrailerSource } from '../../../domain/viewModels/HeroTrailerViewModel';
import type { Navigate } from '../../../app/router';

const HERO_VIGNETTE_STYLE: React.CSSProperties = { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0.65) 75%, rgba(0,0,0,0.95) 92%, #000 100%)', pointerEvents: 'none' };

export const HeroSlide = React.memo(function HeroSlideBase({
    slide,
    width,
    navigate,
    onPlay,
    contentOpacity = 1,
    contentTranslateY = 0,
    interactive = true,
    isActive = false,
    trailerSource = null,
    trailerState = 'idle',
    isMuted = true,
    isPaused = false,
    onToggleMute,
    onError
}: {
    slide: CarouselSlide;
    width: string;
    navigate: Navigate;
    onPlay: () => void;
    contentOpacity?: number;
    contentTranslateY?: number;
    interactive?: boolean;
    isActive?: boolean;
    trailerSource?: TrailerSource | null;
    trailerState?: HeroTrailerState;
    isMuted?: boolean;
    isPaused?: boolean;
    onToggleMute?: () => void;
    onError?: (err?: unknown) => void;
}) {
    const isContinue = slide.type === 'continue';
    const isTrailerActive = isActive && trailerState !== 'idle' && !!trailerSource;
    const { prewarm } = usePlayer();
    const showData = PROTO_DATA.shows[slide.id] || PROTO_DATA.movies[slide.id];
    const logo = slide.logo ?? showData?.logo;
    const heroGenres = cleanGenres(slide.genres ?? showData?.genres).slice(0, 3);
    const ageRating = slide.officialRating ?? showData?.rating?.age;
    const imdbRating = slide.communityRating ?? showData?.rating?.imdb;

    const ctx = useItemContextMenu({
        id: slide.jfEpisodeId ?? slide.id,
        type: slide.type === 'continue' && slide.jfEpisodeId ? 'episode' :
            (slide.kind === 'movie' ? 'movie' : 'show'),
        itemTitle: slide.title,
        queueSubtitle: isContinue && slide.season != null && slide.episode != null ?
            formatEpisodeCode(slide.season, slide.episode) :
            String(slide.year),
        queuePoster: slide.poster
    });

    const goDetail = () => {
        if (slide.kind === 'movie') navigate({ page: 'movie', movieId: slide.id });
        else navigate({ page: 'show', showId: slide.id });
    };
    const goSeason = () => {
        if (slide.season == null) return;
        navigate({ page: 'season', showId: slide.id, seasonN: slide.season });
    };
    const goEpisode = () => {
        if (slide.season == null || slide.episode == null) return;
        navigate({ page: 'episode', showId: slide.id, seasonN: slide.season, epN: slide.episode });
    };

    return (
        <div
            style={{ width, height: '100%', position: 'relative', flexShrink: 0 }}
            onContextMenu={ctx.onContextMenu}
        >
            <Backdrop
                src={slide.backdrop} srcs={slide.backdrops}
                sharp
                bottomFade
                vignette={0.32}
            />

            {isActive && trailerSource && isTrailerActive && (
                <HeroTrailerVideo
                    source={trailerSource}
                    isMuted={isMuted}
                    isPaused={isPaused}
                    onToggleMute={onToggleMute}
                    onError={onError ?? (() => {})}
                />
            )}

            <div style={HERO_VIGNETTE_STYLE} />

            <div style={{
                position: 'absolute', inset: 0, padding: '0 48px 168px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                textAlign: 'center',
                opacity: contentOpacity,
                transform: `translateY(${contentTranslateY}px)`,
                pointerEvents: interactive ? 'auto' : 'none',
                willChange: 'opacity, transform'
            }}>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        textAlign: 'center',
                        maxWidth: '100%',
                        transformOrigin: 'bottom left',
                        transform: isTrailerActive ?
                            'translate(calc(-50vw + 50% + 12px), 132px) scale(0.80)' :
                            'translate(0, 0) scale(1)',
                        transition: 'transform 550ms cubic-bezier(0.25, 1, 0.5, 1), opacity 550ms ease',
                        willChange: 'transform',
                        pointerEvents: 'auto'
                    }}
                >
                    {heroGenres.length > 0 && (
                        <div style={{
                            transform: isTrailerActive ? 'translateY(16px)' : 'translateY(0)',
                            transition: 'transform 550ms cubic-bezier(0.25, 1, 0.5, 1)',
                            willChange: 'transform'
                        }}>
                            <HeroGenres
                                genres={heroGenres}
                                navigate={navigate}
                                fontSize={12}
                                marginBottom={15}
                                justifyContent='center'
                            />
                        </div>
                    )}

                    <TextButton
                        onClick={goDetail}
                        label={slide.title}
                        style={{ display: 'block', marginBottom: 20 }}
                    >
                        {logo ? (
                            <img
                                src={logo}
                                alt={slide.title}
                                decoding='async'
                                style={{
                                    maxWidth: 518, maxHeight: 176, width: 'auto', height: 'auto',
                                    objectFit: 'contain', filter: 'drop-shadow(0 4px 50px rgba(0,0,0,0.6))',
                                    transform: isTrailerActive ? 'scale(0.90)' : 'scale(1)',
                                    transformOrigin: 'bottom center',
                                    transition: 'transform 550ms cubic-bezier(0.25, 1, 0.5, 1)'
                                }}
                            />
                        ) : (
                            <h1 style={{
                                fontFamily: T.ui, fontSize: 'clamp(64px, 7.7vw, 128px)', lineHeight: 0.92,
                                margin: 0, fontWeight: 250, letterSpacing: -2,
                                textShadow: '0 4px 50px rgba(0,0,0,0.55)', textWrap: 'balance',
                                transform: isTrailerActive ? 'scale(0.90)' : 'scale(1)',
                                transformOrigin: 'bottom center',
                                transition: 'transform 550ms cubic-bezier(0.25, 1, 0.5, 1)'
                            }}>
                                {slide.title}
                            </h1>
                        )}
                    </TextButton>

                    {isContinue && slide.season != null ? (
                        <div style={{
                            fontFamily: T.ui, fontSize: 15, color: 'rgba(255,255,255,0.72)',
                            marginBottom: 22, display: 'flex', alignItems: 'center', gap: 13,
                            flexWrap: 'wrap', justifyContent: 'center'
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <span style={{
                                    width: 5, height: 5, borderRadius: 999, background: '#fff',
                                    display: 'inline-block', animation: 'jfp-pulse 1.8s ease-in-out infinite'
                                }} />
                                <TextButton onClick={goSeason} highlight>
                                    {`T${slide.season}`}
                                </TextButton>
                                {slide.episode != null && (
                                    <>
                                        {' · '}
                                        <TextButton
                                            onClick={goEpisode}
                                            highlight
                                            style={{ display: 'flex', alignItems: 'center', gap: 13 }}
                                        >
                                            {`E${slide.episode}`}
                                            {slide.episodeTitle && (
                                                <>
                                                    <Ic.Dot />
                                                    <span style={{
                                                        fontFamily: T.ui, fontSize: 20
                                                    }}>
                                                        {slide.episodeTitle}
                                                    </span>
                                                </>
                                            )}
                                        </TextButton>
                                    </>
                                )}
                            </span>
                        </div>
                    ) : (
                        <div style={{
                            fontFamily: T.ui, fontSize: 14, color: 'rgba(255,255,255,0.7)',
                            marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 13, flexWrap: 'wrap'
                        }}>
                            <span style={{ letterSpacing: 2, fontWeight: 500 }}>
                                {slide.year}
                            </span>

                            {ageRating && (
                                <>
                                    <Ic.Dot />
                                    <span style={{
                                        border: '1px solid rgba(255,255,255,0.35)',
                                        padding: '2px 8px',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        borderRadius: 3,
                                        letterSpacing: 0.5,
                                        lineHeight: 1,
                                        color: 'rgba(255,255,255,0.9)'
                                    }}>
                                        {ageRating}
                                    </span>
                                </>
                            )}

                            {imdbRating != null && imdbRating > 0 && (
                                <>
                                    <Ic.Dot />
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 7,
                                        fontWeight: 600, fontSize: 14, color: 'rgba(255,255,255,0.95)'
                                    }}>
                                        <Ic.Imdb /> {imdbRating.toFixed(1)}
                                    </span>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div
                    style={{
                        marginBottom: isContinue ? 15 : 0,
                        opacity: isTrailerActive ? 0.35 : 1,
                        transition: 'opacity 550ms ease',
                        willChange: 'opacity'
                    }}
                    onMouseEnter={(e) => {
                        if (isTrailerActive) e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                        if (isTrailerActive) e.currentTarget.style.opacity = '0.35';
                    }}
                >
                    <PlayBtn
                        size={106}
                        onClick={onPlay}
                        onHover={() => {
                            const prewarmId = slide.jfEpisodeId ?? (slide.kind === 'movie' ? slide.id : undefined);
                            if (prewarmId) prewarm(prewarmId);
                        }}
                        progress={isContinue ? slide.progress : null}
                        hoverText={isContinue ? formatRemainingCompact(slide.remaining) || null : null}
                    />
                </div>
            </div>
            {ctx.menu}
        </div>
    );
});
