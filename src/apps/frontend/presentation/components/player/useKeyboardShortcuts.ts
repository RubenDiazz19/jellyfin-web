// Hook para atajos de teclado globales del reproductor de vídeo.
// Extraído de VideoPlayer.tsx para reducir tamaño y separar responsabilidades.

import globalize from 'lib/globalize';
import React, { useEffect, useRef } from 'react';
import type { QueueEntry } from '../../../domain/viewModels/QueueViewModel';
import { videoPlayerVM } from '../../../domain/viewModels/VideoPlayerViewModel';

export interface UseKeyboardShortcutsOptions {
    queueItems: QueueEntry[];
    shortcutsOpen: boolean;
    onPlayQueued: (entry: QueueEntry) => void;
    onClose: () => void;
    showControls: () => void;
    showNotice: (text: string) => void;
    setShortcutsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useKeyboardShortcuts({
    queueItems,
    shortcutsOpen,
    onPlayQueued,
    onClose,
    showControls,
    showNotice,
    setShortcutsOpen
}: UseKeyboardShortcutsOptions) {
    const queueItemsRef = useRef(queueItems);
    queueItemsRef.current = queueItems;
    const shortcutsOpenRef = useRef(shortcutsOpen);
    shortcutsOpenRef.current = shortcutsOpen;
    const onPlayQueuedRef = useRef(onPlayQueued);
    onPlayQueuedRef.current = onPlayQueued;
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const showControlsRef = useRef(showControls);
    showControlsRef.current = showControls;
    const showNoticeRef = useRef(showNotice);
    showNoticeRef.current = showNotice;

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
            switch (e.key) {
                case ' ':
                case 'k':
                case 'K':
                    e.preventDefault();
                    videoPlayerVM.togglePlay();
                    break;
                case 'm':
                case 'M':
                    videoPlayerVM.toggleMute();
                    break;
                case 'f':
                case 'F':
                    videoPlayerVM.toggleFullscreen();
                    break;
                case 'p':
                case 'P':
                    videoPlayerVM.togglePip();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    videoPlayerVM.skipBackward();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    videoPlayerVM.skipForward();
                    break;
                case 'j':
                case 'J':
                    e.preventDefault();
                    videoPlayerVM.seekBy(-10);
                    break;
                case 'l':
                case 'L':
                    e.preventDefault();
                    videoPlayerVM.seekBy(10);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    videoPlayerVM.setVolume(videoPlayerVM.volume.peek() + 0.05);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    videoPlayerVM.setVolume(videoPlayerVM.volume.peek() - 0.05);
                    break;
                case 'c':
                case 'C':
                    videoPlayerVM.toggleSubtitles();
                    break;
                case 'g':
                case 'G': {
                    videoPlayerVM.adjustSubtitleOffset(-0.1);
                    const off = videoPlayerVM.subtitleOffset.peek();
                    showNoticeRef.current(`${globalize.translate('SubtitleOffset')}: ${off > 0 ? '+' : ''}${off.toFixed(1)}s`);
                    break;
                }
                case 'h':
                case 'H': {
                    videoPlayerVM.adjustSubtitleOffset(0.1);
                    const off = videoPlayerVM.subtitleOffset.peek();
                    showNoticeRef.current(`${globalize.translate('SubtitleOffset')}: ${off > 0 ? '+' : ''}${off.toFixed(1)}s`);
                    break;
                }
                case '[': {
                    const r = Math.max(0.25, Math.round((videoPlayerVM.playbackRate.peek() - 0.25) * 100) / 100);
                    videoPlayerVM.setPlaybackRate(r);
                    showNoticeRef.current(`${globalize.translate('LabelPlaybackSpeed')}: ${r}×`);
                    break;
                }
                case ']': {
                    const r = Math.min(3, Math.round((videoPlayerVM.playbackRate.peek() + 0.25) * 100) / 100);
                    videoPlayerVM.setPlaybackRate(r);
                    showNoticeRef.current(`${globalize.translate('LabelPlaybackSpeed')}: ${r}×`);
                    break;
                }
                case 's':
                case 'S':
                    if (videoPlayerVM.activeSegment.peek()) {
                        videoPlayerVM.skipActiveSegment();
                    }
                    break;
                case 'n':
                case 'N': {
                    const qNext = queueItemsRef.current[0];
                    if (qNext) {
                        onPlayQueuedRef.current({ itemId: qNext.itemId, title: qNext.title });
                    } else {
                        const next = videoPlayerVM.nextEpisode.peek();
                        if (next) {
                            onPlayQueuedRef.current({ itemId: next.id, title: next.title });
                        }
                    }
                    break;
                }
                case '?':
                    setShortcutsOpen((o) => !o);
                    break;
                case '0':
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                case '6':
                case '7':
                case '8':
                case '9': {
                    const pct = Number(e.key) / 10;
                    const dur = videoPlayerVM.duration.peek();
                    if (dur > 0) videoPlayerVM.seek(pct * dur);
                    break;
                }
                case 'Escape':
                    if (shortcutsOpenRef.current) {
                        setShortcutsOpen(false);
                        break;
                    }
                    if (!document.fullscreenElement) onCloseRef.current();
                    break;
                default:
                    return;
            }
            showControlsRef.current();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [setShortcutsOpen]);
}
