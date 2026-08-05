// Media segments: intro/outro/recap/preview ranges the server has detected
// (populated by plugins such as Intro Skipper). The player uses them to offer
// a "skip" button while playback is inside a segment.

import { apiFetch } from './http';

import { TICKS_PER_SECOND } from './types';

export type MediaSegmentKind = 'Intro' | 'Outro' | 'Recap' | 'Preview' | 'Commercial' | 'Unknown';

export type MediaSegment = {
    kind: MediaSegmentKind;
    /** Segment bounds in seconds, ready to compare against video.currentTime. */
    start: number;
    end: number;
};

const KNOWN_KINDS: MediaSegmentKind[] = ['Intro', 'Outro', 'Recap', 'Preview', 'Commercial'];

type JFMediaSegment = {
    Type?: string;
    StartTicks?: number;
    EndTicks?: number;
};

/**
 * Segments for an item, sorted by start time. Servers without the media
 * segments endpoint (or with no provider installed) answer 404/empty; that is
 * not an error for us, it just means there is nothing to skip.
 */
export async function getMediaSegments(itemId: string): Promise<MediaSegment[]> {
    let data: { Items?: JFMediaSegment[] };
    try {
        data = await apiFetch<{ Items?: JFMediaSegment[] }>(`/MediaSegments/${itemId}`);
    } catch {
        return [];
    }

    return (data.Items ?? [])
        .flatMap((s): MediaSegment[] => {
            const kind = KNOWN_KINDS.find((k) => k === s.Type) ?? 'Unknown';
            const start = (s.StartTicks ?? 0) / TICKS_PER_SECOND;
            const end = (s.EndTicks ?? 0) / TICKS_PER_SECOND;
            // Un segmento sin final utilizable no se puede saltar.
            if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
            return [{ kind, start, end }];
        })
        .sort((a, b) => a.start - b.start);
}
