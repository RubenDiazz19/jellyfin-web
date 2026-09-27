import type { ApiService } from '../../data/api/ApiService';
import type { PlaybackDecision, PlaybackOptions } from '../../data/api/playback';
import type { PlaybackContext } from '../../data/api/playbackContext';
import type { MediaSegment } from '../../data/api/segments';
import { attachHlsSource, playsHlsNatively } from './hlsSource';
import { segmentsFromChapters } from '../../data/api/chapterSegments';
import type { TitlePreferences } from './titlePreferences';
import type { TrickplayManager } from './TrickplayManager';
import type { AudioTrackManager } from './AudioTrackManager';
import type { SubtitlesBinding } from './subtitlesBinding';
import type { SegmentTracker } from './segmentTracker';
import type { AutoNextTracker } from './autoNext';
import type { ProgressReporter } from './ProgressReporter';
import type Hls from 'hls.js';
import { logger } from '../logger';
import { TICKS_PER_SECOND } from './format';
import type { Signal } from '@preact/signals-core';

const RETRY_SOURCE_MS = 2000;

export interface PlaybackEngineState {
    video: HTMLVideoElement | null;
    loading: Signal<boolean>;
    error: Signal<string | null>;
    title: Signal<string>;
    ended: Signal<boolean>;
    playing: Signal<boolean>;
    chapters: Signal<PlaybackContext['chapters']>;
    buffering: Signal<boolean>;
    trickplayMgr: TrickplayManager;
    audioTracksMgr: AudioTrackManager;
    subtitles: SubtitlesBinding;
    segments: SegmentTracker;
    autoNext: AutoNextTracker;
    progress: ProgressReporter;
    prefs: TitlePreferences;
    mediaSessionStart: () => void;
}

export class PlaybackEngine {
    itemId = '';
    decision: PlaybackDecision | null = null;
    context: PlaybackContext | null = null;
    private hls: Hls | null = null;
    private startSeconds = 0;
    private resumeSeconds = 0;
    private retriedSource = false;
    private hasStarted = false;
    private closed = false;
    private detachOnMeta: (() => void) | null = null;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private contextReady: Promise<void> = Promise.resolve();
    private lastSourceOpts: PlaybackOptions = {};

    constructor(
        private api: ApiService,
        private state: PlaybackEngineState
    ) {}

    get isClosed() { return this.closed; }
    
    setHasStarted(v: boolean) { this.hasStarted = v; }

    async open(itemId: string, opts: { startTicks?: number; title?: string } = {}) {
        if (!this.state.video) return;
        this.itemId = itemId;
        this.state.title.value = opts.title ?? '';
        this.startSeconds = (opts.startTicks ?? 0) / TICKS_PER_SECOND;
        this.state.loading.value = true;
        this.state.error.value = null;
        this.state.ended.value = false;
        this.retriedSource = false;
        this.hasStarted = false;
        this.state.autoNext.reset();
        this.resumeSeconds = this.startSeconds;
        
        this.contextReady = this.loadContext(itemId);
        if (this.state.prefs.hasAny()) await this.contextReady;
        if (this.closed || this.itemId !== itemId) return;
        
        await this.loadSource(this.state.prefs.tracksFor(this.context));
        if (this.closed || this.itemId !== itemId) return;
        
        this.state.progress.startPlayback(itemId, this.decision?.playMethod);
        void this.api.playback.reportPlaybackStart(itemId, this.decision?.playMethod);
        this.state.mediaSessionStart();
        void this.loadSegments(itemId);
    }

    private async loadContext(itemId: string) {
        this.context = null;
        this.state.prefs.reset(itemId);
        try {
            const context = await this.api.playback.getPlaybackContext(itemId);
            if (this.closed || this.itemId !== itemId) return;
            this.context = context;
            this.state.chapters.value = context.chapters;
            this.state.trickplayMgr.trickplay.value = context.trickplay ?? null;
            this.state.prefs.adopt(context);
            if (context.isEpisode) void this.loadNextEpisode(context.titleId, itemId);
        } catch (e) {
            logger.debug('[player] sin contexto del item', e);
        }
    }

    private async loadNextEpisode(seriesId: string, itemId: string) {
        try {
            const next = await this.api.playback.getNextEpisode(seriesId, itemId);
            if (this.closed || this.itemId !== itemId) return;
            this.state.autoNext.next.value = next;
        } catch (e) {
            logger.debug('[player] sin siguiente episodio', e);
        }
    }

    private async loadSegments(itemId: string) {
        let segments: MediaSegment[];
        try {
            segments = await this.api.playback.getMediaSegments(itemId);
        } catch (e) {
            logger.debug('[player] no se pudieron cargar los segmentos', e);
            return;
        }
        if (this.closed || this.itemId !== itemId) return;
        if (segments.length === 0) await this.contextReady;
        if (this.closed || this.itemId !== itemId) return;
        if (segments.length === 0 && this.context) {
            segments = segmentsFromChapters(this.context.chapters, this.context.runtime);
        }
        this.state.segments.replace(segments);
        this.state.segments.syncTo(this.state.video?.currentTime ?? 0);
    }

    async loadSource(opts: PlaybackOptions = {}, flags?: { fresh?: boolean }) {
        const video = this.state.video;
        if (!video || !this.itemId) return;
        this.lastSourceOpts = opts;
        const currentItemId = this.itemId;
        try {
            let decision = this.decision;
            if (!decision || flags?.fresh) {
                decision = await this.api.playback.getPlaybackDecision(this.itemId, {
                    ...opts,
                    startTicks: Math.floor(this.startSeconds * TICKS_PER_SECOND),
                    mediaSourceId: this.decision?.mediaSourceId
                }, { fresh: flags?.fresh });
                if (this.closed || this.itemId !== currentItemId) return;
                this.decision = decision;
                if (decision.trickplay && !this.state.trickplayMgr.trickplay.value) {
                    this.state.trickplayMgr.trickplay.value = decision.trickplay;
                }
                this.state.audioTracksMgr.audioTracks.value = decision.audioStreams;
                this.state.subtitles.subtitleTracks.value = decision.subtitleStreams;
                this.state.audioTracksMgr.selectedAudio.value = opts.audioStreamIndex
                    ?? decision.activeAudioIndex
                    ?? decision.audioStreams.find((a: any) => a.isDefault)?.index
                    ?? decision.audioStreams[0]?.index
                    ?? null;
            }

            if (this.hls) {
                this.hls.destroy();
                this.hls = null;
            }
            video.removeAttribute('src');

            if (decision.kind === 'hls' && !playsHlsNatively(video)) {
                const attached = await attachHlsSource(video, decision.url, {
                    isClosed: () => this.closed || this.itemId !== currentItemId,
                    onUnrecoverable: () => {
                        if (this.retrySource()) return;
                        this.state.error.value = 'HLS Fatal Error';
                        this.state.loading.value = false;
                    }
                });
                if (attached.status === 'aborted') return;
                if (this.closed || this.itemId !== currentItemId) return;
                if (attached.status === 'unsupported') {
                    this.state.error.value = 'HLS Unsupported';
                    this.state.loading.value = false;
                    return;
                }
                this.hls = attached.hls;
            } else {
                video.src = decision.url;
            }

            const subIndex = opts.subtitleStreamIndex === -1 ?
                null :
                opts.subtitleStreamIndex ?? decision.activeSubtitleIndex ?? null;
            const subStream = subIndex == null ?
                null :
                decision.subtitleStreams.find((s: any) => s.index === subIndex) ?? null;
            
            if (subStream?.isText) {
                this.state.subtitles.selectedSubtitle.value = subStream.index;
                this.state.subtitles.publishSubtitle(this.api.playback.subtitleVttUrl(
                    this.itemId, decision.mediaSourceId, subStream.index
                ), this.hasStarted);
                this.state.subtitles.burnedSubtitle = null;
            } else {
                this.state.subtitles.selectedSubtitle.value = subStream?.index ?? null;
                this.state.subtitles.publishSubtitle(null, this.hasStarted);
                this.state.subtitles.burnedSubtitle = subStream ? subStream.index : null;
            }

            const seekTo = this.startSeconds;
            this.resumeSeconds = seekTo;
            this.startSeconds = 0;
            const onMeta = () => {
                if (seekTo > 0) video.currentTime = seekTo;
                void video.play().catch(() => {
                    this.state.playing.value = false;
                    this.state.loading.value = false;
                });
            };
            this.detachOnMeta?.();
            video.addEventListener('loadedmetadata', onMeta, { once: true });
            this.detachOnMeta = () => {
                video.removeEventListener('loadedmetadata', onMeta);
                this.detachOnMeta = null;
            };
        } catch (e) {
            if (this.closed || this.itemId !== currentItemId) return;
            this.state.error.value = (e as Error).message || 'Playback Start Failed';
            this.state.loading.value = false;
        }
    }

    retrySource(): boolean {
        if (this.retriedSource || this.closed || !this.state.video) return false;
        this.retriedSource = true;
        this.state.loading.value = true;
        this.state.error.value = null;
        this.startSeconds = Math.max(this.state.video.currentTime, this.resumeSeconds);
        logger.warn('[player] fallo en el arranque: reintentando la fuente');
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            if (this.closed) return;
            void this.loadSource(this.lastSourceOpts, { fresh: true });
        }, RETRY_SOURCE_MS);
        return true;
    }

    async reload(opts: { audioStreamIndex?: number; subtitleStreamIndex?: number }) {
        const video = this.state.video;
        if (!video) return;
        this.startSeconds = video.currentTime;
        this.state.loading.value = true;
        this.retriedSource = false;
        await this.loadSource({
            audioStreamIndex: opts.audioStreamIndex ?? this.state.audioTracksMgr.selectedAudio.value ?? undefined,
            subtitleStreamIndex: opts.subtitleStreamIndex ?? this.state.subtitles.selectedSubtitle.value ?? -1,
            mediaSourceId: this.decision?.mediaSourceId
        }, { fresh: true });
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.retryTimer = null;
        this.detachOnMeta?.();
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
        this.decision = null;
        this.context = null;
    }

    reset() {
        this.resumeSeconds = 0;
        this.retriedSource = false;
        this.hasStarted = false;
    }
}
