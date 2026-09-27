import globalize from 'lib/globalize';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C, T } from '../theme/tokens';
import { Ic } from '../theme/icons';
import { formatEpisodeCode, formatRemainingCompact } from '../utils/format';
import { PROTO_DATA, type CarouselSlide } from '../../domain/models';
import { homeVM } from '../../domain/viewModels/HomeViewModel';
import { heroTrailerVM, type HeroTrailerState, type TrailerSource } from '../../domain/viewModels/HeroTrailerViewModel';
import { COLLECTION_STYLES } from '../../domain/stores';
import { useVmSignals } from '../../domain/bridge/useViewModel';
import { useSession } from '../../domain/bridge/useSession';
import { usePlayer } from '../components/player/PlayerProvider';
import { Backdrop } from '../components/layout/Backdrop';
import { Nav } from '../components/layout/Nav';
import { MobileHero } from '../components/home/MobileHero';
import { HeroCarousel } from '../components/home/HeroCarousel';
import { HomeLibrary } from '../components/home/HomeLibrary';
import { useLandscape, useResponsive } from '../theme/responsive';
import { useHomeScrollTransition } from '../hooks/useHomeScrollTransition';

import type { Navigate } from '../../app/router';

const HERO_AUTOPLAY_MS = 8000;
const WHEEL_THRESHOLD = 100;
const WHEEL_LOCK_MS = 900;
const WHEEL_RESET_MS = 150;

const ROOT_PAGE_STYLE: React.CSSProperties = { position: 'relative', width: '100%', minHeight: '100vh', background: '#000' };
const EMPTY_PAGE_STYLE: React.CSSProperties = { background: '#000', color: '#fff', minHeight: '100vh' };
const SPACER_80_STYLE: React.CSSProperties = { height: 80 };
const TOUCH_SPACER_STYLE: React.CSSProperties = { height: 'var(--jfp-viewport-h, 100vh)', pointerEvents: 'none' };
const SPACER_100VH_STYLE: React.CSSProperties = { height: 'calc(100vh - 160px)', pointerEvents: 'none' };
const HERO_VIGNETTE_STYLE: React.CSSProperties = { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0.65) 75%, rgba(0,0,0,0.95) 92%, #000 100%)', pointerEvents: 'none' };
const HERO_LOADING_TOUCH_STYLE: React.CSSProperties = { position: 'relative', height: 'var(--jfp-viewport-h, 100vh)', marginLeft: 'calc(-1 * var(--jfp-nav-left, 0px))', width: 'calc(100% + var(--jfp-nav-left, 0px))', overflow: 'hidden', background: '#000' };
const HERO_LOADING_DESKTOP_STYLE: React.CSSProperties = { position: 'relative', height: '100vh', width: '100%', overflow: 'hidden', background: '#000' };

export function HomePage({ navigate }: { navigate: Navigate }) {
    const { session } = useSession();
    const { play } = usePlayer();
    const r = useResponsive();
    const landscape = useLandscape();
    const jellyfinMode = !!session?.accessToken;
    // En modo Jellyfin el carrusel se construye con datos reales (continuar
    // viendo + últimas series); en modo prototipo, con PROTO_DATA.
    // Solo los signals del hero: cargar la biblioteca no re-pinta el carrusel.
    useVmSignals(homeVM, (vm) => [vm.slides, vm.heroLoading, vm.heroReady]);
    useVmSignals(heroTrailerVM, (vm) => [vm.state, vm.trailerSource, vm.isMuted, vm.isPaused]);
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

    // Notifica el slide activo actual al ViewModel del trailer
    useEffect(() => {
        const curSlide = slides[idx];
        heroTrailerVM.onSlideChanged(curSlide);
        return () => {
            heroTrailerVM.reset();
        };
    }, [idx, slides]);

    // Pausa el carrusel durante arrastre, pausa manual, reproducción de trailer
    // o cuando el hero queda fuera de pantalla al hacer scroll, ahorrando ciclos de CPU/batería.
    const isTrailerPlaying = heroTrailerVM.state.value !== 'idle';
    useEffect(() => {
        if (paused || dragging || slideCount <= 1 || trans.isHeroOffscreen || isTrailerPlaying) return;
        const t = setTimeout(() => setIdx((n) => (n + 1) % slideCount), HERO_AUTOPLAY_MS);
        return () => clearTimeout(t);
    }, [idx, paused, dragging, slideCount, trans.isHeroOffscreen, isTrailerPlaying]);

    // Pausar el tráiler si se hace scroll hacia abajo en la Home
    useEffect(() => {
        heroTrailerVM.onHeroOffscreen(trans.progress > 0);
    }, [trans.progress]);

    const goSlide = useCallback(
        (n: number) => {
            heroTrailerVM.reset();
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
        let lockTimer: ReturnType<typeof setTimeout> | null = null;
        const onWheel = (e: WheelEvent) => {
            if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.2) return;
            e.preventDefault();
            if (wheelLockRef.current) {
                if (resetTimer) clearTimeout(resetTimer);
                resetTimer = setTimeout(() => { wheelAccum.current = 0; }, WHEEL_RESET_MS);
                return;
            }
            wheelAccum.current += e.deltaX;
            if (Math.abs(wheelAccum.current) > WHEEL_THRESHOLD) {
                const dir = wheelAccum.current > 0 ? 1 : -1;
                goSlide(idx + dir);
                wheelAccum.current = 0;
                wheelLockRef.current = true;
                if (lockTimer) clearTimeout(lockTimer);
                lockTimer = setTimeout(() => { wheelLockRef.current = false; }, WHEEL_LOCK_MS);
            }
            if (resetTimer) clearTimeout(resetTimer);
            resetTimer = setTimeout(() => { wheelAccum.current = 0; }, WHEEL_RESET_MS);
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            el.removeEventListener('wheel', onWheel);
            if (resetTimer) clearTimeout(resetTimer);
            if (lockTimer) clearTimeout(lockTimer);
        };
    }, [idx, goSlide]);

    // Referencia al idx actual para que onPlay sea estable entre ticks del
    // autoplay. Si onPlay se recrease cada 8s, los HeroSlide memoizados se
    // re-renderizarían todos por el cambio de prop.
    const idxRef = useRef(idx);
    idxRef.current = idx;
    const onPlay = useCallback(async () => {
        const cur = slides[idxRef.current];
        if (!cur) return;
        const req = await homeVM.getPlayable(cur);
        if (req) {
            play(req);
        } else if (cur.kind === 'movie') {
            navigate({ page: 'movie', movieId: cur.id });
        } else {
            navigate({ page: 'show', showId: cur.id });
        }
    }, [slides, navigate, play]);

    const onToggleMute = useCallback(() => heroTrailerVM.toggleMute(), []);
    const onTrailerError = useCallback(() => heroTrailerVM.onError(), []);

    const baseTranslate = slideCount > 0 ? -idx * (100 / slideCount) : 0;

    // Mientras carga el carrusel real, reservamos el alto del hero para que la
    // biblioteca no "salte" cuando lleguen los slides.
    if (heroLoading) {
        return (
            <div style={ROOT_PAGE_STYLE}>
                <Nav navigate={navigate} active='home' />
                <section style={r.touch ? HERO_LOADING_TOUCH_STYLE : HERO_LOADING_DESKTOP_STYLE} />
                <HomeLibrary navigate={navigate} />
            </div>
        );
    }

    // Sin slides (biblioteca vacía o error): saltamos el hero y pintamos
    // directamente la Nav sticky + biblioteca.
    if (slideCount === 0) {
        return (
            <div style={EMPTY_PAGE_STYLE}>
                <Nav navigate={navigate} active='home' />
                <div style={SPACER_80_STYLE} />
                <HomeLibrary navigate={navigate} />
            </div>
        );
    }

    // Mobile/tablet: hero táctil con transición suave y fijo al deslizar.
    if (r.touch) {
        const touchHeroHeight = landscape ? 'var(--jfp-viewport-h, 100vh)' : 'calc(var(--jfp-viewport-h, 100vh) * 0.55)';
        return (
            <div style={ROOT_PAGE_STYLE}>
                <Nav navigate={navigate} active='home' />
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1,
                    height: touchHeroHeight,
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
                        trailerSource={heroTrailerVM.trailerSource.value}
                        trailerState={heroTrailerVM.state.value}
                        isMuted={heroTrailerVM.isMuted.value}
                        isPaused={heroTrailerVM.isPaused.value}
                        onToggleMute={onToggleMute}
                        onError={onTrailerError}
                    />
                </div>
                <div style={{ height: touchHeroHeight, pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 2, background: 'transparent', minHeight: '100vh' }}>
                    <HomeLibrary
                        navigate={navigate}
                        titleOpacity={landscape ? trans.titleOpacity : 1}
                        titleTranslateY={landscape ? trans.titleTranslateY : 0}
                    />
                </div>
            </div>
        );
    }

    return (
        <div style={ROOT_PAGE_STYLE}>
            <Nav navigate={navigate} active='home' />
            <HeroCarousel
                slides={slides}
                idx={idx}
                goSlide={goSlide}
                navigate={navigate}
                onPlay={onPlay}
                contentOpacity={trans.heroContentOpacity}
                interactive={trans.heroInteractive}
                backdropOpacity={trans.heroBackdropOpacity}
                trailerSource={heroTrailerVM.trailerSource.value}
                trailerState={heroTrailerVM.state.value}
                isMuted={heroTrailerVM.isMuted.value}
                isPaused={heroTrailerVM.isPaused.value}
                onToggleMute={onToggleMute}
                onError={onTrailerError}
            />
            {/* Espaciador en el flujo del documento para reservar el espacio del Hero dejando asomar la primera fila */}
            <div style={SPACER_100VH_STYLE} />

            {/* Capa de la biblioteca: sube suavemente sobre el Hero fijo al hacer scroll */}
            <div style={{ position: 'relative', zIndex: 2, background: 'transparent', minHeight: '100vh' }}>
                <HomeLibrary navigate={navigate} />
            </div>
        </div>
    );
}
