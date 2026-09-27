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

import { useEffect, useRef, useState } from 'react';

import { formatTime as fmt } from '../../../domain/player/format';
import { videoPlayerVM } from '../../../domain/viewModels/VideoPlayerViewModel';
import { haptic } from '../../../shared/haptics';
import { clamp } from '../../../shared/math';
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
const DEFAULT_FEEDBACK_MS = 650;
const SHORT_FEEDBACK_MS = 500;

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

export function VideoGestures({ onClose, onWake }: Props) {
    const layerRef = useRef<HTMLDivElement>(null);
    const [feedback, setFeedback] = useState<Feedback>(null);

    const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rAF = useRef<number>(0);

    useEffect(() => () => {
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
        if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
        if (rAF.current) cancelAnimationFrame(rAF.current);
    }, []);

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

    const flashFeedback = (f: Feedback, ms = DEFAULT_FEEDBACK_MS) => {
        setFeedback(f);
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => setFeedback(null), ms);
    };

    const onTouchStart = (e: React.TouchEvent) => {
        const rect = layerRef.current?.getBoundingClientRect();
        const width = rect?.width || window.innerWidth;
        const height = rect?.height || window.innerHeight;

        if (e.touches.length >= 2) {
            g.current.pinching = true;
            g.current.active = false;
            g.current.pinchStart = touchDistance(e.touches[0], e.touches[1]);
            return;
        }

        const t = e.touches[0];
        const x = t.clientX - (rect?.left ?? 0);
        const y = t.clientY - (rect?.top ?? 0);
        g.current.active = true;
        g.current.pinching = false;
        g.current.axis = 'none';
        g.current.startClientX = t.clientX;
        g.current.startClientY = t.clientY;
        g.current.startX = x;
        g.current.startY = y;
        g.current.width = width;
        g.current.height = height;
        g.current.startTime = videoPlayerVM.currentTime.peek();
        g.current.startVolume = videoPlayerVM.volume.peek();
        g.current.startBrightness = videoPlayerVM.brightness.peek();
        g.current.control = verticalControl(x, width);
        g.current.fromCloseBand = y < height * CLOSE_BAND;
        g.current.closing = false;
        g.current.pendingSeek = null;
        g.current.moved = false;
    };

    const onTouchMove = (e: React.TouchEvent) => {
        const s = g.current;

        if (s.pinching) {
            if (e.touches.length >= 2) {
                const scale = pinchScale(s.pinchStart, touchDistance(e.touches[0], e.touches[1]));
                if (scale > 1.15) {
                    videoPlayerVM.setAspectRatio('cover');
                    s.pinchStart = touchDistance(e.touches[0], e.touches[1]);
                } else if (scale < 0.85) {
                    videoPlayerVM.setAspectRatio('auto');
                    s.pinchStart = touchDistance(e.touches[0], e.touches[1]);
                }
            }
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

        s.width = window.innerWidth;
        s.height = window.innerHeight;

        if (s.axis === 'horizontal') {
            const duration = videoPlayerVM.duration.peek();
            if (duration <= 0) return;
            const target = clamp(s.startTime + seekDeltaFromDrag(dx, s.width), 0, duration);
            s.pendingSeek = target;
            if (!rAF.current) {
                rAF.current = requestAnimationFrame(() => {
                    rAF.current = 0;
                    setFeedback({ kind: 'seek', target, delta: target - s.startTime });
                });
            }
            return;
        }

        // Vertical: swipe-abajo desde la banda superior → cerrar.
        if (s.axis === 'vertical' && s.fromCloseBand && dy > CLOSE_DISTANCE) {
            s.closing = true;
            if (!rAF.current) {
                rAF.current = requestAnimationFrame(() => {
                    rAF.current = 0;
                    setFeedback(null);
                });
            }
            return;
        }
        s.closing = false;

        const currentControl = verticalControl(t.clientX, s.width);
        if (currentControl !== s.control) {
            s.control = currentControl;
            s.startY = t.clientY;
            s.startClientY = t.clientY;
            s.startBrightness = videoPlayerVM.brightness.peek();
            s.startVolume = videoPlayerVM.volume.peek();
        }

        if (s.control === 'brightness') {
            const v = clamp01(s.startBrightness + verticalDelta(t.clientY - s.startClientY, s.height));
            videoPlayerVM.setBrightness(v);
            if (!rAF.current) {
                rAF.current = requestAnimationFrame(() => {
                    rAF.current = 0;
                    setFeedback({ kind: 'brightness', value: videoPlayerVM.brightness.peek() });
                });
            }
        } else {
            const v = clamp01(s.startVolume + verticalDelta(t.clientY - s.startClientY, s.height));
            videoPlayerVM.setVolume(v);
            if (!rAF.current) {
                rAF.current = requestAnimationFrame(() => {
                    rAF.current = 0;
                    setFeedback({ kind: 'volume', value: v });
                });
            }
        }
    };

    const onTouchEnd = (e: React.TouchEvent) => {
        const s = g.current;

        if (s.pinching) {
            if (e.touches.length < 2) s.pinching = false;
            return;
        }
        if (!s.active) return;
        if (e.touches.length > 0) return;
        s.active = false;

        if (s.axis === 'horizontal' && s.pendingSeek != null) {
            videoPlayerVM.seek(s.pendingSeek);
            flashFeedback({ kind: 'seek', target: s.pendingSeek, delta: s.pendingSeek - s.startTime }, SHORT_FEEDBACK_MS);
            onWake();
            return;
        }
        if (s.axis === 'vertical') {
            if (s.closing) { haptic('select'); onClose(); return; }
            // El feedback de brillo/volumen se auto-oculta.
            if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
            feedbackTimer.current = setTimeout(() => setFeedback(null), SHORT_FEEDBACK_MS);
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
                videoPlayerVM.skipBackward();
                flashFeedback({ kind: 'double', dir: 'back' }, 550);
            } else if (zone === 'right') {
                haptic('tick');
                videoPlayerVM.skipForward();
                flashFeedback({ kind: 'double', dir: 'forward' }, 550);
            } else {
                videoPlayerVM.toggleFullscreen();
            }
            return;
        }

        g.current.lastTapTime = now;
        g.current.lastTapX = x;

        // Espera por un posible segundo tap antes de play/pausa.
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
        // Cuánto ha saltado de verdad: el doble toque usa la longitud que el
        // usuario haya puesto en Ajustes, y el aviso tiene que decir esa.
        const skip = videoPlayerVM.skip.peek();
        const seconds = feedback.dir === 'back' ? skip.back : skip.forward;
        return (
            <div className={`jfp-gesture-double jfp-gesture-double-${feedback.dir}`}>
                <span className='jfp-gesture-double-icon'>
                    {feedback.dir === 'back' ?
                        <PlayerIc.Replay size={34} seconds={seconds} /> :
                        <PlayerIc.Forward size={34} seconds={seconds} />}
                </span>
                <span className='jfp-gesture-double-label'>{seconds}s</span>
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
