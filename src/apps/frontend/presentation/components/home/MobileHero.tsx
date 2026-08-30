// Hero de la Home para mobile/tablet: a pantalla completa, como el carrusel
// de escritorio. El estado del carrusel (slides, idx, autoplay) vive en
// HomePage y se comparte con esta vista.
//
// Dos decisiones que vienen de que el móvil es vertical y el escritorio no:
//
//  · La imagen de fondo es el PÓSTER en móvil y el BACKDROP en tablet. Un
//    backdrop 16:9 estirado a `cover` en una pantalla 9:19.5 se queda en un
//    recorte central sin composición; el póster (2:3) llena el alto sin
//    destrozar la imagen.
//  · El bloque de contenido va en flujo (columna con gap), no en absoluto:
//    logo → dato → play → puntos, en ese orden y sin que nada se solape,
//    encoja lo que encoja la pantalla. El alto usa --jfp-viewport-h (dvh),
//    que descuenta la barra del navegador, y el padding inferior descuenta
//    la píldora de navegación.

import { useRef } from 'react';

import globalize from 'lib/globalize';

import type { CarouselSlide } from '../../../domain/models';
import { T } from '../../theme/tokens';
import { useShortViewport } from '../../theme/responsive';
import { formatRemainingCompact } from '../../theme/format';
import { Backdrop } from '../layout/Backdrop';
import { PlayBtn } from '../controls/PlayBtn';
import { TextButton, TEXT_BTN_TAP } from '../controls/TextButton';
import { ScrollHint } from '../layout/ScrollHint';
import { NAV_BOTTOM_VAR, NAV_LEFT_VAR } from '../nav/navMetrics';
import type { Navigate } from '../../../app/router';

type Props = {
    slides: CarouselSlide[];
    idx: number;
    tablet: boolean;
    goSlide: (n: number) => void;
    onPlay: () => void;
    navigate: Navigate;
    /** Opacidad durante la transición de scroll (Home). */
    contentOpacity?: number;
    /** Desplazamiento vertical durante la transición de scroll (Home). */
    contentTranslateY?: number;
    /** Opacidad del indicador de scroll. */
    scrollHintOpacity?: number;
};

export function MobileHero({
    slides, idx, tablet, goSlide, onPlay, navigate,
    contentOpacity, contentTranslateY, scrollHintOpacity
}: Props) {
    const slide = slides[Math.min(idx, slides.length - 1)];
    const short = useShortViewport();

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
    // Las mismas tres navegaciones que el hero de escritorio: el logo lleva a
    // la ficha, la temporada a la suya y el episodio al que ibas.
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

    // Solo las series traen T·E que enseñar, y solo ahí la línea navega.
    const hasEpisode = isContinue && slide.season != null;
    const plainMeta = isContinue ? globalize.translate('ContinueWatching') : String(slide.year);
    const remaining = isContinue ? formatRemainingCompact(slide.remaining) : '';

    // El Backdrop alimenta la seed del dynamic color con lo que se ve, así
    // que el tema (y con él la píldora de navegación) toma el color de esta
    // misma imagen.
    const image = tablet ?
        (slide.backdrop || slide.poster) :
        (slide.poster || slide.backdrop);

    const side = tablet ? 32 : 20;
    const topPad = short ? 44 : 64;
    const gap = short ? 8 : (tablet ? 18 : 14);
    const playSize = short ? 58 : (tablet ? 94 : 76);
    const logoMax = short ? 'min(28vh, 78px)' : (tablet ? 'min(20vh, 145px)' : 'min(16vh, 100px)');

    return (
        <section
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            style={{
                position: 'relative',
                height: 'var(--jfp-viewport-h, 100vh)',
                // A sangre: el body lleva reservado el hueco del rail (tablet)
                // y el safe-area, y aquí se devuelve para que el fondo del hero
                // (degradados, viñeta) llegue al borde. La IMAGEN se recorta
                // al área útil desde Backdrop, alineada con el contenido. El
                // lado derecho no se toca, así que no hay desbordamiento.
                marginLeft: 'calc(-1 * var(--jfp-nav-left, 0px))',
                width: 'calc(100% + var(--jfp-nav-left, 0px))',
                overflow: 'hidden',
                background: '#000',
                color: 'var(--md-sys-color-on-surface, #fff)',
                fontFamily: T.ui,
                touchAction: 'pan-y',
                userSelect: 'none'
            }}
        >
            <Backdrop src={image} srcs={tablet ? slide.backdrops : undefined} vignette={0.2} sharp bottomFade={false} />

            {/* Velo inferior suave para lectura de textos */}

            <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                textAlign: 'center',
                gap,
                opacity: contentOpacity,
                transform: contentTranslateY ? `translateY(${contentTranslateY}px)` : undefined,
                pointerEvents: (contentOpacity !== undefined && contentOpacity < 0.2) ? 'none' : 'auto',
                willChange: 'opacity, transform',
                // El contenido se queda dentro de lo que la navegación deja
                // libre: arriba la barra superior (logo + avatar), abajo la
                // píldora y a la izquierda el rail en tablet.
                padding: `calc(${topPad}px + env(safe-area-inset-top, 0px))`
                    + ` calc(${side}px + env(safe-area-inset-right, 0px))`
                    + ` calc(var(${NAV_BOTTOM_VAR}, 24px) + ${short ? 8 : (tablet ? 24 : 16)}px)`
                    + ` calc(${side}px + var(${NAV_LEFT_VAR}, 0px))`
            }}
            >
                {/* key = id: crossfade sencillo al cambiar de slide. */}
                <div
                    key={slide.id}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        minHeight: 0,
                        maxWidth: '100%',
                        gap: short ? 8 : (tablet ? 16 : 12),
                        animation: 'jfp-fade-in 0.45s ease-out both'
                    }}
                >
                    <TextButton
                        onClick={goDetail}
                        label={slide.title}
                        style={{ display: 'block', maxWidth: '100%' }}
                    >
                        {slide.logo ? (
                            <img
                                src={slide.logo}
                                alt={slide.title}
                                decoding='async'
                                style={{
                                    maxWidth: tablet ? 'min(70vw, 440px)' : 'min(78vw, 320px)',
                                    maxHeight: logoMax,
                                    width: 'auto',
                                    height: 'auto',
                                    objectFit: 'contain',
                                    filter: 'drop-shadow(0 3px 24px rgba(0, 0, 0, 0.6))'
                                }}
                            />
                        ) : (
                            <h1 style={{
                                fontFamily: T.display,
                                fontSize: short ? 'clamp(24px, 5vh, 34px)' :
                                    (tablet ? 'clamp(40px, 6vw, 72px)' : 'clamp(30px, 9vw, 46px)'),
                                lineHeight: 1.02,
                                margin: 0,
                                fontWeight: 300,
                                letterSpacing: -0.5,
                                textShadow: '0 2px 24px rgba(0, 0, 0, 0.5)',
                                textWrap: 'balance',
                                overflow: 'hidden',
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical'
                            }}
                            >
                                {slide.title}
                            </h1>
                        )}
                    </TextButton>

                    <div style={{
                        fontSize: 'var(--md-sys-typescale-label-large-size, 14px)',
                        color: 'var(--md-sys-color-on-surface-variant, rgba(255,255,255,0.7))',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis'
                    }}
                    >
                        {hasEpisode ? (
                            <>
                                <TextButton onClick={goSeason} style={TEXT_BTN_TAP}>
                                    {`T${slide.season}`}
                                </TextButton>
                                {/* «E6 · Inicio de semestre» es UN solo botón:
                                    el número y el nombre son la misma cosa y
                                    llevan al mismo sitio; separarlos daría dos
                                    dianas pequeñas en vez de una cómoda. */}
                                {slide.episode != null ? (
                                    <>
                                        {' · '}
                                        <TextButton onClick={goEpisode} style={TEXT_BTN_TAP}>
                                            {`E${slide.episode}`}
                                            {slide.episodeTitle ? ` · ${slide.episodeTitle}` : ''}
                                        </TextButton>
                                    </>
                                ) : (slide.episodeTitle ? ` · ${slide.episodeTitle}` : '')}
                            </>
                        ) : (
                            <>
                                {plainMeta}
                                {isContinue && slide.episodeTitle ? ` · ${slide.episodeTitle}` : ''}
                            </>
                        )}
                        {remaining ? ` · ${remaining}` : ''}
                    </div>

                    <PlayBtn
                        size={playSize}
                        onClick={onPlay}
                        progress={isContinue ? slide.progress : null}
                    />
                </div>

                {/* Puntos del carrusel: último en la columna, nunca encima del
                    play (antes iban en absoluto y se pisaban en pantallas
                    cortas). */}
                {slides.length > 1 && (
                    <div style={{
                        display: 'flex',
                        gap: 6,
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    >
                        {slides.map((s, i) => (
                            // El punto se ve fino, pero el botón que lo lleva
                            // mide 24px de alto: en táctil hay que poder darle.
                            <button
                                key={s.id}
                                onClick={() => goSlide(i)}
                                aria-label={`Slide ${i + 1}`}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '10px 2px',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <span style={{
                                    display: 'block',
                                    width: i === idx ? 22 : 6,
                                    height: 4,
                                    borderRadius: 2,
                                    background: i === idx ?
                                        'var(--md-sys-color-primary, #fff)' :
                                        'var(--md-sys-color-outline-variant, rgba(255,255,255,0.32))',
                                    transition: 'width .4s cubic-bezier(.65,0,.35,1), background .3s'
                                }}
                                />
                            </button>
                        ))}
                    </div>
                )}

                {/* Indicador de scroll adaptado al flujo del hero táctil */}
                <ScrollHint
                    label={globalize.translate('HeaderMyLibrary')}
                    opacity={scrollHintOpacity ?? contentOpacity ?? 1}
                    style={{
                        position: 'relative',
                        left: 'auto',
                        bottom: 'auto',
                        transform: 'none',
                        marginTop: short ? 0 : 4,
                        marginBottom: 0
                    }}
                />
            </div>
        </section>
    );
}
