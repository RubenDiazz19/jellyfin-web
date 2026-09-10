import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { videoPlayerVM } from '../../../domain/viewModels/VideoPlayerViewModel';
import { pointInRect } from './VideoPlayer';

const HIDE_CONTROLS_MS = 3000;
const SKIP_VISIBLE_MS = 3000;
const WAKE_EVENTS = ['pointermove', 'mousemove', 'keydown'] as const;
const OSD_BARS = '.jfp-video-header, .jfp-video-controls, .jfp-skip-intro-btn, .jfp-shortcuts-fab';

function pointerIsOverBars(
    root: Element,
    point: { x: number; y: number } | null,
    cachedBars?: Element[] | null
): boolean {
    if (!point) return false;
    const bars = cachedBars && cachedBars.length > 0 ?
        cachedBars :
        [...root.querySelectorAll(OSD_BARS)];
    return bars.some((bar) => pointInRect(point, bar.getBoundingClientRect()));
}

export interface UseOsdVisibilityOptions {
    containerRef: RefObject<HTMLElement>;
    playing: boolean;
    isFullscreen: boolean;
    activeSegment: typeof videoPlayerVM.activeSegment.value;
}

export function useOsdVisibility({
    containerRef,
    playing,
    isFullscreen,
    activeSegment
}: UseOsdVisibilityOptions) {
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const skipHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [skipVisible, setSkipVisible] = useState(false);

    const pointer = useRef<{ x: number; y: number } | null>(null);
    const barsRef = useRef<Element[] | null>(null);

    const trackPointer = useCallback((e: Event) => {
        if (e instanceof PointerEvent && e.pointerType !== 'mouse') {
            pointer.current = null;
            return;
        }
        if (e instanceof MouseEvent) pointer.current = { x: e.clientX, y: e.clientY };
    }, []);

    const canHide = useCallback(() => {
        if (!videoPlayerVM.playing.peek()) return false;
        const root = containerRef.current;
        if (!root) return false;
        if (root.querySelector('.jfp-video-settings-menu')) return false;

        if (!barsRef.current || barsRef.current.length === 0 || !barsRef.current[0].isConnected) {
            barsRef.current = [...root.querySelectorAll(OSD_BARS)];
        }
        return !pointerIsOverBars(root, pointer.current, barsRef.current);
    }, [containerRef]);

    const showControls = useCallback(() => {
        setControlsVisible(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
        const arm = () => {
            hideTimer.current = setTimeout(() => {
                hideTimer.current = null;
                if (!canHide()) { arm(); return; }
                setControlsVisible(false);
            }, HIDE_CONTROLS_MS);
        };
        arm();
    }, [canHide]);

    const activeSegmentRef = useRef(activeSegment);
    activeSegmentRef.current = activeSegment;

    const showSkip = useCallback(() => {
        if (!activeSegmentRef.current) return;
        setSkipVisible(true);
        if (skipHideTimer.current) clearTimeout(skipHideTimer.current);
        skipHideTimer.current = setTimeout(() => {
            skipHideTimer.current = null;
            setSkipVisible(false);
        }, SKIP_VISIBLE_MS);
    }, []);

    useEffect(() => {
        if (skipHideTimer.current) clearTimeout(skipHideTimer.current);
        if (!activeSegment) {
            setSkipVisible(false);
            return;
        }
        showSkip();
        return () => {
            if (skipHideTimer.current) clearTimeout(skipHideTimer.current);
        };
    }, [activeSegment?.kind, activeSegment?.start, showSkip]);

    useEffect(() => { showControls(); }, [playing, showControls]);
    useEffect(() => { showControls(); }, [isFullscreen, showControls]);

    useEffect(() => {
        const wake = (e: Event) => {
            trackPointer(e);
            showControls();
            showSkip();
        };
        const opts = { passive: true } as const;
        for (const type of WAKE_EVENTS) document.addEventListener(type, wake, opts);
        document.addEventListener('fullscreenchange', wake);
        return () => {
            for (const type of WAKE_EVENTS) document.removeEventListener(type, wake);
            document.removeEventListener('fullscreenchange', wake);
        };
    }, [showControls, showSkip, trackPointer]);

    useEffect(() => () => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        if (skipHideTimer.current) clearTimeout(skipHideTimer.current);
    }, []);

    return {
        controlsVisible,
        setControlsVisible,
        skipVisible,
        showControls,
        showSkip,
        trackPointer,
        hideTimer,
        skipHideTimer
    };
}
