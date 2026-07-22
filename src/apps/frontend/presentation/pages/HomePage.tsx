import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { Row } from '../components/layout/Row';
import { CwCard } from '../components/cards/CwCard';
import { MovieCard } from '../components/cards/MovieCard';
import { PosterCard } from '../components/cards/PosterCard';
import { PlayBtn } from '../components/controls/PlayBtn';
import { SkeletonRow } from '../components/skeleton/Skeleton';
import { MobileHero } from '../components/home/MobileHero';
import { MC, useResponsive } from '../theme/responsive';
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

    useEffect(() => {
        if (paused || dragging || slideCount <= 1) return;
        const t = setTimeout(() => setIdx((n) => (n + 1) % slideCount), 8000);
        return () => clearTimeout(t);
    }, [idx, paused, dragging, slideCount]);

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
            <>
                <section style={{
                    position: 'relative',
                    height: r.touch ? (r.tablet ? '55vh' : '40vh') : '100vh',
                    width: '100%',
                    overflow: 'hidden', background: r.touch ? MC.surface : '#000'
                }}>
                    <Nav navigate={navigate} active='home' />
                </section>
                <HomeLibrary navigate={navigate} />
            </>
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

    // Mobile/tablet: hero compacto propio (40vh/55vh). El estado del
    // carrusel (idx, autoplay, goSlide) es el mismo que usa el de desktop.
    if (r.touch) {
        return (
            <>
                <Nav navigate={navigate} active='home' />
                <MobileHero
                    slides={slides}
                    idx={idx}
                    tablet={r.tablet}
                    goSlide={goSlide}
                    onPlay={onPlay}
                />
                <HomeLibrary navigate={navigate} />
            </>
        );
    }

    return (
        <>
            <section
                ref={heroRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={{
                    position: 'relative', height: '100vh', width: '100%', overflow: 'hidden',
                    background: '#000',
                    cursor: dragging ? 'grabbing' : 'grab',
                    touchAction: 'pan-y',
                    userSelect: 'none'
                }}
            >
                <Nav navigate={navigate} active='home' />

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
                        />
                    ))}
                </div>

                <div style={{
                    position: 'absolute', left: '50%', bottom: 92, transform: 'translateX(-50%)',
                    display: 'flex', gap: 8, alignItems: 'center', zIndex: 5
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

                <ScrollHint label='Tu biblioteca' />
            </section>

            <HomeLibrary navigate={navigate} />
        </>
    );
}

// Botón "de texto": mismo reset que los géneros clicables de ShowPage, para
// que T1/E1 y el logo del hero se vean como el resto del texto pero
// naveguen al pulsarlos.
const textBtnStyle: React.CSSProperties = {
    background: 'none', border: 'none', padding: 0,
    font: 'inherit', color: 'inherit',
    letterSpacing: 'inherit', textTransform: 'inherit',
    cursor: 'pointer'
};

const HeroSlide = React.memo(function HeroSlideBase({
    slide,
    width,
    navigate,
    onPlay
}: {
    slide: CarouselSlide;
    width: string;
    navigate: Navigate;
    onPlay: () => void;
}) {
    const isContinue = slide.type === 'continue';
    const showData = PROTO_DATA.shows[slide.id] || PROTO_DATA.movies[slide.id];
    const logo = slide.logo ?? showData?.logo;
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
        <div style={{ width, height: '100%', position: 'relative', flexShrink: 0 }}>
            {/* itemId: aplica el fondo personalizado guardado en local para
                ese item (el mismo que usa la ficha) — sin él, cambiar la
                imagen se veía en la ficha pero no aquí.
                srcs: rota entre todos los fondos que tenga el item. */}
            <Backdrop
                src={slide.backdrop} srcs={slide.backdrops}
                itemId={slide.id} sharp
            />

            <div style={{
                position: 'absolute', inset: 0, padding: '0 48px 110px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                textAlign: 'center'
            }}>
                {logo ? (
                    <button
                        onClick={goDetail}
                        onMouseDown={(e) => e.preventDefault()}
                        aria-label={slide.title}
                        style={{ ...textBtnStyle, display: 'block', marginBottom: 18 }}
                    >
                        <img
                            src={logo}
                            alt={slide.title}
                            decoding='async'
                            style={{
                                maxWidth: 520, maxHeight: 180, width: 'auto', height: 'auto',
                                objectFit: 'contain', filter: 'drop-shadow(0 4px 50px rgba(0,0,0,0.6))'
                            }}
                        />
                    </button>
                ) : (
                    <button
                        onClick={goDetail}
                        onMouseDown={(e) => e.preventDefault()}
                        style={{ ...textBtnStyle, display: 'block', marginBottom: 18 }}
                    >
                        <h1 style={{
                            fontFamily: T.display, fontSize: 'clamp(64px, 8vw, 130px)', lineHeight: 0.92,
                            margin: 0, fontWeight: 250, letterSpacing: -2,
                            textShadow: '0 4px 50px rgba(0,0,0,0.55)', textWrap: 'balance'
                        }}>
                            {slide.title}
                        </h1>
                    </button>
                )}

                {isContinue ? (
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
                            {/* Películas: no hay T·E, solo la etiqueta de continuar. */}
                            {slide.season != null ? (
                                <>
                                    <button
                                        onClick={goSeason}
                                        onMouseDown={(e) => e.preventDefault()}
                                        style={textBtnStyle}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = '')}
                                    >
                                        {`T${slide.season}`}
                                    </button>
                                    {' · '}
                                    <button
                                        onClick={goEpisode}
                                        onMouseDown={(e) => e.preventDefault()}
                                        style={textBtnStyle}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = '')}
                                    >
                                        {`E${slide.episode}`}
                                    </button>
                                </>
                            ) : 'Continuar viendo'}
                        </span>
                        {slide.episodeTitle && (
                            <>
                                <Ic.Dot />
                                <span style={{ fontStyle: 'italic', fontFamily: T.display, fontSize: 18 }}>
                                    {slide.episodeTitle}
                                </span>
                            </>
                        )}
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
                        size={108}
                        onClick={onPlay}
                        progress={isContinue ? slide.progress : null}
                        hoverText={isContinue ? formatRemainingCompact(slide.remaining) || null : null}
                    />
                </div>
            </div>
        </div>
    );
});

const HomeLibrary = React.memo(function HomeLibraryBase({ navigate }: { navigate: Navigate }) {
    const { session } = useSession();
    const jellyfinMode = !!session?.accessToken;
    if (jellyfinMode) {
        return <HomeLibraryJellyfin navigate={navigate} />;
    }
    return <HomeLibraryProto data={PROTO_DATA} navigate={navigate} />;
});

function HomeLibraryJellyfin({ navigate }: { navigate: Navigate }) {
    const r = useResponsive();
    const rowGap = r.touch ? r.gap : 24;
    const sectionStyle = {
        background: r.touch ? MC.bg : '#000',
        color: r.touch ? MC.fg : '#fff',
        paddingBottom: r.touch ? 48 : 96,
        fontFamily: T.ui
    } as const;
    // homeVM.load() lo dispara HomePage al montar; aquí solo se leen signals.
    useVmSignals(homeVM, (vm) => [
        vm.shows, vm.movies, vm.showsLoading, vm.showsReady, vm.showsError
    ]);
    const series = homeVM.shows.value;
    const movies = homeVM.movies.value;
    if (homeVM.showsLoading.value || !homeVM.showsReady.value) {
        return (
            <section style={sectionStyle}>
                <SkeletonRow title='Series' />
                <SkeletonRow title='Películas' />
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
    return (
        <section style={sectionStyle}>
            <Row title='Series'>
                {series.length === 0 ? (
                    <div style={{ padding: r.touch ? `0 ${r.pagePad}px` : '0 56px', color: T.dim, fontSize: 14 }}>
                        No hay series en la biblioteca. Añade contenido y lanza un rescan desde
                        el panel de administración (avatar arriba a la derecha).
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: rowGap, overflowX: 'auto' }}>
                        {series.map((s) => <PosterCard key={s.id} slide={s} navigate={navigate} />)}
                    </div>
                )}
            </Row>
            {movies.length > 0 && (
                <Row title='Películas'>
                    <div style={{ display: 'flex', gap: rowGap, overflowX: 'auto' }}>
                        {movies.map((m) => <MovieCard key={m.id} movie={m} navigate={navigate} />)}
                    </div>
                </Row>
            )}
        </section>
    );
}

function HomeLibraryProto({
    data, navigate
}: {
    data: typeof PROTO_DATA; navigate: Navigate;
}) {
    const r = useResponsive();
    const rowGap = r.touch ? r.gap : 24;
    const cw = data.carousel.filter((s) => s.type === 'continue');
    const movies = Object.values(data.movies);
    const series = Object.values(data.shows);
    const recent = [...movies, ...series]
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
        .slice(0, 8);
    const hydrated = [...series, ...movies].some((x) => x.poster || x.backdrop);
    if (!hydrated) {
        return (
            <section style={{
                background: r.touch ? MC.bg : '#000', color: r.touch ? MC.fg : '#fff',
                paddingBottom: r.touch ? 48 : 96, fontFamily: T.ui
            }}>
                <SkeletonRow title='Continuar viendo' />
                <SkeletonRow title='Recién añadidos' />
                <SkeletonRow title='Películas' />
                <SkeletonRow title='Series' />
            </section>
        );
    }
    return (
        <section style={{
            background: r.touch ? MC.bg : '#000', color: r.touch ? MC.fg : '#fff',
            paddingBottom: r.touch ? 48 : 96, fontFamily: T.ui
        }}>
            <Row title='Continuar viendo'>
                <div style={{ display: 'flex', gap: rowGap, overflowX: 'auto' }}>
                    {cw.map((s) => <CwCard key={s.id} slide={s} navigate={navigate} />)}
                </div>
            </Row>
            <Row title='Recién añadidos'>
                <div style={{ display: 'flex', gap: rowGap, overflowX: 'auto' }}>
                    {recent.map((item) =>
                        'seasons' in item ?
                            <PosterCard key={`s-${item.id}`} slide={item} navigate={navigate} /> :
                            <MovieCard key={`m-${item.id}`} movie={item} navigate={navigate} />
                    )}
                </div>
            </Row>
            <Row title='Películas'>
                <div style={{ display: 'flex', gap: rowGap, overflowX: 'auto' }}>
                    {movies.map((m) => <MovieCard key={m.id} movie={m} navigate={navigate} />)}
                </div>
            </Row>
            <Row title='Series'>
                <div style={{ display: 'flex', gap: rowGap, overflowX: 'auto' }}>
                    {series.map((s) => <PosterCard key={s.id} slide={s} navigate={navigate} />)}
                </div>
            </Row>
        </section>
    );
}
