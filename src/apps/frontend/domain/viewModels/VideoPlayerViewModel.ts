// ViewModel del reproductor de vídeo. Controla un HTMLVideoElement nativo
// (DirectPlay o HLS vía hls.js) usando la capa de playback propia del
// frontend: PlaybackInfo del servidor, subtítulos VTT externos y reporting
// de progreso para que "continuar viendo" funcione.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import { signal } from '@preact/signals-core';
import type Hls from 'hls.js';
import { apiService, type ApiService } from '../../data/api/ApiService';
import type { MediaStreamInfo, PlaybackDecision } from '../../data/api/playback';

const TICKS_PER_SECOND = 10_000_000;
const PROGRESS_REPORT_MS = 10_000;
const VOLUME_KEY = 'jfp-volume';

export type { MediaStreamInfo };

export class VideoPlayerViewModel {
    // Estado observable que la View pinta.
    currentTime = signal(0);
    duration = signal(0);
    playing = signal(false);
    volume = signal(1);
    muted = signal(false);
    fullscreen = signal(false);
    buffering = signal(false);
    loading = signal(true);
    error = signal<string | null>(null);
    title = signal('');
    audioTracks = signal<MediaStreamInfo[]>([]);
    subtitleTracks = signal<MediaStreamInfo[]>([]);
    /** Índice del stream de audio activo (índice Jellyfin, no posición). */
    selectedAudio = signal<number | null>(null);
    /** Índice del subtítulo activo, o null = desactivados. */
    selectedSubtitle = signal<number | null>(null);
    /** URL del VTT activo (solo subtítulos de texto). La View pinta <track>. */
    subtitleUrl = signal<string | null>(null);

    private video: HTMLVideoElement | null = null;
    private container: HTMLElement | null = null;
    private hls: Hls | null = null;
    private decision: PlaybackDecision | null = null;
    private itemId = '';
    private startSeconds = 0;
    private progressTimer: ReturnType<typeof setInterval> | null = null;
    private detachFns: (() => void)[] = [];
    private closed = false;
    /** Subtítulo no-texto quemado en el transcode actual (índice Jellyfin). */
    private burnedSubtitle: number | null = null;

    constructor(private api: ApiService) {}

    /**
     * Conecta el VM al <video> y su contenedor (para fullscreen). La View lo
     * llama al montar; devuelve el cleanup para el desmontaje.
     */
    attach(video: HTMLVideoElement, container: HTMLElement): () => void {
        this.video = video;
        this.container = container;
        this.closed = false;

        const savedVolume = Number(localStorage.getItem(VOLUME_KEY) ?? '1');
        video.volume = Number.isFinite(savedVolume) ? Math.min(Math.max(savedVolume, 0), 1) : 1;
        this.volume.value = video.volume;

        const on = <K extends keyof HTMLVideoElementEventMap>(
            ev: K, fn: () => void
        ) => {
            video.addEventListener(ev, fn);
            this.detachFns.push(() => video.removeEventListener(ev, fn));
        };

        on('timeupdate', () => { this.currentTime.value = video.currentTime; });
        on('durationchange', () => {
            if (Number.isFinite(video.duration)) this.duration.value = video.duration;
        });
        on('play', () => { this.playing.value = true; });
        on('pause', () => {
            this.playing.value = false;
            void this.reportProgress();
        });
        on('waiting', () => { this.buffering.value = true; });
        on('playing', () => { this.buffering.value = false; this.loading.value = false; });
        on('canplay', () => { this.buffering.value = false; this.loading.value = false; });
        on('volumechange', () => {
            this.volume.value = video.volume;
            this.muted.value = video.muted;
            localStorage.setItem(VOLUME_KEY, String(video.volume));
        });
        on('ended', () => { this.playing.value = false; void this.reportProgress(); });
        on('error', () => {
            if (this.closed) return;
            this.error.value = 'No se pudo reproducir el vídeo';
            this.loading.value = false;
        });

        const onFsChange = () => {
            this.fullscreen.value = !!document.fullscreenElement;
        };
        document.addEventListener('fullscreenchange', onFsChange);
        this.detachFns.push(() => document.removeEventListener('fullscreenchange', onFsChange));

        return () => this.close();
    }

    /** Carga y reproduce un item. startTicks reanuda desde esa posición. */
    async open(itemId: string, opts: { startTicks?: number; title?: string } = {}) {
        if (!this.video) return;
        this.itemId = itemId;
        this.title.value = opts.title ?? '';
        this.startSeconds = (opts.startTicks ?? 0) / TICKS_PER_SECOND;
        this.loading.value = true;
        this.error.value = null;
        await this.loadSource({});
        void this.api.playback.reportPlaybackStart(itemId);
        this.startProgressTimer();
    }

    // ── Comandos ────────────────────────────────────────────────────────────

    togglePlay = () => {
        const v = this.video;
        if (!v) return;
        if (v.paused) void v.play().catch(() => {});
        else v.pause();
    };

    seek = (seconds: number) => {
        const v = this.video;
        if (!v || !Number.isFinite(seconds)) return;
        v.currentTime = Math.min(Math.max(seconds, 0), this.duration.value || seconds);
        this.currentTime.value = v.currentTime;
    };

    seekBy = (delta: number) => this.seek((this.video?.currentTime ?? 0) + delta);

    setVolume = (value: number) => {
        const v = this.video;
        if (!v) return;
        v.volume = Math.min(Math.max(value, 0), 1);
        if (v.volume > 0) v.muted = false;
    };

    toggleMute = () => {
        const v = this.video;
        if (!v) return;
        v.muted = !v.muted;
    };

    toggleFullscreen = () => {
        const el = this.container;
        if (!el) return;
        if (document.fullscreenElement) {
            void document.exitFullscreen?.().catch(() => {});
        } else {
            void el.requestFullscreen?.().catch(() => {});
        }
    };

    /** Cambia la pista de audio: nuevo PlaybackInfo conservando la posición. */
    setAudioTrack = (index: number) => {
        if (index === this.selectedAudio.value) return;
        void this.reload({ audioStreamIndex: index });
    };

    /**
     * Cambia subtítulos. Texto → <track> VTT externo sin recargar. Formatos
     * de imagen (PGS/VOB) → el servidor los quema en el transcode.
     */
    setSubtitleTrack = (index: number | null) => {
        if (index === this.selectedSubtitle.value) return;
        const stream = index == null
            ? null
            : this.subtitleTracks.value.find((s) => s.index === index) ?? null;

        // Si había un subtítulo quemado, quitarlo (o cambiarlo) exige recarga.
        // -1 = "sin subtítulos" explícito para que el servidor no reactive
        // el default del usuario.
        if (this.burnedSubtitle != null || (stream && !stream.isText)) {
            void this.reload({ subtitleStreamIndex: index ?? -1 });
            return;
        }

        this.selectedSubtitle.value = index;
        this.subtitleUrl.value = stream && this.decision
            ? this.api.playback.subtitleVttUrl(this.itemId, this.decision.mediaSourceId, stream.index)
            : null;
    };

    /** Para la reproducción y reporta el stop. Idempotente. */
    close() {
        if (this.closed) return;
        this.closed = true;
        this.stopProgressTimer();
        const position = Math.floor((this.video?.currentTime ?? 0) * TICKS_PER_SECOND);
        if (this.itemId) {
            void this.api.playback.reportPlaybackStop(
                this.itemId, position, this.decision?.playSessionId
            );
        }
        this.hls?.destroy();
        this.hls = null;
        if (this.video) {
            this.video.pause();
            this.video.removeAttribute('src');
            this.video.load();
        }
        this.detachFns.forEach((fn) => fn());
        this.detachFns = [];
        this.video = null;
        this.container = null;
        this.decision = null;
        this.reset();
    }

    // ── Interno ─────────────────────────────────────────────────────────────

    private reset() {
        this.currentTime.value = 0;
        this.duration.value = 0;
        this.playing.value = false;
        this.buffering.value = false;
        this.loading.value = true;
        this.error.value = null;
        this.audioTracks.value = [];
        this.subtitleTracks.value = [];
        this.selectedAudio.value = null;
        this.selectedSubtitle.value = null;
        this.subtitleUrl.value = null;
        this.burnedSubtitle = null;
        this.itemId = '';
    }

    /** Pide PlaybackInfo y engancha la fuente (direct o HLS) al <video>. */
    private async loadSource(opts: {
        audioStreamIndex?: number;
        subtitleStreamIndex?: number;
    }) {
        const video = this.video;
        if (!video) return;
        try {
            // No pedimos startTimeTicks al servidor: las playlists HLS de
            // Jellyfin son VOD completas, así que basta con seek local tras
            // cargar metadatos (vale para direct y para transcode).
            const decision = await this.api.playback.getPlaybackDecision(this.itemId, opts);
            if (this.closed) return;
            this.decision = decision;
            this.audioTracks.value = decision.audioStreams;
            this.subtitleTracks.value = decision.subtitleStreams;
            this.selectedAudio.value = opts.audioStreamIndex
                ?? decision.activeAudioIndex
                ?? decision.audioStreams.find((a) => a.isDefault)?.index
                ?? decision.audioStreams[0]?.index
                ?? null;

            this.hls?.destroy();
            this.hls = null;

            if (decision.kind === 'hls' && !video.canPlayType('application/vnd.apple.mpegurl')) {
                const HlsMod = (await import('hls.js')).default;
                if (this.closed) return;
                if (!HlsMod.isSupported()) {
                    this.error.value = 'Este navegador no soporta la reproducción HLS';
                    this.loading.value = false;
                    return;
                }
                const hls = new HlsMod();
                this.hls = hls;
                hls.on(HlsMod.Events.ERROR, (_ev, data) => {
                    if (!data.fatal || this.closed) return;
                    if (data.type === 'networkError') hls.startLoad();
                    else if (data.type === 'mediaError') hls.recoverMediaError();
                    else {
                        this.error.value = 'Error fatal de reproducción HLS';
                        this.loading.value = false;
                    }
                });
                hls.loadSource(decision.url);
                hls.attachMedia(video);
            } else {
                video.src = decision.url;
            }

            // Subtítulo inicial o el que ha pedido la recarga (-1 = ninguno).
            const subIndex = opts.subtitleStreamIndex === -1
                ? null
                : opts.subtitleStreamIndex ?? decision.activeSubtitleIndex ?? null;
            const subStream = subIndex == null
                ? null
                : decision.subtitleStreams.find((s) => s.index === subIndex) ?? null;
            if (subStream?.isText) {
                this.selectedSubtitle.value = subStream.index;
                this.subtitleUrl.value = this.api.playback.subtitleVttUrl(
                    this.itemId, decision.mediaSourceId, subStream.index
                );
                this.burnedSubtitle = null;
            } else {
                this.selectedSubtitle.value = subStream?.index ?? null;
                this.subtitleUrl.value = null;
                this.burnedSubtitle = subStream ? subStream.index : null;
            }

            const seekTo = this.startSeconds;
            this.startSeconds = 0;
            const onMeta = () => {
                if (seekTo > 0) video.currentTime = seekTo;
                void video.play().catch(() => {
                    // Autoplay bloqueado: el usuario pulsa play manualmente.
                    this.playing.value = false;
                    this.loading.value = false;
                });
            };
            video.addEventListener('loadedmetadata', onMeta, { once: true });
            this.detachFns.push(() => video.removeEventListener('loadedmetadata', onMeta));
        } catch (e) {
            if (this.closed) return;
            this.error.value = (e as Error).message || 'No se pudo iniciar la reproducción';
            this.loading.value = false;
        }
    }

    /** Recarga la fuente (cambio de pista) conservando posición y estado. */
    private async reload(opts: { audioStreamIndex?: number; subtitleStreamIndex?: number }) {
        const video = this.video;
        if (!video) return;
        this.startSeconds = video.currentTime;
        this.loading.value = true;
        await this.loadSource({
            audioStreamIndex: opts.audioStreamIndex ?? this.selectedAudio.value ?? undefined,
            subtitleStreamIndex: opts.subtitleStreamIndex
        });
    }

    private startProgressTimer() {
        this.stopProgressTimer();
        this.progressTimer = setInterval(() => void this.reportProgress(), PROGRESS_REPORT_MS);
    }

    private stopProgressTimer() {
        if (this.progressTimer) clearInterval(this.progressTimer);
        this.progressTimer = null;
    }

    private async reportProgress() {
        const v = this.video;
        if (!v || !this.itemId || this.closed) return;
        await this.api.playback.reportPlaybackProgress(
            this.itemId,
            Math.floor(v.currentTime * TICKS_PER_SECOND),
            v.paused
        );
    }
}

export const videoPlayerVM = new VideoPlayerViewModel(apiService);
