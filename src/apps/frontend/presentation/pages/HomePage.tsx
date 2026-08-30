import globalize from 'lib/globalize';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { formatRemainingCompact } from '../theme/format';
import { PROTO_DATA, type CarouselSlide } from '../../domain/models';
import { homeVM } from '../../domain/viewModels/HomeViewModel';
import { useVmSignals } from '../../domain/bridge/useViewModel';
import { useSession } from '../../domain/bridge/useSession';
import { usePlayer } from '../components/player/PlayerProvider';
import { Backdrop } from '../components/layout/Backdrop';
import { Nav } from '../components/layout/Nav';
import { ScrollHint } from '../components/layout/ScrollHint';
import { Row, RowScroller } from '../components/layout/Row';
import { CwCard } from '../components/cards/CwCard';
import { MovieCard } from '../components/cards/MovieCard';
import { PosterCard } from '../components/cards/PosterCard';
import { PlayBtn } from '../components/controls/PlayBtn';
import { TextButton } from '../components/controls/TextButton';
import { useItemContextMenu } from '../components/controls/useItemContextMenu';
import { SkeletonRow } from '../components/skeleton/Skeleton';
import { MobileHero } from '../components/home/MobileHero';
import { MC, useResponsive } from '../theme/responsive';
import { useHomeScrollTransition } from './useHomeScrollTransition';
import type { Navigate } from '../../app/router';

export function HomePage({ navigate }: { navigate: Navigate }) {
    const { session } = useSession();
    const { play } = usePlayer();
    const r = useResponsive();
    const jellyfinMode = !!session?.accessToken;
    // En modo Jellyfin el carrusel se construye con datos reales (continuar
    // viendo + últimas series); en modo prototipo, con PROTO_DATA.
    // Solo los signals del hero: cargar la biblioteca no re-pinta el carrusel.
    useVmSignals(homeVM, (vm) => [vm.slides, vm.heroLoading, vm.heroReady]);
    useEffect(() => {
        if (jellyfinMode) void homeVM.load();
    }, [jellyfinMode]);
    const slides = jellyfinMode ? homeVM.slides.value : PROTO_DATA.carousel;
    const heroLoading = jellyfinMode && (homeVM.heroLoading.value || !homeVM.heroReady.value);
    const [idx, setIdx] = useState(0);
    const [paused, setPaused] = useState(false);
    // dragPct: porcentaje ya normalizado por el ancho del hero — así el render
    // de la strip no vuelve a leer clientWidth (que fuerza layout) en cada
    // frame del arrastre. Se calcula al vuelo en pointermove.
    const [dragPct, setDragPct] = useState(0);
    const [dragging, setDragging] = useState(false);
    const heroRef = useRef<HTMLElement>(null);
    const dragStart = useRef<{ x: number; idx: number; width: number } | null>(null);
    const wheelAccum = useRef(0);
    const wheelLockRef = useRef(false);

    const slideCount = slides.length;
    const trans = useHomeScrollTransition();

    // Pausa el carrusel durante arrastre, pausa manual o cuando el hero queda
    // fuera de pantalla al hacer scroll, ahorrando ciclos de CPU/batería.
    useEffect(() => {
        if (paused || dragging || slideCount <= 1 || trans.isHeroOffscreen) return;
        const t = setTimeout(() => setIdx((n) => (n + 1) % slideCount), 8000);
        return () => clearTimeout(t);
    }, [idx, paused, dragging, slideCount, trans.isHeroOffscreen]);

    const goSlide = useCallback(
        (n: number) => {
            setIdx(((n % slideCount) + slideCount) % slideCount);
        },
        [slideCount]
    );

    const onPointerDown = (e: React.PointerEvent) => {
    // No arrastramos si el gesto empieza sobre un control interactivo (play,
    // dots del carrusel) o dentro del Nav superior (lupa, logo, avatar,
    // enlaces): el drag captura el puntero y traga sus clicks.
        if ((e.target as HTMLElement).closest('button, a, [data-jfp-nav]')) return;
        // Capturamos el ancho aquí una sola vez; no vuelve a leerse durante el
        // arrastre (leer clientWidth por frame forzaría layout).
        const width = heroRef.current?.clientWidth || window.innerWidth;
        setDragging(true);
        setDragPct(0);
        dragStart.current = { x: e.clientX, idx, width };
        setPaused(true);
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (!dragging || !dragStart.current) return;
        const { x, width } = dragStart.current;
        setDragPct(((e.clientX - x) / width) * (100 / slideCount));
    };
    const onPointerUp = (e: React.PointerEvent) => {
        if (!dragging || !dragStart.current) return;
        const dxPct = dragPct * (slideCount / 100);
        let delta = 0;
        if (dxPct < -0.15) delta = 1;
        else if (dxPct > 0.15) delta = -1;
        if (delta !== 0) goSlide(idx + delta);
        setDragging(false);
        setDragPct(0);
        dragStart.current = null;
        setPaused(false);
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    };

    // Trackpads generan muchos wheel events con inercia. Estrategia: lock más
    // largo que la transición + reset del acumulador cuando termina el gesto.
    useEffect(() => {
        const el = heroRef.current;
        if (!el) return;
        wheelAccum.current = 0;
        let resetTimer: ReturnType<typeof setTimeout> | null = null;
        const onWheel = (e: WheelEvent) => {
            if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.2) return;
            e.preventDefault();
            if (wheelLockRef.current) {
                if (resetTimer) clearTimeout(resetTimer);
                resetTimer = setTimeout(() => { wheelAccum.current = 0; }, 150);
                return;
            }
            wheelAccum.current += e.deltaX;
            const THRESH = 100;
            if (Math.abs(wheelAccum.current) > THRESH) {
                const dir = wheelAccum.current > 0 ? 1 : -1;
                goSlide(idx + dir);
                wheelAccum.current = 0;
                wheelLockRef.current = true;
                setTimeout(() => { wheelLockRef.current = false; }, 900);
            }
            if (resetTimer) clearTimeout(resetTimer);
            resetTimer = setTimeout(() => { wheelAccum.current = 0; }, 150);
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            el.removeEventListener('wheel', onWheel);
            if (resetTimer) clearTimeout(resetTimer);
        };
    }, [idx, goSlide]);

    // Referencia al idx actual para que onPlay sea estable entre ticks del
    // autoplay. Si onPlay se recrease cada 8s, los HeroSlide memoizados se
    // re-renderizarían todos por el cambio de prop.
    const idxRef = useRef(idx);
    idxRef.current = idx;
    const onPlay = useCallback(() => {
        const cur = slides[idxRef.current];
        if (!cur) return;
        if (cur.type === 'continue' && cur.jfEpisodeId) {
            // Modo Jellyfin: reanuda el episodio/película directamente en el
            // reproductor.
            play({
                itemId: cur.jfEpisodeId,
                title: cur.season != null && cur.episode != null ?
                    `${cur.title} · T${cur.season} E${String(cur.episode).padStart(2, '0')} — ${cur.episodeTitle}` :
                    cur.title,
                startTicks: cur.positionTicks
            });
        } else if (cur.type === 'continue' && cur.kind !== 'movie') {
            navigate({
                page: 'episode',
                showId: cur.id,
                seasonN: cur.season as number,
                epN: cur.episode as number
            });
        } else if (cur.kind === 'movie') {
            navigate({ page: 'movie', movieId: cur.id });
        } else {
            navigate({ page: 'show', showId: cur.id });
        }
    }, [slides, navigate, play]);

    const baseTranslate = slideCount > 0 ? -idx * (100 / slideCount) : 0;

    // Mientras carga el carrusel real, reservamos el alto del hero para que la
    // biblioteca no "salte" cuando lleguen los slides.
    if (heroLoading) {
        return (
            <div style={{ position: 'relative', width: '100%', minHeight: '100vh', background: '#000' }}>
                <Nav navigate={navigate} active='home' />
                <section style={{
                    position: 'relative',
                    // El hero táctil también es a pantalla completa y a
                    // sangre, así que el hueco reservado mientras carga mide
                    // lo mismo (si no, la biblioteca da un salto al llegar).
                    height: r.touch ? 'var(--jfp-viewport-h, 100vh)' : '100vh',
                    marginLeft: r.touch ? 'calc(-1 * var(--jfp-nav-left, 0px))' : undefined,
                    width: r.touch ? 'calc(100% + var(--jfp-nav-left, 0px))' : '100%',
                    overflow: 'hidden', background: '#000'
                }} />
                <HomeLibrary navigate={navigate} />
            </div>
        );
    }

    // Sin slides (biblioteca vacía o error): saltamos el hero y pintamos
    // directamente la Nav sticky + biblioteca.
    if (slideCount === 0) {
        return (
            <div style={{ background: '#000', color: '#fff', minHeight: '100vh' }}>
                <Nav navigate={navigate} active='home' />
                <div style={{ height: 80 }} />
                <HomeLibrary navigate={navigate} />
            </div>
        );
    }

    // Mobile/tablet: hero táctil con transición suave y fijo al deslizar.
    if (r.touch) {
        return (
            <div style={{ position: 'relative', width: '100%', minHeight: '100vh', background: '#000' }}>
                <Nav navigate={navigate} active='home' />
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1,
                    height: 'var(--jfp-viewport-h, 100vh)',
                    overflow: 'hidden',
                    touchAction: 'pan-y',
                    opacity: trans.heroBackdropOpacity,
                    pointerEvents: trans.heroInteractive ? 'auto' : 'none',
                    willChange: 'opacity'
                }}>
                    <MobileHero
                        slides={slides}
                        idx={idx}
                        tablet={r.tablet}
                        goSlide={goSlide}
                        onPlay={onPlay}
                        navigate={navigate}
                        contentOpacity={trans.heroContentOpacity}
                        scrollHintOpacity={trans.scrollHintOpacity}
                    />
                </div>
                <div style={{ height: 'var(--jfp-viewport-h, 100vh)', pointerEvents: 'none' }} />
                <div style={{
                    position: 'relative', zIndex: 2,
                    background: 'transparent',
                    minHeight: '100vh'
                }}>
                    <HomeLibrary
                        navigate={navigate}
                        titleOpacity={trans.titleOpacity}
                        titleTranslateY={trans.titleTranslateY}
                    />
                </div>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', width: '100%', minHeight: '100vh', background: '#000' }}>
            <Nav navigate={navigate} active='home' />

            {/* Contenedor fixed del Hero: permanece 100% estático en su sitio sin desplazarse */}
            <section
                ref={heroRef}
                onPointerDown={trans.heroInteractive ? onPointerDown : undefined}
                onPointerMove={trans.heroInteractive ? onPointerMove : undefined}
                onPointerUp={trans.heroInteractive ? onPointerUp : undefined}
                onPointerCancel={trans.heroInteractive ? onPointerUp : undefined}
                style={{
                    position: 'fixed', top: 0, left: 0, height: '100vh', width: '100%', overflow: 'hidden',
                    background: '#000',
                    cursor: dragging ? 'grabbing' : (trans.heroInteractive ? 'grab' : 'default'),
                    touchAction: 'pan-y',
                    userSelect: 'none',
                    zIndex: 1,
                    opacity: trans.heroBackdropOpacity,
                    pointerEvents: trans.heroInteractive ? 'auto' : 'none',
                    willChange: 'opacity'
                }}
            >
                <div
                    style={{
                        position: 'absolute', top: 0, left: 0, height: '100%',
                        width: `${slideCount * 100}%`,
                        display: 'flex',
                        transform: `translateX(calc(${baseTranslate}% + ${dragPct}%))`,
                        transition: dragging ? 'none' : 'transform 1.4s cubic-bezier(0.65, 0, 0.35, 1)',
                        willChange: 'transform'
                    }}
                >
                    {slides.map((s) => (
                        <HeroSlide
                            key={s.id} slide={s} width={`${100 / slideCount}%`}
                            navigate={navigate} onPlay={onPlay}
                            contentOpacity={trans.heroContentOpacity}
                            interactive={trans.heroInteractive}
                        />
                    ))}
                </div>

                <div style={{
                    position: 'absolute', left: '50%', bottom: 84, transform: 'translateX(-50%)',
                    display: 'flex', gap: 8, alignItems: 'center', zIndex: 5,
                    opacity: trans.heroContentOpacity,
                    pointerEvents: trans.heroInteractive ? 'auto' : 'none',
                    willChange: 'opacity'
                }}>
                    {slides.map((s, i) => (
                        <button
                            key={s.id}
                            onClick={() => goSlide(i)}
                            aria-label={`Slide ${i + 1}`}
                            style={{
                                width: i === idx ? 26 : 7, height: 2, borderRadius: 1,
                                background: i === idx ? '#fff' : 'rgba(255,255,255,0.32)',
                                border: 'none', cursor: 'pointer', padding: 0,
                                transition: 'width .5s cubic-bezier(.65,0,.35,1), background .3s'
                            }}
                        />
                    ))}
                </div>
            </section>

            {/* Espaciador en el flujo del documento para reservar los 100vh del Hero */}
            <div style={{ height: '100vh', pointerEvents: 'none' }} />

            {/* Capa de la biblioteca: sube suavemente sobre el Hero fijo al hacer scroll */}
            <div style={{
                position: 'relative', zIndex: 2,
                background: 'transparent',
                minHeight: '100vh'
            }}>
                <HomeLibrary
                    navigate={navigate}
                    titleOpacity={trans.titleOpacity}
                    titleTranslateY={trans.titleTranslateY}
                />
            </div>

            {/* Indicador de scroll en la base del hero */}
            <ScrollHint
                label={globalize.translate('HeaderMyLibrary')}
                opacity={trans.scrollHintOpacity}
                style={{ position: 'fixed', bottom: 32, zIndex: 10 }}
            />
        </div>
    );
}

const HeroSlide = React.memo(function HeroSlideBase({
    slide,
    width,
    navigate,
    onPlay,
    contentOpacity = 1,
    contentTranslateY = 0,
    interactive = true
}: {
    slide: CarouselSlide;
    width: string;
    navigate: Navigate;
    onPlay: () => void;
    contentOpacity?: number;
    contentTranslateY?: number;
    interactive?: boolean;
}) {
    const isContinue = slide.type === 'continue';
    // Propio y no heredado del padre: el hero rota, y quien sabe qué item toca
    // adelantar es el slide que se está pintando.
    const { prewarm } = usePlayer();
    const showData = PROTO_DATA.shows[slide.id] || PROTO_DATA.movies[slide.id];
    const logo = slide.logo ?? showData?.logo;
    // Menú contextual del slide: el mismo de la ficha, abierto con clic derecho
    // sin ir al botón. «Continuar» con id real de episodio se abre como tal; el
    // resto (novedades o modo prototipo) como serie o película según el `kind`.
    const ctx = useItemContextMenu({
        id: slide.jfEpisodeId ?? slide.id,
        type: slide.type === 'continue' && slide.jfEpisodeId ? 'episode' :
            (slide.kind === 'movie' ? 'movie' : 'show'),
        itemTitle: slide.title,
        queueSubtitle: isContinue && slide.season != null && slide.episode != null ?
            `T${slide.season} E${String(slide.episode).padStart(2, '0')}` :
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
                bottomFade={false}
                vignette={0.2}
            />

            <div style={{
                position: 'absolute', inset: 0, padding: '0 48px 110px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                textAlign: 'center',
                opacity: contentOpacity,
                transform: `translateY(${contentTranslateY}px)`,
                pointerEvents: interactive ? 'auto' : 'none',
                willChange: 'opacity, transform'
            }}>
                <TextButton
                    onClick={goDetail}
                    label={slide.title}
                    style={{ display: 'block', marginBottom: 18 }}
                >
                    {logo ? (
                        <img
                            src={logo}
                            alt={slide.title}
                            decoding='async'
                            style={{
                                maxWidth: 470, maxHeight: 160, width: 'auto', height: 'auto',
                                objectFit: 'contain', filter: 'drop-shadow(0 4px 50px rgba(0,0,0,0.6))'
                            }}
                        />
                    ) : (
                        <h1 style={{
                            fontFamily: T.display, fontSize: 'clamp(58px, 7vw, 116px)', lineHeight: 0.92,
                            margin: 0, fontWeight: 250, letterSpacing: -2,
                            textShadow: '0 4px 50px rgba(0,0,0,0.55)', textWrap: 'balance'
                        }}>
                            {slide.title}
                        </h1>
                    )}
                </TextButton>

                {/* Solo las series enseñan esta línea, porque lleva a algún
                    sitio: la temporada y el episodio por los que se iba. En
                    una película no había T·E que enseñar y quedaba un
                    «Seguir viendo» suelto que no decía nada — el propio botón
                    de reproducir ya avisa de que hay progreso, con su anillo y
                    los minutos restantes al pasar por encima. */}
                {isContinue && slide.season != null ? (
                    <div style={{
                        fontFamily: T.ui, fontSize: 14, color: 'rgba(255,255,255,0.72)',
                        marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12,
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
                            {/* "E6 · Inicio de semestre" es UN solo botón: el
                                número y el nombre son la misma cosa (el
                                capítulo) y llevaban ya al mismo sitio, así que
                                separarlos solo daba dos dianas pequeñas para un
                                único destino en vez de una cómoda. */}
                            {slide.episode != null && (
                                <>
                                    {' · '}
                                    <TextButton
                                        onClick={goEpisode}
                                        highlight
                                        style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                                    >
                                        {`E${slide.episode}`}
                                        {slide.episodeTitle && (
                                            <>
                                                <Ic.Dot />
                                                <span style={{
                                                    fontFamily: T.display, fontSize: 18
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
                        fontFamily: T.ui, fontSize: 12, color: 'rgba(255,255,255,0.65)',
                        marginBottom: 20, letterSpacing: 3, textTransform: 'uppercase'
                    }}>
                        {slide.year}
                    </div>
                )}

                <div style={{ marginBottom: isContinue ? 14 : 0 }}>
                    <PlayBtn
                        size={96}
                        onClick={onPlay}
                        // Solo los slides de «continuar viendo» abren el
                        // reproductor; los de «novedad» llevan a la ficha, y
                        // ahí no hay nada que calentar todavía.
                        onHover={() => slide.jfEpisodeId && prewarm(slide.jfEpisodeId)}
                        progress={isContinue ? slide.progress : null}
                        hoverText={isContinue ? formatRemainingCompact(slide.remaining) || null : null}
                    />
                </div>
            </div>
            {ctx.menu}
        </div>
    );
});

const HomeLibrary = React.memo(function HomeLibraryBase({
    navigate,
    titleOpacity,
    titleTranslateY
}: {
    navigate: Navigate;
    titleOpacity?: number;
    titleTranslateY?: number;
}) {
    const { session } = useSession();
    const jellyfinMode = !!session?.accessToken;
    if (jellyfinMode) {
        return (
            <HomeLibraryJellyfin
                navigate={navigate}
                titleOpacity={titleOpacity}
                titleTranslateY={titleTranslateY}
            />
        );
    }
    return (
        <HomeLibraryProto
            data={PROTO_DATA}
            navigate={navigate}
            titleOpacity={titleOpacity}
            titleTranslateY={titleTranslateY}
        />
    );
});

function HomeLibraryJellyfin({
    navigate,
    titleOpacity,
    titleTranslateY
}: {
    navigate: Navigate;
    titleOpacity?: number;
    titleTranslateY?: number;
}) {
    const r = useResponsive();
    const sectionStyle = {
        background: 'transparent',
        color: r.touch ? MC.fg : '#fff',
        paddingTop: 0,
        paddingBottom: r.touch ? 'calc(var(--jfp-viewport-h, 100vh) - 180px)' : 'calc(100vh - 240px)',
        fontFamily: T.ui
    } as const;

    const headingStyle = titleOpacity !== undefined ? {
        opacity: titleOpacity,
        transform: titleTranslateY ? `translateY(${titleTranslateY}px)` : undefined,
        willChange: 'opacity, transform'
    } : undefined;

    // homeVM.load() lo dispara HomePage al montar; aquí solo se leen signals.
    useVmSignals(homeVM, (vm) => [
        vm.shows, vm.movies, vm.showsLoading, vm.showsReady, vm.showsError
    ]);
    const series = homeVM.shows.value;
    const movies = homeVM.movies.value;
    if (homeVM.showsLoading.value || !homeVM.showsReady.value) {
        return (
            <section style={sectionStyle}>
                <SkeletonRow title={globalize.translate('Shows')} />
                <SkeletonRow title={globalize.translate('Movies')} />
            </section>
        );
    }
    if (homeVM.showsError.value) {
        return (
            <section style={{
                background: r.touch ? MC.bg : '#000', color: '#ff6b6b',
                padding: r.touch ? `48px ${r.pagePad}px` : '80px 56px',
                fontFamily: T.ui, fontSize: 14
            }}>
                {homeVM.showsError.value}
            </section>
        );
    }
    // Solo en táctil: en escritorio, Series y Películas ya están arriba en la
    // barra, y ahí el título de la fila nunca ha llevado a ningún sitio.
    const goSeries = r.touch ? () => navigate({ page: 'series' }) : undefined;
    const goMovies = r.touch ? () => navigate({ page: 'movies' }) : undefined;
    return (
        <section style={sectionStyle}>
            <Row title={globalize.translate('Shows')} onTitleClick={goSeries} headingStyle={headingStyle}>
                {series.length === 0 ? (
                    <div style={{ padding: r.touch ? `0 ${r.pagePad}px` : '0 56px', color: T.dim, fontSize: 14 }}>
                        {globalize.translate('MessageNoShowsInLibrary')}
                    </div>
                ) : (
                    <RowScroller>
                        {series.map((s) => <PosterCard key={s.id} slide={s} navigate={navigate} />)}
                    </RowScroller>
                )}
            </Row>
            {movies.length > 0 && (
                <Row title={globalize.translate('Movies')} onTitleClick={goMovies} headingStyle={headingStyle}>
                    <RowScroller>
                        {movies.map((m) => <MovieCard key={m.id} movie={m} navigate={navigate} />)}
                    </RowScroller>
                </Row>
            )}
        </section>
    );
}

function HomeLibraryProto({
    data,
    navigate,
    titleOpacity,
    titleTranslateY
}: {
    data: typeof PROTO_DATA;
    navigate: Navigate;
    titleOpacity?: number;
    titleTranslateY?: number;
}) {
    const r = useResponsive();
    const sectionStyle = {
        background: 'transparent',
        color: r.touch ? MC.fg : '#fff',
        paddingTop: 0,
        paddingBottom: r.touch ? 'calc(var(--jfp-viewport-h, 100vh) - 180px)' : 'calc(100vh - 240px)',
        fontFamily: T.ui
    } as const;

    const headingStyle = titleOpacity !== undefined ? {
        opacity: titleOpacity,
        transform: titleTranslateY ? `translateY(${titleTranslateY}px)` : undefined,
        willChange: 'opacity, transform'
    } : undefined;

    const cw = useMemo(() => data.carousel.filter((s) => s.type === 'continue'), [data.carousel]);
    const { movies, series, recent, hydrated } = useMemo(() => {
        const m = Object.values(data.movies);
        const s = Object.values(data.shows);
        const rec = [...m, ...s]
            .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
            .slice(0, 8);
        const hyd = [...s, ...m].some((x) => x.poster || x.backdrop);
        return { movies: m, series: s, recent: rec, hydrated: hyd };
    }, [data.movies, data.shows]);
    if (!hydrated) {
        return (
            <section style={sectionStyle}>
                <SkeletonRow title={globalize.translate('ContinueWatching')} />
                <SkeletonRow title={globalize.translate('TabLatest')} />
                <SkeletonRow title={globalize.translate('Movies')} />
                <SkeletonRow title={globalize.translate('Shows')} />
            </section>
        );
    }
    return (
        <section style={sectionStyle}>
            <Row title={globalize.translate('ContinueWatching')} headingStyle={headingStyle}>
                <RowScroller>
                    {cw.map((s) => <CwCard key={s.id} slide={s} navigate={navigate} />)}
                </RowScroller>
            </Row>
            <Row title={globalize.translate('TabLatest')} headingStyle={headingStyle}>
                <RowScroller>
                    {recent.map((item) =>
                        'seasons' in item ?
                            <PosterCard key={`s-${item.id}`} slide={item} navigate={navigate} /> :
                            <MovieCard key={`m-${item.id}`} movie={item} navigate={navigate} />
                    )}
                </RowScroller>
            </Row>
            <Row title={globalize.translate('Movies')} headingStyle={headingStyle}>
                <RowScroller>
                    {movies.map((m) => <MovieCard key={m.id} movie={m} navigate={navigate} />)}
                </RowScroller>
            </Row>
            <Row title={globalize.translate('Shows')} headingStyle={headingStyle}>
                <RowScroller>
                    {series.map((s) => <PosterCard key={s.id} slide={s} navigate={navigate} />)}
                </RowScroller>
            </Row>
        </section>
    );
}
