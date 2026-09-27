import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HeroSlide } from './HeroSlide';
import type { CarouselSlide } from '../../../domain/models';
import type { Navigate } from '../../../app/router';
import type { HeroTrailerState, TrailerSource } from '../../../domain/viewModels/HeroTrailerViewModel';

const WHEEL_THRESHOLD = 100;
const WHEEL_LOCK_MS = 900;
const WHEEL_RESET_MS = 150;

export const HeroCarousel = React.memo(function HeroCarouselBase({
    slides,
    idx,
    goSlide,
    navigate,
    onPlay,
    contentOpacity,
    interactive,
    backdropOpacity,
    trailerSource,
    trailerState,
    isMuted,
    isPaused,
    onToggleMute,
    onError
}: {
    slides: CarouselSlide[];
    idx: number;
    goSlide: (n: number) => void;
    navigate: Navigate;
    onPlay: () => void;
    contentOpacity: number;
    interactive: boolean;
    backdropOpacity: number;
    trailerSource: TrailerSource | null;
    trailerState: HeroTrailerState;
    isMuted: boolean;
    isPaused: boolean;
    onToggleMute: () => void;
    onError: () => void;
}) {
    const slideCount = slides.length;
    const [dragPct, setDragPct] = useState(0);
    const [dragging, setDragging] = useState(false);
    const heroRef = useRef<HTMLElement>(null);
    const dragStart = useRef<{ x: number; idx: number; width: number } | null>(null);
    const wheelAccum = useRef(0);
    const wheelLockRef = useRef(false);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('button, a, [data-jfp-nav]')) return;
        const width = heroRef.current?.clientWidth || window.innerWidth;
        setDragging(true);
        setDragPct(0);
        dragStart.current = { x: e.clientX, idx, width };
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }, [idx]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragging || !dragStart.current) return;
        const { x, width } = dragStart.current;
        setDragPct(((e.clientX - x) / width) * (100 / slideCount));
    }, [dragging, slideCount]);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        if (!dragging || !dragStart.current) return;
        const dxPct = dragPct * (slideCount / 100);
        let delta = 0;
        if (dxPct < -0.15) delta = 1;
        else if (dxPct > 0.15) delta = -1;
        if (delta !== 0) goSlide(idx + delta);
        setDragging(false);
        setDragPct(0);
        dragStart.current = null;
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    }, [dragging, dragPct, slideCount, idx, goSlide]);

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

    const baseTranslate = slideCount > 0 ? -idx * (100 / slideCount) : 0;

    return (
        <section
            ref={heroRef}
            onPointerDown={interactive ? onPointerDown : undefined}
            onPointerMove={interactive ? onPointerMove : undefined}
            onPointerUp={interactive ? onPointerUp : undefined}
            onPointerCancel={interactive ? onPointerUp : undefined}
            style={{
                position: 'fixed', top: 0, left: 0, height: '100vh', width: '100%', overflow: 'hidden',
                background: '#000',
                cursor: dragging ? 'grabbing' : (interactive ? 'grab' : 'default'),
                touchAction: 'pan-y',
                userSelect: 'none',
                zIndex: 1,
                opacity: backdropOpacity,
                pointerEvents: interactive ? 'auto' : 'none',
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
                {slides.map((s, i) => (
                    <HeroSlide
                        key={s.id} slide={s} width={`${100 / slideCount}%`}
                        navigate={navigate} onPlay={onPlay}
                        contentOpacity={contentOpacity}
                        interactive={interactive}
                        isActive={i === idx}
                        trailerSource={i === idx ? trailerSource : null}
                        trailerState={i === idx ? trailerState : 'idle'}
                        isMuted={isMuted}
                        isPaused={isPaused}
                        onToggleMute={onToggleMute}
                        onError={onError}
                    />
                ))}
            </div>

            <div style={{
                position: 'absolute', left: '50%', bottom: 140, transform: 'translateX(-50%)',
                display: 'flex', gap: 9, alignItems: 'center', zIndex: 5,
                opacity: contentOpacity,
                pointerEvents: interactive ? 'auto' : 'none',
                willChange: 'opacity'
            }}>
                {slides.map((s, i) => (
                    <button
                        key={s.id}
                        onClick={() => goSlide(i)}
                        aria-label={`Slide ${i + 1}`}
                        style={{
                            width: i === idx ? 29 : 8, height: 2, borderRadius: 1,
                            background: i === idx ? '#fff' : 'rgba(255,255,255,0.32)',
                            border: 'none', cursor: 'pointer', padding: 0,
                            transition: 'width .5s cubic-bezier(.65,0,.35,1), background .3s'
                        }}
                    />
                ))}
            </div>
        </section>
    );
});
