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
import type { ItemChapter, PlaybackContext } from '../../data/api/playbackContext';
import { segmentsFromChapters } from '../../data/api/chapterSegments';
import type { MediaSegment } from '../../data/api/segments';
import type { TitleLanguagePref } from '../../data/preferences/languagePrefs';
import { getSkipLengths, getShowRemainingTime } from '../../data/api/playbackPrefs';
import { TICKS_PER_SECOND, type AspectRatio } from '../player/format';
import { attachHlsSource, playsHlsNatively } from '../player/hlsSource';
import { MediaSessionBinding } from '../player/mediaSession';
import { AutoNextTracker } from '../player/autoNext';
import { SegmentTracker } from '../player/segmentTracker';
import { TitlePreferences } from '../player/titlePreferences';

const PROGRESS_REPORT_MS = 10_000;
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
    // Los tres colaboradores con estado propio. Se declaran ANTES que los
    // signals públicos porque estos delegan en ellos, y los inicializadores de
    // campo corren en orden de declaración.
    private readonly segments = new SegmentTracker();
    private readonly prefs = new TitlePreferences(() => this.userId());
    private readonly autoNext = new AutoNextTracker(
        (duration, tail) => this.segments.outroStart(duration, tail)
    );

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
    audioTracks = signal<MediaStreamInfo[]>([]);
    subtitleTracks = signal<MediaStreamInfo[]>([]);
    /** Índice del stream de audio activo (índice Jellyfin, no posición). */
    selectedAudio = signal<number | null>(null);
    /** Índice del subtítulo activo, o null = desactivados. */
    selectedSubtitle = signal<number | null>(null);
    /** URL del VTT activo (solo subtítulos de texto). La View pinta <track>. */
    subtitleUrl = signal<string | null>(null);
    /** Velocidad de reproducción actual (1 = normal). */
    playbackRate = signal(1);
    /** Relación de aspecto elegida para el <video>. La View la traduce a CSS. */
    aspectRatio = signal<AspectRatio>('auto');
    /**
     * Brillo del vídeo (0.15–1): gesto vertical izquierdo en táctil. Es un
     * filtro CSS sobre el <video>; no toca el brillo real del dispositivo
     * (el navegador no lo expone). La View lo traduce a filter: brightness().
     */
    brightness = signal(1);
    /** El navegador soporta Picture-in-Picture (Firefox no expone la API). */
    pipAvailable = signal(false);
    pipActive = signal(false);
    /**
     * Hay receptores de Remote Playback (Chromecast en Chrome, AirPlay en
     * Safari) alcanzables para la fuente actual. Con transcode HLS (MSE)
     * Chrome no permite remoting y esto queda en false.
     */
    castAvailable = signal(false);
    castState = signal<RemotePlaybackState>('disconnected');
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

    private video: HTMLVideoElement | null = null;
    private container: HTMLElement | null = null;
    private hls: Hls | null = null;
    private decision: PlaybackDecision | null = null;
    private itemId = '';
    private startSeconds = 0;
    private progressTimer: ReturnType<typeof setInterval> | null = null;
    private detachFns: (() => void)[] = [];
    /**
     * Quita el `loadedmetadata` de la carga en curso. Va aparte de `detachFns`
     * porque cada `loadSource` (y hay uno por cambio de pista) instala el
     * suyo: apilarlos ahí hacía crecer la lista hasta el `close()`.
     */
    private detachOnMeta: (() => void) | null = null;
    private closed = false;
    /** Subtítulo no-texto quemado en el transcode actual (índice Jellyfin). */
    private burnedSubtitle: number | null = null;
    /** VTT a la espera de que arranque la reproducción (ver publishSubtitle). */
    private pendingSubtitleUrl: string | null = null;
    /** La reproducción ha llegado a arrancar al menos una vez en este item. */
    private hasStarted = false;
    /** Opciones de la última carga, para poder reintentarla igual. */
    private lastSourceOpts: PlaybackOptions = {};
    /** Posición que hay que recuperar si el arranque falla y se reintenta. */
    private resumeSeconds = 0;
    private retriedSource = false;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private context: PlaybackContext | null = null;
    /**
     * La carga del contexto en vuelo. Como ya no siempre se espera antes de
     * arrancar la fuente, quien SÍ lo necesita (los segmentos, que caen a los
     * capítulos cuando el servidor no marca ninguno) se engancha aquí en vez
     * de leer `context` cuando puede no haber llegado.
     */
    private contextReady: Promise<void> = Promise.resolve();
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
            const src = this.api.images.imageUrl(this.itemId, 'Primary', { maxWidth: size });
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
                position: Math.min(Math.max(position, 0), duration),
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

    constructor(private api: ApiService) {}

    /**
     * Conecta el VM al <video> y su contenedor (para fullscreen). La View lo
     * llama al montar; devuelve el cleanup para el desmontaje.
     */
    attach(video: HTMLVideoElement, container: HTMLElement): () => void {
        this.video = video;
        this.container = container;
        this.closed = false;
        (video as OwnedVideo).jfpOwner = this.instanceId;

        const savedVolume = Number(localStorage.getItem(VOLUME_KEY) ?? '1');
        video.volume = Number.isFinite(savedVolume) ? Math.min(Math.max(savedVolume, 0), 1) : 1;
        this.volume.value = video.volume;

        // El <video> puede reutilizarse entre items: la velocidad no debe
        // heredarse de la reproducción anterior.
        video.defaultPlaybackRate = 1;
        video.playbackRate = 1;

        const on = <K extends keyof HTMLVideoElementEventMap>(
            ev: K, fn: () => void
        ) => {
            video.addEventListener(ev, fn);
            this.detachFns.push(() => video.removeEventListener(ev, fn));
        };

        on('timeupdate', () => {
            this.publishTime(video.currentTime);
            this.segments.syncTo(video.currentTime);
            this.autoNext.syncTo(video.currentTime, this.duration.value);
        });
        on('durationchange', () => {
            if (Number.isFinite(video.duration)) this.duration.value = video.duration;
        });
        on('play', () => {
            this.playing.value = true;
            // El reporte periódico solo tiene sentido mientras algo avanza.
            this.startProgressTimer();
        });
        on('pause', () => {
            this.playing.value = false;
            // Un timer vivo en pausa reenviaba la MISMA posición cada 10 s.
            // El estado de pausa se manda una vez, aquí.
            this.stopProgressTimer();
            void this.reportProgress();
        });
        on('waiting', () => { this.buffering.value = true; });
        on('playing', () => {
            this.buffering.value = false;
            this.loading.value = false;
            this.hasStarted = true;
            // Con el vídeo ya en marcha, el servidor puede dedicarse a
            // extraer subtítulos sin ahogar al transcode.
            this.flushPendingSubtitle();
        });
        on('canplay', () => { this.buffering.value = false; this.loading.value = false; });
        on('volumechange', () => {
            this.volume.value = video.volume;
            this.muted.value = video.muted;
            localStorage.setItem(VOLUME_KEY, String(video.volume));
        });
        on('ended', () => {
            this.playing.value = false;
            // Nada más que reportar de este item: el stop lo manda close().
            this.stopProgressTimer();
            void this.reportProgress();
            this.ended.value = true;
        });
        on('ratechange', () => { this.playbackRate.value = video.playbackRate; });

        // Media Session (mobile/tablet): controles del sistema sincronizados.
        on('play', () => this.mediaSession.syncPlayback());
        on('pause', () => this.mediaSession.syncPlayback());
        // `timeupdate` va sin `immediate`: es el que llega a ~4 Hz y el que el
        // freno de la propia binding recorta a ~1 Hz. Duración y velocidad sí
        // invalidan lo publicado, así que no pueden esperar.
        on('timeupdate', () => this.mediaSession.syncPosition());
        on('durationchange', () => this.mediaSession.syncPosition({ immediate: true }));
        on('ratechange', () => this.mediaSession.syncPosition({ immediate: true }));

        this.pipAvailable.value =
            typeof video.requestPictureInPicture === 'function'
            // eslint-disable-next-line compat/compat -- esta línea ES el feature-detect de PiP
            && !!document.pictureInPictureEnabled;
        on('enterpictureinpicture', () => { this.pipActive.value = true; });
        on('leavepictureinpicture', () => { this.pipActive.value = false; });

        this.watchRemotePlayback(video);
        on('error', () => {
            if (this.closed) return;
            // Un <video> SIN fuente no es un fallo de reproducción: es el
            // 'error' que dispara load() al limpiar el src (cierre o cambio
            // de item). Ese evento se despacha en un tick posterior, así que
            // llegaba cuando el siguiente attach ya había re-armado los
            // listeners y pintaba "no se pudo reproducir" encima de una
            // reproducción que estaba arrancando bien.
            if (!video.currentSrc && !video.getAttribute('src')) return;
            // El evento no dice qué ha pasado; el MediaError sí, y es lo
            // primero que hace falta para distinguir un códec no soportado
            // de un 401 o de un transcode caído.
            console.error(
                '[player] el <video> ha fallado',
                { code: video.error?.code, message: video.error?.message, src: video.currentSrc }
            );
            if (this.retrySource()) return;
            this.error.value = globalize.translate('MessagePlaybackFailed');
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
        this.ended.value = false;
        // Cada item estrena su reintento de arranque.
        this.retriedSource = false;
        this.hasStarted = false;
        this.autoNext.reset();
        this.resumeSeconds = this.startSeconds;
        // El contexto y la fuente arrancan a la vez, y solo se espera al
        // primero cuando puede cambiar lo que se le pide al segundo: si este
        // usuario tiene idiomas recordados de algún título, PlaybackInfo debe
        // salir ya con esas pistas para no tener que recargar nada más
        // empezar. Sin ninguno recordado —la primera reproducción— esperarlo
        // era una vuelta a la red de más delante del primer fotograma.
        this.contextReady = this.loadContext(itemId);
        if (this.prefs.hasAny()) await this.contextReady;
        await this.loadSource(this.prefs.tracksFor(this.context));
        void this.api.playback.reportPlaybackStart(itemId);
        // El timer de progreso lo arranca el evento 'play' y lo para 'pause':
        // si el autoplay se deniega no hay nada que reportar todavía.
        this.mediaSession.start();
        void this.loadSegments(itemId);
    }

    /**
     * Item + serie + capítulos + pistas, en una petición. Si falla, la
     * reproducción sigue sin preferencias por título ni salto por capítulos:
     * es información de apoyo, no un requisito.
     */
    private async loadContext(itemId: string) {
        this.context = null;
        this.prefs.reset(itemId);
        try {
            const context = await this.api.playback.getPlaybackContext(itemId);
            if (this.closed || this.itemId !== itemId) return;
            this.context = context;
            this.chapters.value = context.chapters;
            this.prefs.adopt(context);
            // El siguiente episodio no bloquea el arranque: solo hace falta
            // cuando el capítulo se acerca al final.
            if (context.isEpisode) void this.loadNextEpisode(context.titleId, itemId);
        } catch (e) {
            console.debug('[player] sin contexto del item', e);
        }
    }

    private async loadNextEpisode(seriesId: string, itemId: string) {
        try {
            const next = await this.api.playback.getNextEpisode(seriesId, itemId);
            if (this.closed || this.itemId !== itemId) return;
            this.nextEpisode.value = next;
        } catch (e) {
            console.debug('[player] sin siguiente episodio', e);
        }
    }

    /** Las preferencias por título se guardan separadas por cuenta. */
    private userId(): string {
        return this.api.session.load()?.userId ?? '';
    }

    /** Recuerda un idioma para este título (o para su serie). */
    private rememberLanguage(patch: TitleLanguagePref) {
        this.prefs.remember(patch);
    }

    /**
     * Olvida los idiomas recordados de este título: a partir de la próxima
     * reproducción vuelve a mandar la preferencia del usuario.
     */
    clearTitlePref = this.prefs.clear;

    /**
     * Segmentos del item (intro, créditos…). No bloquea la reproducción: si
     * el servidor no los tiene, el botón de salto simplemente no aparece.
     */
    private async loadSegments(itemId: string) {
        let segments: MediaSegment[];
        try {
            segments = await this.api.playback.getMediaSegments(itemId);
        } catch (e) {
            // Los segmentos son un extra: que fallen no puede tumbar la
            // reproducción ni dejar una promesa rechazada suelta.
            console.debug('[player] no se pudieron cargar los segmentos', e);
            return;
        }
        // La carga es asíncrona: el usuario puede haber salido o cambiado de
        // item mientras tanto.
        if (this.closed || this.itemId !== itemId) return;
        // Sin proveedor de segmentos en el servidor (el caso más común) se
        // aprovechan los capítulos: uno llamado "Intro"/"Opening"/"Resumen"
        // marca el mismo rango que haría falta saltar. Los capítulos vienen
        // del contexto, que puede seguir en vuelo (ver `contextReady`).
        if (segments.length === 0) await this.contextReady;
        if (this.closed || this.itemId !== itemId) return;
        if (segments.length === 0 && this.context) {
            segments = segmentsFromChapters(this.context.chapters, this.context.runtime);
        }
        this.segments.replace(segments);
        this.segments.syncTo(this.video?.currentTime ?? 0);
    }

    /** El usuario descarta el aviso: no vuelve en este episodio. */
    dismissAutoNext = this.autoNext.dismiss;

    // ── Comandos ────────────────────────────────────────────────────────────

    togglePlay = () => {
        const v = this.video;
        if (!v) return;
        if (v.paused) void v.play().catch(() => {});
        else v.pause();
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
        v.currentTime = Math.min(Math.max(seconds, 0), this.duration.value || seconds);
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
        v.volume = Math.min(Math.max(value, 0), 1);
        if (v.volume > 0) v.muted = false;
    };

    toggleMute = () => {
        const v = this.video;
        if (!v) return;
        v.muted = !v.muted;
    };

    setPlaybackRate = (rate: number) => {
        const v = this.video;
        if (!v || !Number.isFinite(rate)) return;
        const r = Math.min(Math.max(rate, 0.25), 3);
        // load() (recarga por cambio de pista) resetea playbackRate al valor
        // de defaultPlaybackRate — fijando ambos, la velocidad sobrevive.
        v.defaultPlaybackRate = r;
        v.playbackRate = r;
        this.playbackRate.value = r;
    };

    setAspectRatio = (mode: AspectRatio) => {
        this.aspectRatio.value = mode;
    };

    /** Ajusta el brillo del vídeo (filtro CSS). No baja de 0.15 (negro total). */
    setBrightness = (value: number) => {
        this.brightness.value = Math.min(Math.max(value, 0.15), 1);
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

    togglePip = () => {
        const v = this.video;
        if (!v || !this.pipAvailable.value) return;
        if (document.pictureInPictureElement === v) {
            void document.exitPictureInPicture().catch(() => {});
        } else {
            void v.requestPictureInPicture().catch(() => {});
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
        this.video?.pause();
        this.stopProgressTimer();
    };

    /** Abre el selector de receptores del navegador (Cast/AirPlay). */
    promptCast = () => {
        const remote = this.video?.remote;
        if (!remote) return;
        void remote.prompt().catch(() => {});
    };

    /**
     * Cambia la pista de audio: nuevo PlaybackInfo conservando la posición.
     * El idioma elegido queda recordado para el título (o para la serie
     * entera), que es la preferencia de máxima prioridad.
     */
    setAudioTrack = (index: number) => {
        if (index === this.selectedAudio.value) return;
        const language = this.audioTracks.value.find((a) => a.index === index)?.language;
        if (language) this.rememberLanguage({ audio: language });
        void this.reload({ audioStreamIndex: index });
    };

    /**
     * Cambia subtítulos. Texto → <track> VTT externo sin recargar. Formatos
     * de imagen (PGS/VOB) → el servidor los quema en el transcode.
     */
    setSubtitleTrack = (index: number | null) => {
        if (index === this.selectedSubtitle.value) return;
        const stream = index == null ?
            null :
            this.subtitleTracks.value.find((s) => s.index === index) ?? null;

        // Igual que con el audio: la elección manda sobre la preferencia del
        // usuario en las siguientes reproducciones de este título. Apagarlos
        // (null) también se recuerda; una pista sin idioma declarado no,
        // porque no habría con qué reencontrarla en otro episodio.
        if (index == null) this.rememberLanguage({ subtitle: null });
        else if (stream?.language) this.rememberLanguage({ subtitle: stream.language });

        // Si había un subtítulo quemado, quitarlo (o cambiarlo) exige recarga.
        // -1 = "sin subtítulos" explícito para que el servidor no reactive
        // el default del usuario.
        if (this.burnedSubtitle != null || (stream && !stream.isText)) {
            void this.reload({ subtitleStreamIndex: index ?? -1 });
            return;
        }

        this.selectedSubtitle.value = index;
        this.publishSubtitle(stream && this.decision ?
            this.api.playback.subtitleVttUrl(this.itemId, this.decision.mediaSourceId, stream.index) :
            null);
    };

    /** Para la reproducción y reporta el stop. Idempotente. */
    close() {
        if (this.closed) return;
        this.closed = true;
        this.stopProgressTimer();
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.retryTimer = null;
        const position = Math.floor((this.video?.currentTime ?? 0) * TICKS_PER_SECOND);
        if (this.itemId) {
            void this.api.playback.reportPlaybackStop(
                this.itemId, position, this.decision?.playSessionId
            );
        }
        this.hls?.destroy();
        this.hls = null;
        // Los listeners se quitan ANTES de tocar el <video>: pause() y load()
        // emiten eventos que ya no son de nadie.
        this.mediaSession.stop();
        this.detachOnMeta?.();
        this.detachFns.forEach((fn) => { fn(); });
        this.detachFns = [];
        // Solo se limpia el <video> si sigue siendo nuestro. Tras un recambio
        // en caliente (HMR) o un remontaje puede haber otra instancia del VM
        // ya reproduciendo en el MISMO elemento: ahí un load() de cortesía
        // tumbaría la fuente buena y dejaría un "no se pudo reproducir".
        if (this.video && videoOwner(this.video) === this.instanceId) {
            // La ventana PiP no debe sobrevivir a la salida del reproductor.
            if (document.pictureInPictureElement === this.video) {
                void document.exitPictureInPicture().catch(() => {});
            }
            this.video.pause();
            this.video.removeAttribute('src');
            this.video.load();
        }
        this.video = null;
        this.container = null;
        this.decision = null;
        this.reset();
    }

    // ── Interno ─────────────────────────────────────────────────────────────

    /** Sigue la disponibilidad de receptores remotos mientras dure el attach. */
    private watchRemotePlayback(video: HTMLVideoElement) {
        const remote = video.remote;
        if (!remote || typeof remote.watchAvailability !== 'function') return;

        this.castState.value = remote.state;
        const onConnecting = () => { this.castState.value = 'connecting'; };
        const onConnect = () => { this.castState.value = 'connected'; };
        const onDisconnect = () => { this.castState.value = 'disconnected'; };
        remote.addEventListener('connecting', onConnecting);
        remote.addEventListener('connect', onConnect);
        remote.addEventListener('disconnect', onDisconnect);

        let watchId: number | null = null;
        remote.watchAvailability((available) => { this.castAvailable.value = available; })
            .then((id) => { watchId = id; })
            .catch(() => { this.castAvailable.value = false; });

        this.detachFns.push(() => {
            remote.removeEventListener('connecting', onConnecting);
            remote.removeEventListener('connect', onConnect);
            remote.removeEventListener('disconnect', onDisconnect);
            if (watchId != null) void remote.cancelWatchAvailability(watchId).catch(() => {});
        });
    }

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
        this.pendingSubtitleUrl = null;
        this.lastSourceOpts = {};
        this.resumeSeconds = 0;
        this.retriedSource = false;
        this.hasStarted = false;
        this.playbackRate.value = 1;
        this.brightness.value = 1;
        this.pipActive.value = false;
        this.castAvailable.value = false;
        this.castState.value = 'disconnected';
        this.burnedSubtitle = null;
        this.segments.reset();
        this.chapters.value = [];
        this.autoNext.reset();
        this.ended.value = false;
        this.itemId = '';
        this.context = null;
        this.prefs.reset('');
    }

    /**
     * Pide PlaybackInfo y engancha la fuente (direct o HLS) al <video>.
     *
     * `fresh` fuerza a renegociar en vez de aceptar lo que haya cacheado (ver
     * `playbackCache`): lo pide el reintento de arranque, que existe
     * justamente porque la sesión anterior no llegó a levantar.
     */
    private async loadSource(opts: PlaybackOptions, cache: { fresh?: boolean } = {}) {
        const video = this.video;
        if (!video) return;
        this.lastSourceOpts = opts;
        try {
            // No pedimos startTimeTicks al servidor: las playlists HLS de
            // Jellyfin son VOD completas, así que basta con seek local tras
            // cargar metadatos (vale para direct y para transcode).
            const decision = await this.api.playback.getPlaybackDecision(
                this.itemId, opts, cache
            );
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

            if (decision.kind === 'hls' && !playsHlsNatively(video)) {
                const attached = await attachHlsSource(video, decision.url, {
                    isClosed: () => this.closed,
                    onUnrecoverable: () => {
                        if (this.retrySource()) return;
                        this.error.value = globalize.translate('MessageHlsFatalError');
                        this.loading.value = false;
                    }
                });
                if (attached.status === 'aborted') return;
                if (attached.status === 'unsupported') {
                    this.error.value = globalize.translate('MessageHlsUnsupported');
                    this.loading.value = false;
                    return;
                }
                this.hls = attached.hls;
            } else {
                video.src = decision.url;
            }

            // Subtítulo inicial o el que ha pedido la recarga (-1 = ninguno).
            const subIndex = opts.subtitleStreamIndex === -1 ?
                null :
                opts.subtitleStreamIndex ?? decision.activeSubtitleIndex ?? null;
            const subStream = subIndex == null ?
                null :
                decision.subtitleStreams.find((s) => s.index === subIndex) ?? null;
            if (subStream?.isText) {
                this.selectedSubtitle.value = subStream.index;
                this.publishSubtitle(this.api.playback.subtitleVttUrl(
                    this.itemId, decision.mediaSourceId, subStream.index
                ));
                this.burnedSubtitle = null;
            } else {
                this.selectedSubtitle.value = subStream?.index ?? null;
                this.publishSubtitle(null);
                this.burnedSubtitle = subStream ? subStream.index : null;
            }

            const seekTo = this.startSeconds;
            this.resumeSeconds = seekTo;
            this.startSeconds = 0;
            const onMeta = () => {
                if (seekTo > 0) video.currentTime = seekTo;
                void video.play().catch(() => {
                    // Autoplay bloqueado: el usuario pulsa play manualmente.
                    this.playing.value = false;
                    this.loading.value = false;
                });
            };
            // Solo puede haber uno vivo: el de la carga anterior ya no
            // corresponde a esta fuente.
            this.detachOnMeta?.();
            video.addEventListener('loadedmetadata', onMeta, { once: true });
            this.detachOnMeta = () => {
                video.removeEventListener('loadedmetadata', onMeta);
                this.detachOnMeta = null;
            };
        } catch (e) {
            if (this.closed) return;
            this.error.value = (e as Error).message || globalize.translate('MessagePlaybackStartFailed');
            this.loading.value = false;
        }
    }

    /**
     * Publica el subtítulo activo, pero NO antes de que el vídeo esté
     * reproduciendo.
     *
     * Motivo: pedir un solo VTT de un MKV hace que el servidor extraiga de
     * golpe TODAS sus pistas de texto (medido: 63 ffmpeg en una tacada). Si
     * eso coincide con el arranque del transcode, el transcode se ahoga y la
     * reproducción muere antes de empezar. Lanzándolo después, el vídeo ya va
     * y la extracción solo retrasa unos segundos la aparición del subtítulo.
     */
    private publishSubtitle(url: string | null) {
        // El criterio es "ya ha llegado a reproducir alguna vez", no "está
        // reproduciendo ahora": cambiar de subtítulo en pausa debe aplicarse
        // al momento.
        if (url == null || this.hasStarted) {
            this.pendingSubtitleUrl = null;
            this.subtitleUrl.value = url;
            return;
        }
        this.pendingSubtitleUrl = url;
        this.subtitleUrl.value = null;
    }

    /** Suelta el subtítulo que esperaba a que arrancara la reproducción. */
    private flushPendingSubtitle() {
        const url = this.pendingSubtitleUrl;
        if (!url) return;
        this.pendingSubtitleUrl = null;
        this.subtitleUrl.value = url;
    }

    /**
     * Un fallo en el arranque merece un segundo intento antes de rendirse: la
     * causa típica es que el servidor estaba ocupado extrayendo subtítulos y
     * no le dio tiempo a levantar el transcode. En el reintento ese trabajo ya
     * está hecho (queda en caché) y entra a la primera.
     *
     * Devuelve true si ha programado el reintento; false si ya se gastó.
     */
    private retrySource(): boolean {
        if (this.retriedSource || this.closed || !this.video) return false;
        this.retriedSource = true;
        this.loading.value = true;
        this.error.value = null;
        // Se reanuda donde estuviera (o donde se pidió abrir).
        this.startSeconds = Math.max(this.video.currentTime, this.resumeSeconds);
        console.warn('[player] fallo en el arranque: reintentando la fuente');
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            if (this.closed) return;
            // `fresh`: renegociar de cero. Repetir la sesión cacheada sería
            // repetir exactamente la que acaba de fallar.
            void this.loadSource(this.lastSourceOpts, { fresh: true });
        }, RETRY_SOURCE_MS);
        return true;
    }

    /** Recarga la fuente (cambio de pista) conservando posición y estado. */
    private async reload(opts: { audioStreamIndex?: number; subtitleStreamIndex?: number }) {
        const video = this.video;
        if (!video) return;
        this.startSeconds = video.currentTime;
        this.loading.value = true;
        // Cambiar de pista es un arranque nuevo: vuelve a haber un reintento.
        this.retriedSource = false;
        await this.loadSource({
            audioStreamIndex: opts.audioStreamIndex ?? this.selectedAudio.value ?? undefined,
            // Cambiar solo el audio no debe tocar los subtítulos: sin pedirlos
            // de forma explícita, el servidor reactiva su subtítulo por
            // defecto y «aparecen por la cara» al recargar. -1 = apagados.
            subtitleStreamIndex: opts.subtitleStreamIndex ?? this.selectedSubtitle.value ?? -1,
            mediaSourceId: this.decision?.mediaSourceId
        });
    }

    private startProgressTimer() {
        this.stopProgressTimer();
        this.progressTimer = setInterval(() => {
            void this.reportProgress();
        }, PROGRESS_REPORT_MS);
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
