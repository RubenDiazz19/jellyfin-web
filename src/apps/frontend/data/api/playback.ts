// Playback + streaming. Server decides DirectPlay/DirectStream/HLS based on
// the browser device profile we send.

import { loadSession } from '../session/session';
import { invalidateShow } from './cache';
import { apiSend, trimSlash } from './http';

export type MediaStreamInfo = {
    index: number;
    language?: string;
    displayTitle: string;
    isDefault: boolean;
    isForced?: boolean;
    isText: boolean;
    codec?: string;
};

export type PlaybackDecision = {
    kind: 'direct' | 'hls';
    url: string;
    playSessionId?: string;
    container?: string;
    mediaSourceId: string;
    audioStreams: MediaStreamInfo[];
    subtitleStreams: MediaStreamInfo[];
    activeAudioIndex?: number;
    activeSubtitleIndex?: number;
};

// Device profile: which containers/codecs the browser can decode. The server
// uses it to decide DirectPlay/DirectStream/HLS transcode.
function browserDeviceProfile() {
    return {
        MaxStreamingBitrate: 20_000_000,
        MaxStaticBitrate: 20_000_000,
        MusicStreamingTranscodingBitrate: 384_000,
        DirectPlayProfiles: [
            { Container: 'mp4,m4v', Type: 'Video', VideoCodec: 'h264,vp9,av1', AudioCodec: 'aac,mp3,opus' },
            { Container: 'webm', Type: 'Video', VideoCodec: 'vp9,av1', AudioCodec: 'opus,vorbis' }
        ],
        TranscodingProfiles: [
            {
                Container: 'mp4',
                Type: 'Video',
                VideoCodec: 'h264',
                AudioCodec: 'aac',
                Protocol: 'hls',
                Context: 'Streaming',
                MaxAudioChannels: '2',
                MinSegments: 2,
                BreakOnNonKeyFrames: true
            }
        ],
        CodecProfiles: [],
        ContainerProfiles: [],
        SubtitleProfiles: [{ Format: 'vtt', Method: 'External' }]
    };
}

function isTextSubtitle(codec?: string): boolean {
    if (!codec) return false;
    const c = codec.toLowerCase();
    return c === 'subrip' || c === 'srt' || c === 'ass' || c === 'ssa' || c === 'vtt' || c === 'webvtt';
}

function mapMediaStream(s: any): MediaStreamInfo {
    return {
        index: s.Index,
        language: s.Language,
        displayTitle: s.DisplayTitle ?? s.Title ?? s.Language ?? `#${s.Index}`,
        isDefault: !!s.IsDefault,
        isForced: !!s.IsForced,
        isText: s.Type === 'Subtitle' && isTextSubtitle(s.Codec),
        codec: s.Codec
    };
}

export async function getPlaybackDecision(
    itemId: string,
    opts: {
        startTicks?: number;
        audioStreamIndex?: number;
        subtitleStreamIndex?: number;
    } = {}
): Promise<PlaybackDecision> {
    const session = loadSession();
    if (!session?.accessToken || !session?.userId) throw new Error('Sin sesión');
    const q = new URLSearchParams({ userId: session.userId });
    if (opts.startTicks) q.set('startTimeTicks', String(opts.startTicks));
    if (opts.audioStreamIndex != null) q.set('audioStreamIndex', String(opts.audioStreamIndex));
    if (opts.subtitleStreamIndex != null) q.set('subtitleStreamIndex', String(opts.subtitleStreamIndex));
    const res = await apiSend(
        `/Items/${itemId}/PlaybackInfo?${q.toString()}`,
        'POST',
        { DeviceProfile: browserDeviceProfile() }
    );
    const data = await res.json();
    const src = (data.MediaSources ?? [])[0];
    if (!src) throw new Error('Sin fuentes reproducibles');
    const server = trimSlash(session.serverUrl);
    const streams: any[] = src.MediaStreams ?? [];
    const audioStreams = streams.filter((s) => s.Type === 'Audio').map(mapMediaStream);
    const subtitleStreams = streams.filter((s) => s.Type === 'Subtitle').map(mapMediaStream);
    const activeAudioIndex = src.DefaultAudioStreamIndex ?? opts.audioStreamIndex;
    const activeSubtitleIndex = src.DefaultSubtitleStreamIndex ?? opts.subtitleStreamIndex;

    const common = {
        playSessionId: data.PlaySessionId,
        mediaSourceId: src.Id,
        audioStreams,
        subtitleStreams,
        activeAudioIndex,
        activeSubtitleIndex
    };
    if (src.SupportsDirectPlay || src.SupportsDirectStream) {
        const params = new URLSearchParams({
            api_key: session.accessToken,
            Static: 'true',
            MediaSourceId: src.Id
        });
        if (opts.startTicks) params.set('startTimeTicks', String(opts.startTicks));
        return {
            kind: 'direct',
            url: `${server}/Videos/${itemId}/stream?${params.toString()}`,
            container: src.Container,
            ...common
        };
    }
    if (src.SupportsTranscoding && src.TranscodingUrl) {
        const rel = src.TranscodingUrl.startsWith('/') ? src.TranscodingUrl : '/' + src.TranscodingUrl;
        return {
            kind: 'hls',
            url: `${server}${rel}`,
            container: src.TranscodingContainer,
            ...common
        };
    }
    throw new Error('El servidor no puede reproducir este item');
}

// WebVTT URL for a text subtitle stream. Consumed as a <track> on <video>.
export function subtitleVttUrl(itemId: string, mediaSourceId: string, streamIndex: number): string {
    const session = loadSession();
    if (!session?.accessToken) return '';
    return `${trimSlash(session.serverUrl)}/Videos/${itemId}/${mediaSourceId}/Subtitles/${streamIndex}/0/Stream.vtt?api_key=${session.accessToken}`;
}

// Playback reporting: without these the server won't update "continue watching",
// mark-as-played-at-90%, or last-played timestamps.
export async function reportPlaybackStart(itemId: string): Promise<void> {
    try {
        await apiSend('/Sessions/Playing', 'POST', {
            ItemId: itemId,
            PlayMethod: 'Transcode',
            CanSeek: true
        });
    } catch { /* non-blocking */ }
}

export async function reportPlaybackProgress(
    itemId: string,
    positionTicks: number,
    isPaused: boolean
): Promise<void> {
    try {
        await apiSend('/Sessions/Playing/Progress', 'POST', {
            ItemId: itemId,
            PositionTicks: positionTicks,
            IsPaused: isPaused,
            PlayMethod: 'Transcode',
            CanSeek: true
        });
    } catch { /* silent */ }
}

export async function reportPlaybackStop(
    itemId: string,
    positionTicks: number,
    playSessionId?: string
): Promise<void> {
    try {
        await apiSend('/Sessions/Playing/Stopped', 'POST', {
            ItemId: itemId,
            PositionTicks: positionTicks,
            PlaySessionId: playSessionId
        });
        if (playSessionId) {
            // Tell the server it can free the ffmpeg process.
            await apiSend(
                `/Videos/ActiveEncodings?deviceId=${encodeURIComponent(getDeviceId())}&playSessionId=${playSessionId}`,
                'DELETE'
            ).catch(() => {});
        }
        invalidateShow(itemId);
    } catch { /* silent */ }
}

function getDeviceId(): string {
    const KEY = 'jfp-device-id';
    return localStorage.getItem(KEY) ?? '';
}
