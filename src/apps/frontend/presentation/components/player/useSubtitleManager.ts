// Hook para gestionar subtítulos VTT, sanitización de cues y ajuste de desfase.
// Extraído de VideoPlayer.tsx para reducir tamaño y separar responsabilidades.

import { useCallback, useEffect, useRef } from 'react';
import { sanitizeVttCueText } from '../../../domain/player/format';
import {
    applyCueLine, getSubtitleAppearance, removeSubtitleAppearance
} from '../../../domain/player/subtitleStyle';
import { videoPlayerVM } from '../../../domain/viewModels/VideoPlayerViewModel';

export function useSubtitleManager(subtitleUrl?: string | null, subtitleOffset = 0) {
    const subtitleTrackRef = useRef<HTMLTrackElement | null>(null);
    const cueOriginalTimes = useRef(new WeakMap<VTTCue, { start: number; end: number }>());

    const setSubtitleTrackRef = useCallback((el: HTMLTrackElement | null) => {
        subtitleTrackRef.current = el;
        if (!el) return;
        el.addEventListener('load', () => {
            for (const cue of Array.from(el.track.cues ?? [])) {
                if (cue instanceof VTTCue && cue.text.includes('{')) {
                    cue.text = sanitizeVttCueText(cue.text);
                }
            }
            applyCueLine(el.track.cues, getSubtitleAppearance().verticalPosition);
            const offset = videoPlayerVM.subtitleOffset.peek();
            if (offset !== 0 && el.track.cues) {
                for (const cue of Array.from(el.track.cues)) {
                    if (!(cue instanceof VTTCue)) continue;
                    let orig = cueOriginalTimes.current.get(cue);
                    if (!orig) {
                        orig = { start: cue.startTime, end: cue.endTime };
                        cueOriginalTimes.current.set(cue, orig);
                    }
                    cue.startTime = Math.max(0, orig.start + offset);
                    cue.endTime = Math.max(0, orig.end + offset);
                }
            }
        });
    }, []);

    useEffect(() => {
        const track = subtitleTrackRef.current?.track;
        if (!track) return;
        const cues = track.cues;
        if (!cues) return;
        for (const cue of Array.from(cues)) {
            if (!(cue instanceof VTTCue)) continue;
            let orig = cueOriginalTimes.current.get(cue);
            if (!orig) {
                orig = { start: cue.startTime, end: cue.endTime };
                cueOriginalTimes.current.set(cue, orig);
            }
            cue.startTime = Math.max(0, orig.start + subtitleOffset);
            cue.endTime = Math.max(0, orig.end + subtitleOffset);
        }
    }, [subtitleUrl, subtitleOffset]);

    useEffect(() => () => {
        removeSubtitleAppearance();
    }, []);

    return {
        subtitleTrackRef,
        setSubtitleTrackRef
    };
}
