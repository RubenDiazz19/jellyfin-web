// Capa de gestos táctiles del reproductor — se monta SOLO en mobile/tablet
// (VideoPlayer decide). En desktop no existe y el OSD sigue funcionando con
// ratón + teclado como hasta ahora.
//
// Gestos (spec 5.1):
//   · Tap ................. play/pausa (y despierta el OSD)
//   · Doble tap izq/der ... seek ∓10 s; centro ... pantalla completa
//   · Swipe horizontal .... seek con preview (aplica al soltar)
//   · Swipe vertical izq .. brillo · der .. volumen
//   · Pinch ............... aspect ratio (contener ↔ rellenar)
//   · Swipe abajo (borde superior) ... cerrar el reproductor

import { useRef, useState } from 'react';

import { videoPlayerVM } from '../../../domain/viewModels/VideoPlayerViewModel';
import { haptic } from '../../../shared/haptics';
import {
    classifySwipe,
    clamp01,
    CLOSE_BAND,
    CLOSE_DISTANCE,
    gestureZone,
    MOVE_THRESHOLD,
    pinchScale,
    seekDeltaFromDrag,
    touchDistance,
    verticalControl,
    verticalDelta,
    type SwipeAxis
} from '../../../shared/videoGestures';
import { PlayerIc } from './playerIcons';

const DOUBLE_TAP_MS = 300;

type Feedback =
    | { kind: 'seek'; target: number; delta: number }
    | { kind: 'brightness'; value: number }
    | { kind: 'volume'; value: number }
    | { kind: 'double'; dir: 'back' | 'forward' }
    | null;

type Props = {
    onClose: () => void;
    onWake: () => void;
};

function fmt(t: number): string {
    if (!Number.isFinite(t) || t < 0) t = 0;
    const s = Math.floor(t % 60);
    const m = Math.floor((t / 60) % 60);
    const h = Math.floor(t / 3600);
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    const hh = h > 0 ? `${h}:` : '';
    return `${hh}${mm}:${String(s).padStart(2, '0')}`;
}

export function VideoGestures({ onClose, onWake }: Props) {
    const layerRef = useRef<HTMLDivElement>(null);
    const [feedback, setFeedback] = useState<Feedback>(null);

    // Estado del gesto en curso (fuera de React: se lee/escribe cada move sin
    // provocar renders; el render solo lo dispara `feedback`).
    const g = useRef({
        active: false,
        axis: 'none' as SwipeAxis,
        // Cliente (para deltas) y relativo a la capa (para zonas).
        startClientX: 0,
        startClientY: 0,
        startX: 0,
        startY: 0,
        width: 1,
        height: 1,
        startTime: 0,
        startVolume: 1,
        startBrightness: 1,
        control: 'volume' as 'brightness' | 'volume',
        fromCloseBand: false,
        closing: false,
        pendingSeek: null as number | null,
        // pinch
        pinching: false,
        pinchStart: 0,
        // taps
        lastTapTime: 0,
        lastTapX: 0,
        moved: false
    });
    const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flashFeedback = (f: Feedback, ms = 650) => {
        setFeedback(f);
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => setFeedback(null), ms);
    };

    const onTouchStart = (e: React.TouchEvent) => {
        const rect = layerRef.current?.getBoundingClientRect();
        const width = rect?.width || window.innerWidth;
        const height = rect?.height || window.innerHeight;

        if (e.touches.length === 2) {
            g.current.pinching = true;
            g.current.active = false;
            g.current.pinchStart = touchDistance(e.touches[0], e.touches[1]);
            return;
        }

        const t = e.touches[0];
        const x = t.clientX - (rect?.left ?? 0);
        const y = t.clientY - (rect?.top ?? 0);
        g.current = {
            ...g.current,
            active: true,
            pinching: false,
            axis: 'none',
            startClientX: t.clientX,
            startClientY: t.clientY,
            startX: x,
            startY: y,
            width,
            height,
            startTime: videoPlayerVM.currentTime.peek(),
            startVolume: videoPlayerVM.volume.peek(),
            startBrightness: videoPlayerVM.brightness.peek(),
            control: verticalControl(x, width),
            fromCloseBand: y < height * CLOSE_BAND,
            closing: false,
            pendingSeek: null,
            moved: false
        };
    };

    const onTouchMove = (e: React.TouchEvent) => {
        const s = g.current;

        if (s.pinching && e.touches.length === 2) {
            const scale = pinchScale(s.pinchStart, touchDistance(e.touches[0], e.touches[1]));
            if (scale > 1.15) videoPlayerVM.setAspectRatio('cover');
            else if (scale < 0.85) videoPlayerVM.setAspectRatio('auto');
            return;
        }
        if (!s.active) return;

        const t = e.touches[0];
        const dx = t.clientX - s.startClientX;
        const dy = t.clientY - s.startClientY;

        if (Math.max(Math.abs(dx), Math.abs(dy)) > MOVE_THRESHOLD) s.moved = true;

        // Fija el eje la primera vez que se supera el umbral.
        if (s.axis === 'none') {
            s.axis = classifySwipe(dx, dy);
            if (s.axis === 'none') return;
        }

        if (s.axis === 'horizontal') {
            const duration = videoPlayerVM.duration.peek();
            if (duration <= 0) return;
            const target = Math.min(Math.max(s.startTime + seekDeltaFromDrag(dx, s.width), 0), duration);
            s.pendingSeek = target;
            setFeedback({ kind: 'seek', target, delta: target - s.startTime });
            return;
        }

        // Vertical: swipe-abajo desde la banda superior → cerrar.
        if (s.fromCloseBand && dy > CLOSE_DISTANCE) {
            s.closing = true;
            setFeedback(null);
            return;
        }
        s.closing = false;

        if (s.control === 'brightness') {
            const v = clamp01(s.startBrightness + verticalDelta(dy, s.height));
            videoPlayerVM.setBrightness(v);
            setFeedback({ kind: 'brightness', value: videoPlayerVM.brightness.peek() });
        } else {
            const v = clamp01(s.startVolume + verticalDelta(dy, s.height));
            videoPlayerVM.setVolume(v);
            setFeedback({ kind: 'volume', value: v });
        }
    };

    const onTouchEnd = () => {
        const s = g.current;

        if (s.pinching) {
            s.pinching = false;
            return;
        }
        if (!s.active) return;
        s.active = false;

        if (s.axis === 'horizontal' && s.pendingSeek != null) {
            videoPlayerVM.seek(s.pendingSeek);
            flashFeedback({ kind: 'seek', target: s.pendingSeek, delta: s.pendingSeek - s.startTime }, 500);
            onWake();
            return;
        }
        if (s.axis === 'vertical') {
            if (s.closing) { haptic('select'); onClose(); return; }
            // El feedback de brillo/volumen se auto-oculta.
            if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
            feedbackTimer.current = setTimeout(() => setFeedback(null), 500);
            return;
        }

        // Sin desplazamiento significativo → es un tap.
        if (!s.moved) handleTap(s.startX, s.width);
    };

    const handleTap = (x: number, width: number) => {
        const zone = gestureZone(x, width);
        const now = Date.now();
        const isDouble = now - g.current.lastTapTime < DOUBLE_TAP_MS
            && gestureZone(g.current.lastTapX, width) === zone;

        if (isDouble) {
            if (singleTapTimer.current) { clearTimeout(singleTapTimer.current); singleTapTimer.current = null; }
            g.current.lastTapTime = 0;
            if (zone === 'left') {
                haptic('tick');
                videoPlayerVM.seekBy(-10);
                flashFeedback({ kind: 'double', dir: 'back' }, 550);
            } else if (zone === 'right') {
                haptic('tick');
                videoPlayerVM.seekBy(10);
                flashFeedback({ kind: 'double', dir: 'forward' }, 550);
            } else {
                videoPlayerVM.toggleFullscreen();
            }
            return;
        }

        g.current.lastTapTime = now;
        g.current.lastTapX = x;

        if (zone === 'center') {
            // Centro: respuesta inmediata (no hay doble-tap de seek aquí).
            videoPlayerVM.togglePlay();
            onWake();
            return;
        }
        // Laterales: espera por un posible segundo tap antes de play/pausa.
        if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
        singleTapTimer.current = setTimeout(() => {
            videoPlayerVM.togglePlay();
            onWake();
            singleTapTimer.current = null;
        }, DOUBLE_TAP_MS);
    };

    return (
        <div
            ref={layerRef}
            className='jfp-video-gestures'
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
        >
            {feedback && <GestureFeedback feedback={feedback} />}
        </div>
    );
}

function GestureFeedback({ feedback }: { feedback: NonNullable<Feedback> }) {
    if (feedback.kind === 'double') {
        return (
            <div className={`jfp-gesture-double jfp-gesture-double-${feedback.dir}`}>
                <span className='jfp-gesture-double-icon'>
                    {feedback.dir === 'back' ? <PlayerIc.Replay10 size={34} /> : <PlayerIc.Forward10 size={34} />}
                </span>
                <span className='jfp-gesture-double-label'>10s</span>
            </div>
        );
    }

    if (feedback.kind === 'seek') {
        const sign = feedback.delta >= 0 ? '+' : '−';
        return (
            <div className='jfp-gesture-pill'>
                <div className='jfp-gesture-seek-time'>{fmt(feedback.target)}</div>
                <div className='jfp-gesture-seek-delta'>
                    {sign}{fmt(Math.abs(feedback.delta))}
                </div>
            </div>
        );
    }

    const pct = Math.round(feedback.value * 100);
    return (
        <div className='jfp-gesture-pill'>
            <span className='jfp-gesture-bar-icon'>
                {feedback.kind === 'brightness' ?
                    <PlayerIc.Brightness size={20} /> :
                    (pct === 0 ? <PlayerIc.VolumeMuted size={20} /> : <PlayerIc.VolumeHigh size={20} />)}
            </span>
            <div className='jfp-gesture-bar'>
                <div className='jfp-gesture-bar-fill' style={{ width: `${pct}%` }} />
            </div>
            <span className='jfp-gesture-bar-pct'>{pct}</span>
        </div>
    );
}
