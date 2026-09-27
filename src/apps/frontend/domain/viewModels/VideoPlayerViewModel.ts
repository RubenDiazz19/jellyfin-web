// ViewModel del reproductor de vídeo. Controla un HTMLVideoElement nativo
// (DirectPlay o HLS vía hls.js) usando la capa de playback propia del
// frontend: PlaybackInfo del servidor, subtítulos VTT externos y reporting
// de progreso para que "continuar viendo" funcione.
// Regla MVVM: esta clase no importa React ni nada de presentation/.

import globalize from 'lib/globalize';

import { signal } from '@preact/signals-core';
import type Hls from 'hls.js';
import { apiService, type ApiService } from '../../data/api/ApiService';
import type {
    MediaStreamInfo, PlaybackDecision, PlaybackOptions
} from '../../data/api/playback';
import type {
    ItemChapter, PlaybackContext, TrickplayData, TrickplayThumbnail
} from '../../data/api/playbackContext';
import { segmentsFromChapters } from '../../data/api/chapterSegments';
import type { MediaSegment } from '../../data/api/segments';
import type { TitleLanguagePref } from '../../data/preferences/languagePrefs';
import { getSkipLengths, getShowRemainingTime } from '../../data/api/playbackPrefs';
import { TICKS_PER_SECOND, type AspectRatio } from '../player/format';
import { attachHlsSource, playsHlsNatively } from '../player/hlsSource';
import { MediaSessionBinding } from '../player/mediaSession';
import { AutoNextTracker } from '../player/autoNext';
import { CastBinding } from '../player/castBinding';
import { SegmentTracker } from '../player/segmentTracker';
import { SubtitlesBinding } from '../player/subtitlesBinding';
import { TitlePreferences } from '../player/titlePreferences';
import { PlayerEventBinding } from '../player/PlayerEventBinding';
import { logger } from '../logger';
import { clamp } from '../../shared/math';
import { SleepTimerTracker, type SleepTimerMode } from '../player/sleepTimer';
import { VideoFilters } from '../player/VideoFilters';
import { ProgressReporter } from '../player/ProgressReporter';
import { TrickplayManager } from '../player/TrickplayManager';
import { AudioTrackManager } from '../player/AudioTrackManager';
import { PlaybackEngine } from '../player/PlaybackEngine';

const VOLUME_KEY = 'jfp-volume';
/** Margen antes de reintentar una fuente que ha fallado al arrancar. */
const RETRY_SOURCE_MS = 1200;

/**
 * Marca de propiedad del <video>: el elemento lo comparten todas las
 * instancias del VM que pasen por él (remontajes, HMR). Quien lo tenga
 * marcado es el único que puede limpiarlo.
 */
type OwnedVideo = HTMLVideoElement & { jfpOwner?: number };

function videoOwner(video: HTMLVideoElement): number | undefined {
    return (video as OwnedVideo).jfpOwner;
}

let nextInstanceId = 0;

/**
 * Granularidad con la que se publica la posición, en segundos.
 *
 * El <video> emite `timeupdate` a ~4 Hz, y publicar cada uno repintaba el OSD
 * entero cuatro veces por segundo para mover la barra una fracción de píxel.
 * Al segundo entero el reloj sigue siendo exacto (es lo que enseña la
 * etiqueta) y la barra avanza en pasos de 1 s: sobre un capítulo de 40 min,
 * un 0,04% de su ancho.
 *
 * Quien necesita la posición REAL (reportar progreso, reanudar, saltar) lee
 * `video.currentTime` y no este signal.
 */
const TIME_STEP_SECONDS = 1;

export class VideoPlayerViewModel {
    // Los colaboradores con estado propio. Se declaran ANTES que los
    // signals públicos porque estos delegan en ellos, y los inicializadores de
    // campo corren en orden de declaración.
    private readonly segments = new SegmentTracker();
    private readonly prefs = new TitlePreferences(() => this.api.session.load()?.userId ?? '');
    private readonly autoNext = new AutoNextTracker(
        (duration, tail) => this.segments.outroStart(duration, tail)
    );
    private readonly cast = new CastBinding();
    private readonly subtitles = new SubtitlesBinding();
    private readonly sleepTimer = new SleepTimerTracker(() => this.onSleepTimerExpire());
    private readonly filters = new VideoFilters();
    private readonly progress: ProgressReporter;
    private readonly trickplayMgr: TrickplayManager;
    private readonly audioTracksMgr: AudioTrackManager;
    private engine!: PlaybackEngine;

    // Estado observable que la View pinta. `currentTime` va redondeado al
    // segundo: ver TIME_STEP_SECONDS.
    currentTime = signal(0);
    duration = signal(0);
    /**
     * Cuánto salta cada botón y si el reloj cuenta hacia atrás. Son ajustes
     * del usuario (Ajustes → Reproducción), y están aquí como signals porque
     * la View pinta el número dentro del propio icono: cambiarlos tiene que
     * repintar los botones, no solo cambiar lo que hacen.
     */
    skip = signal(getSkipLengths());
    showRemainingTime = signal(getShowRemainingTime());
    playing = signal(false);
    volume = signal(1);
    muted = signal(false);
    fullscreen = signal(false);
    buffering = signal(false);
    loading = signal(true);
    error = signal<string | null>(null);
    title = signal('');
    get audioTracks() { return this.audioTracksMgr.audioTracks; }
    subtitleTracks = this.subtitles.subtitleTracks;
    /** Índice del stream de audio activo (índice Jellyfin, no posición). */
    get selectedAudio() { return this.audioTracksMgr.selectedAudio; }
    /** Índice del subtítulo activo, o null = desactivados. */
    selectedSubtitle = this.subtitles.selectedSubtitle;
    /** URL del VTT activo (solo subtítulos de texto). La View pinta <track>. */
    subtitleUrl = this.subtitles.subtitleUrl;
    /** Desfase manual de subtítulos en segundos (ej. +0.5s o -0.5s). */
    subtitleOffset = this.subtitles.subtitleOffset;
    /** Modo y tiempo restante del temporizador de apagado. */
    sleepTimerMode = this.sleepTimer.mode;
    sleepTimerRemaining = this.sleepTimer.remainingSeconds;
    /** Datos de Trickplay para previsualización de fotogramas al arrastrar la barra. */
    get trickplay() { return this.trickplayMgr.trickplay; }

    playbackRate = this.filters.playbackRate;
    aspectRatio = this.filters.aspectRatio;
    brightness = this.filters.brightness;
    /** El navegador soporta Picture-in-Picture (Firefox no expone la API). */
    pipAvailable = signal(false);
    pipActive = signal(false);
    /**
     * Hay receptores de Remote Playback (Chromecast en Chrome, AirPlay en
     * Safari) alcanzables para la fuente actual. Con transcode HLS (MSE)
     * Chrome no permite remoting y esto queda en false.
     */
    castAvailable = this.cast.castAvailable;
    castState = this.cast.castState;

    /**
     * Segmento (intro, créditos, resumen…) que contiene la posición actual, o
     * null, y la lista completa para la barra de progreso. Los mantiene
     * `SegmentTracker`; se reexponen aquí para que la View siga leyendo todo
     * del ViewModel.
     */
    activeSegment = this.segments.active;
    segmentList = this.segments.list;
    /**
     * Capítulos del item, para dividir la barra de progreso y poder saltar a
     * uno por su nombre. Vacío si el fichero no trae capítulos.
     */
    chapters = signal<ItemChapter[]>([]);
    /**
     * Episodio siguiente y avance del aviso que lo anuncia mientras corren
     * los créditos. Los mantiene `AutoNextTracker`.
     */
    nextEpisode = this.autoNext.next;
    autoNextProgress = this.autoNext.progress;
    /**
     * Sube a true cuando la reproducción llega al final. La View lo usa para
     * encadenar con la cola; el VM no navega (regla MVVM).
     */
    ended = signal(false);
    /**
     * Idiomas recordados para este título (la serie entera si es un episodio)
     * y si el item es un episodio. Los mantiene `TitlePreferences`.
     */
    titlePref = this.prefs.pref;
    titleIsSeries = this.prefs.isSeries;

    get currentItemId(): string {
        return this.engine.itemId;
    }

    get video() { return this.engineVideo; }
    private engineVideo: HTMLVideoElement | null = null;
    private container: HTMLElement | null = null;
    private detachFns: (() => void)[] = [];

    private closed = false;

    /** Identifica a esta instancia como dueña del <video> (ver OwnedVideo). */
    private readonly instanceId = ++nextInstanceId;

    /**
     * Los controles que pinta el navegador o el sistema fuera de nuestro OSD:
     * la pantalla de bloqueo y la notificación en un móvil, y en escritorio la
     * ventana flotante de picture-in-picture, las teclas de multimedia y el
     * hub del navegador. Se activa al abrir un item, en cualquier layout.
     */
    private mediaSession = new MediaSessionBinding({
        title: () => this.title.value,
        artwork: () => ([192, 512] as const).flatMap((size) => {
            const src = this.api.images.imageUrl(this.engine.itemId, 'Primary', { maxWidth: size });
            return src ? [{ src, sizes: `${size}x${size}`, type: 'image/webp' }] : [];
        }),
        paused: () => !!this.video?.paused,
        position: () => {
            const duration = this.duration.value;
            if (!Number.isFinite(duration) || duration <= 0) return null;
            // Del <video> y no del signal: ese va cuantizado al segundo para
            // la View (ver TIME_STEP_SECONDS) y aquí interesa la posición
            // exacta, que es la que interpola la pantalla de bloqueo.
            const position = this.video?.currentTime ?? 0;
            return {
                duration,
                position: clamp(position, 0, duration),
                playbackRate: this.playbackRate.value || 1
            };
        },
        play: () => {
            const v = this.video;
            if (v?.paused) void v.play().catch(() => { /* autoplay denegado */ });
        },
        pause: () => { this.video?.pause(); },
        seekBy: (delta) => this.seekBy(delta),
        seekTo: (seconds) => this.seek(seconds)
    });

    constructor(private api: ApiService) {
        this.progress = new ProgressReporter(api);
        this.trickplayMgr = new TrickplayManager(api);
        this.audioTracksMgr = new AudioTrackManager(this.prefs, (opts) => this.engine.reload(opts));
        
        this.engine = new PlaybackEngine(api, {
            video: null,
            loading: this.loading,
            error: this.error,
            title: this.title,
            ended: this.ended,
            playing: this.playing,
            chapters: this.chapters,
            buffering: this.buffering,
            trickplayMgr: this.trickplayMgr,
            audioTracksMgr: this.audioTracksMgr,
            subtitles: this.subtitles,
            segments: this.segments,
            autoNext: this.autoNext,
            progress: this.progress,
            prefs: this.prefs,
            mediaSessionStart: () => this.mediaSession.start()
        });
    }

    private eventBinding = new PlayerEventBinding();

    /**
     * Conecta el VM al <video> y su contenedor (para fullscreen). La View lo
     * llama al montar; devuelve el cleanup para el desmontaje.
     */
    attach(video: HTMLVideoElement, container: HTMLElement): () => void {
        this.engineVideo = video;
        this.engine['state'].video = video;
        this.container = container;
        this.closed = false;
        (video as OwnedVideo).jfpOwner = this.instanceId;

        this.filters.attach(video);
        this.progress.attach(video);

        const detach = this.eventBinding.attach(
            video,
            container,
            {
                duration: this.duration,
                volume: this.volume,
                muted: this.muted,
                playing: this.playing,
                buffering: this.buffering,
                loading: this.loading,
                ended: this.ended,
                playbackRate: this.playbackRate,
                pipAvailable: this.pipAvailable,
                pipActive: this.pipActive,
                fullscreen: this.fullscreen,
                error: this.error,
                publishTime: (t) => this.publishTime(t),
                syncSegments: (t) => this.segments.syncTo(t),
                syncAutoNext: (t, d) => this.autoNext.syncTo(t, d),
                startProgressTimer: this.progress.startProgressTimer,
                stopProgressTimer: this.progress.stopProgressTimer,
                reportProgress: this.progress.reportProgress,
                flushPendingSubtitle: () => this.subtitles.flushPendingSubtitle(),
                handleEpisodeEnd: () => this.sleepTimer.handleEpisodeEnd(),
                syncMediaSessionPlayback: () => this.mediaSession.syncPlayback(),
                syncMediaSessionPosition: (opts) => this.mediaSession.syncPosition(opts),
                watchCast: (v) => this.cast.watch(v),
                retrySource: () => this.engine.retrySource(),
                isClosed: () => this.engine.isClosed,
                setHasStarted: (v) => this.engine.setHasStarted(v)
            },
            VOLUME_KEY
        );
        this.detachFns.push(detach);

        return () => this.close();
    }

    /** Carga y reproduce un item. startTicks reanuda desde esa posición. */
    async open(itemId: string, opts: { startTicks?: number; title?: string } = {}) {
        await this.engine.open(itemId, opts);
    }

    /** Olvida los idiomas recordados de este título: a partir de la próxima reproducción vuelve a mandar la preferencia del usuario. */
    clearTitlePref = this.prefs.clear;

    /** El usuario descarta el aviso: no vuelve en este episodio. */
    dismissAutoNext = this.autoNext.dismiss;

    // ── Comandos ────────────────────────────────────────────────────────────

    togglePlay = () => {
        const v = this.video;
        if (!v) return;
        if (v.paused) {
            void v.play().catch(() => {
                this.playing.value = false;
            });
        } else {
            v.pause();
        }
    };

    play = () => {
        const v = this.video;
        if (!v) return;
        if (v.paused) {
            void v.play().catch(() => {
                this.playing.value = false;
            });
        }
    };

    pause = () => {
        const v = this.video;
        if (!v) return;
        if (!v.paused) v.pause();
    };

    setSleepTimer = (mode: SleepTimerMode) => { this.sleepTimer.setMode(mode); };
    setSubtitleOffset = (seconds: number) => { this.subtitles.setSubtitleOffset(seconds); };
    adjustSubtitleOffset = (delta: number) => { this.subtitles.adjustSubtitleOffset(delta); };
    resetSubtitleOffset = () => { this.subtitles.resetSubtitleOffset(); };

    cycleSubtitles = () => {
        this.subtitles.cycleSubtitles((opts) => this.engine.reload(opts));
    };

    toggleSubtitles = () => {
        this.subtitles.toggleSubtitles((opts) => this.engine.reload(opts));
    };

    getThumbnail = (seconds: number) => this.trickplayMgr.getThumbnail(seconds);

    private onSleepTimerExpire = () => {
        this.pause();
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('jfp-sleep-timer-expired'));
        }
    };

    /**
     * Salto pedido por el usuario (barra, flechas, capítulos, mandos del
     * sistema). Devuelve la oferta de saltar los tramos que el destino deja
     * por delante: si vuelves a la intro, el botón tiene que estar ahí otra
     * vez aunque ya la hubieras saltado.
     */
    seek = (seconds: number) => {
        this.segments.unskipFrom(seconds);
        this.seekTo(seconds);
    };

    /** Mueve la posición sin tocar los tramos ya descartados. */
    private seekTo(seconds: number) {
        const v = this.video;
        if (!v || !Number.isFinite(seconds)) return;
        v.currentTime = clamp(seconds, 0, this.duration.value || seconds);
        this.publishTime(v.currentTime);
        // El salto invalida lo que la pantalla de bloqueo tuviera pintado.
        this.mediaSession.syncPosition({ immediate: true });
    }

    /**
     * Publica la posición para la View, cuantizada (ver TIME_STEP_SECONDS).
     * Escribir el signal solo cuando el valor redondeado cambia es lo que
     * recorta el repintado del OSD de ~4 Hz a 1 Hz.
     */
    private publishTime(seconds: number) {
        const step = Math.floor(seconds / TIME_STEP_SECONDS) * TIME_STEP_SECONDS;
        if (step !== this.currentTime.value) this.currentTime.value = step;
    }

    seekBy = (delta: number) => this.seek((this.video?.currentTime ?? 0) + delta);

    /** Rebobinar y adelantar, con la longitud que el usuario haya elegido. */
    skipBackward = () => this.seekBy(-this.skip.value.back);
    skipForward = () => this.seekBy(this.skip.value.forward);

    /** Relee las preferencias del reproductor tras un cambio en Ajustes. */
    reloadPlaybackPrefs = () => {
        this.skip.value = getSkipLengths();
        this.showRemainingTime.value = getShowRemainingTime();
    };

    setVolume = (value: number) => {
        const v = this.video;
        if (!v) return;
        v.volume = clamp(value, 0, 1);
        if (v.volume > 0) v.muted = false;
    };

    toggleMute = () => {
        const v = this.video;
        if (!v) return;
        v.muted = !v.muted;
    };

    setPlaybackRate = this.filters.setPlaybackRate;
    setAspectRatio = this.filters.setAspectRatio;
    setBrightness = this.filters.setBrightness;

    toggleFullscreen = () => {
        const el = this.container;
        if (!el) return;
        if (document.fullscreenElement) {
            void document.exitFullscreen?.().catch((e) => { logger.debug('Error exiting fullscreen', e); });
        } else {
            void el.requestFullscreen?.().catch((e) => { logger.debug('Error requesting fullscreen', e); });
        }
    };

    togglePip = () => {
        const v = this.video;
        if (!v || !this.pipAvailable.value) return;
        if (document.pictureInPictureElement === v) {
            void document.exitPictureInPicture().catch((e) => { logger.debug('Error exiting PiP', e); });
        } else {
            void v.requestPictureInPicture().catch((e) => { logger.debug('Error requesting PiP', e); });
        }
    };

    /**
     * Qué hace el botón de «siguiente» de los mandos del sistema y de la
     * ventana de picture-in-picture. Lo pone la View: qué viene después
     * depende de la cola —que es suya— y encadenar significa navegar, que el
     * VM no hace.
     *
     * Con `null` el botón se queda apagado, que es lo correcto cuando no hay
     * nada detrás: un botón pulsable que no hace nada es peor que uno gris.
     */
    setNextTrack = (handler: (() => void) | null) => {
        this.mediaSession.setNextTrack(handler);
    };

    /**
     * Salta el segmento activo: lleva la reproducción a su final. El tramo
     * queda descartado y no se vuelve a ofrecer.
     */
    skipActiveSegment = () => {
        const target = this.segments.skipActive(this.duration.value);
        if (target === null) return;
        // seekTo y no seek: este salto NO debe rehabilitar el tramo que se
        // acaba de descartar (el destino cae dentro de él por el recorte).
        this.seekTo(target);
    };

    /**
     * Para la reproducción local porque se ha delegado en un Chromecast. No
     * cierra la sesión ni reporta el stop: el receptor sigue el mismo item y
     * es él quien reporta progreso al servidor a partir de ahora.
     */
    pauseForCast = () => {
        this.cast.pauseForCast(this.video, () => this.progress.stopProgressTimer());
    };

    /** Abre el selector de receptores del navegador (Cast/AirPlay). */
    promptCast = () => {
        this.cast.prompt(this.video);
    };

    /**

     * Cambia la pista de audio: nuevo PlaybackInfo conservando la posición.
     * El idioma elegido queda recordado para el título (o para la serie
     * entera), que es la preferencia de máxima prioridad.
     */
    setAudioTrack = (index: number) => this.audioTracksMgr.setAudioTrack(index);

    /**
     * Cambia subtítulos. Texto → <track> VTT externo sin recargar. Formatos
     * de imagen (PGS/VOB) → el servidor los quema en el transcode.
     */
    setSubtitleTrack = (index: number | null) => {
        this.subtitles.setSubtitleTrack(
            index,
            (opts) => this.engine.reload(opts),
            (patch) => this.prefs.remember(patch),
            (streamIdx) => this.engine.decision ? this.api.playback.subtitleVttUrl(this.engine.itemId, this.engine.decision.mediaSourceId, streamIdx) : null
        );
    };

    /**
     * Refresca las pistas de subtítulos consultando de nuevo al servidor
     * (útil tras subir o descargar un subtítulo nuevo durante la reproducción).
     */
    refreshSubtitleTracks = async (selectNewest = true) => {
        if (!this.engine.itemId || this.closed) return;
        const previousIndexes = new Set(this.subtitleTracks.value.map((s) => s.index));
        const video = this.video;
        if (!video) return;
        await this.engine.loadSource({
            audioStreamIndex: this.selectedAudio.value ?? undefined,
            subtitleStreamIndex: this.selectedSubtitle.value ?? -1,
            mediaSourceId: this.engine.decision?.mediaSourceId
        }, { fresh: true });

        if (selectNewest) {
            const newStream = this.subtitleTracks.value.find((s) => !previousIndexes.has(s.index));
            if (newStream) {
                this.setSubtitleTrack(newStream.index);
            }
        }
    };

    /** Para la reproducción y reporta el stop. Idempotente. */
    close() {
        if (this.closed) return;
        this.closed = true;
        this.progress.stopProgressTimer();
        const position = Math.floor((this.video?.currentTime ?? 0) * TICKS_PER_SECOND);
        if (this.engine.itemId) {
            void this.api.playback.reportPlaybackStop(
                this.engine.itemId, position, this.engine.decision?.playSessionId
            );
        }
        
        this.engine.close();
        this.mediaSession.stop();
        this.sleepTimer.dispose();
        this.detachFns.forEach((fn) => { fn(); });
        this.detachFns = [];
        
        if (this.video && videoOwner(this.video) === this.instanceId) {
            if (document.pictureInPictureElement === this.video) {
                void document.exitPictureInPicture().catch((e) => { logger.debug('Error exiting PiP on dispose', e); });
            }
            this.video.pause();
            this.video.removeAttribute('src');
            this.video.load();
        }
        this.filters.detach();
        this.progress.detach();
        this.engineVideo = null;
        this.engine['state'].video = null;
        this.container = null;
        
        this.currentTime.value = 0;
        this.duration.value = 0;
        this.playing.value = false;
        this.buffering.value = false;
        this.loading.value = true;
        this.error.value = null;
        this.audioTracksMgr.reset();
        this.filters.reset();
        this.pipActive.value = false;
        this.subtitles.reset();
        this.cast.reset();
        this.segments.reset();
        this.sleepTimer.reset();
        this.trickplayMgr.reset();
        this.chapters.value = [];
        this.autoNext.reset();
        this.ended.value = false;
        this.prefs.reset('');
    }



}

export const videoPlayerVM = new VideoPlayerViewModel(apiService);
