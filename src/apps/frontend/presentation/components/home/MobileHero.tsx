// Hero de la Home para mobile/tablet (el desktop conserva su carrusel
// 100vh en HomePage). Mobile: 40vh, sin backdrop — póster + info con un
// gradiente corto. Tablet: 55vh con backdrop ligero. El estado del carrusel
// (slides, idx, autoplay) vive en HomePage y se comparte con esta vista.

import { useEffect, useRef } from 'react';

import type { CarouselSlide } from '../../../domain/models';
import { T } from '../../theme/tokens';
import { formatRemainingCompact } from '../../theme/format';
import { Backdrop } from '../layout/Backdrop';
import { PlayBtn } from '../controls/PlayBtn';
import { useMobileTheme } from '../../theme/MobileThemeProvider';

type Props = {
    slides: CarouselSlide[];
    idx: number;
    tablet: boolean;
    goSlide: (n: number) => void;
    onPlay: () => void;
};

export function MobileHero({ slides, idx, tablet, goSlide, onPlay }: Props) {
    const slide = slides[Math.min(idx, slides.length - 1)];
    const { applyImageSeed } = useMobileTheme();

    // Dynamic color: en mobile no hay Backdrop (que es quien alimenta la
    // seed en el resto de vistas), así que la nutre el póster visible.
    useEffect(() => {
        const src = tablet ? slide?.backdrop : slide?.poster;
        if (src) applyImageSeed(src);
    }, [slide, tablet, applyImageSeed]);

    // Swipe horizontal para cambiar de slide.
    const touchStart = useRef<{ x: number; y: number } | null>(null);
    const onTouchStart = (e: React.TouchEvent) => {
        const t = e.touches[0];
        touchStart.current = { x: t.clientX, y: t.clientY };
    };
    const onTouchEnd = (e: React.TouchEvent) => {
        const start = touchStart.current;
        touchStart.current = null;
        const t = e.changedTouches[0];
        if (!start || !t) return;
        const dx = t.clientX - start.x;
        if (Math.abs(dx) < 48 || Math.abs(t.clientY - start.y) > 60) return;
        goSlide(idx + (dx < 0 ? 1 : -1));
    };

    if (!slide) return null;

    const isContinue = slide.type === 'continue';
    const meta = isContinue ?
        (slide.season != null ? `T${slide.season} · E${slide.episode}` : 'Continuar viendo') :
        String(slide.year);

    return (
        <section
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            style={{
                position: 'relative',
                height: tablet ? '55vh' : '40vh',
                minHeight: tablet ? 360 : 300,
                overflow: 'hidden',
                background: 'var(--md-sys-color-surface, #000)',
                color: 'var(--md-sys-color-on-surface, #fff)',
                fontFamily: T.ui,
                userSelect: 'none'
            }}
        >
            {/* Tablet: backdrop ligero. Mobile: sin backdrop (spec 4.1). */}
            {tablet && (
                <Backdrop src={slide.backdrop} itemId={slide.id} vignette={0.25} sharp />
            )}

            {/* Gradiente corto para legibilidad del bloque inferior. */}
            <div style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: tablet ?
                    'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.25) 34%, transparent 60%)' :
                    'linear-gradient(to top, var(--md-sys-color-surface, #000) 0%, transparent 45%)'
            }}
            />

            <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'flex-end',
                gap: 16,
                padding: tablet ? '0 24px 40px' : '0 16px 24px'
            }}
            >
                {/* key = id: crossfade sencillo al cambiar de slide. */}
                <div
                    key={slide.id}
                    style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: 16,
                        width: '100%',
                        animation: 'jfp-fade-in 0.45s ease-out both'
                    }}
                >
                    {!tablet && (
                        <img
                            src={slide.poster || slide.backdrop}
                            alt=''
                            decoding='async'
                            style={{
                                width: 108,
                                aspectRatio: '2/3',
                                objectFit: 'cover',
                                borderRadius: 'var(--md-sys-shape-corner-medium, 12px)',
                                boxShadow: 'var(--md-sys-elevation-level2, 0 4px 12px rgba(0,0,0,0.5))',
                                flexShrink: 0
                            }}
                        />
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                        {slide.logo ? (
                            <img
                                src={slide.logo}
                                alt={slide.title}
                                decoding='async'
                                style={{
                                    maxWidth: tablet ? 320 : 200,
                                    maxHeight: tablet ? 110 : 64,
                                    width: 'auto',
                                    height: 'auto',
                                    objectFit: 'contain',
                                    objectPosition: 'left bottom',
                                    filter: 'drop-shadow(0 2px 18px rgba(0,0,0,0.6))',
                                    marginBottom: 8
                                }}
                            />
                        ) : (
                            <h1 style={{
                                fontFamily: T.display,
                                fontSize: tablet ? 44 : 26,
                                lineHeight: 1.02,
                                margin: '0 0 6px',
                                fontWeight: 300,
                                letterSpacing: -0.5,
                                textShadow: '0 2px 24px rgba(0,0,0,0.5)',
                                textWrap: 'balance',
                                overflow: 'hidden',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical'
                            }}
                            >
                                {slide.title}
                            </h1>
                        )}

                        <div style={{
                            fontSize: 'var(--md-sys-typescale-label-medium-size, 12px)',
                            color: 'var(--md-sys-color-on-surface-variant, rgba(255,255,255,0.7))',
                            marginBottom: 10,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis'
                        }}
                        >
                            {meta}
                            {isContinue && slide.episodeTitle ? ` · ${slide.episodeTitle}` : ''}
                            {isContinue && formatRemainingCompact(slide.remaining) ?
                                ` · ${formatRemainingCompact(slide.remaining)}` : ''}
                        </div>

                        <PlayBtn
                            size={tablet ? 64 : 52}
                            onClick={onPlay}
                            progress={isContinue ? slide.progress : null}
                        />
                    </div>
                </div>
            </div>

            {/* Dots del carrusel. */}
            {slides.length > 1 && (
                <div style={{
                    position: 'absolute',
                    right: tablet ? 24 : 16,
                    bottom: tablet ? 40 : 24,
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center'
                }}
                >
                    {slides.map((s, i) => (
                        <button
                            key={s.id}
                            onClick={() => goSlide(i)}
                            aria-label={`Slide ${i + 1}`}
                            style={{
                                width: i === idx ? 18 : 6,
                                height: 3,
                                borderRadius: 2,
                                background: i === idx ?
                                    'var(--md-sys-color-primary, #fff)' :
                                    'var(--md-sys-color-outline-variant, rgba(255,255,255,0.32))',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                transition: 'width .4s cubic-bezier(.65,0,.35,1), background .3s'
                            }}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
