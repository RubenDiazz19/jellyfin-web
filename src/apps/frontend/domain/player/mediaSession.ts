// Media Session: los controles del sistema (pantalla de bloqueo,
// notificación, botones del manos libres) hablando con nuestro <video>.
//
// Solo se activa en mobile/tablet: en desktop manda el OSD y no hay ninguna
// superficie del sistema que rellenar. Toda la API se toca dentro de try/catch
// porque cada navegador soporta un subconjunto distinto y lanzar aquí tumbaría
// una reproducción que por lo demás va bien.

/** Lo que la sesión del sistema necesita saber y poder pedirle al reproductor. */
export type MediaSessionHost = {
    title(): string;
    /** Carátulas para la notificación, por tamaño. */
    artwork(): MediaImage[];
    paused(): boolean;
    /** Posición actual, o null si aún no hay duración fiable. */
    position(): MediaPositionState | null;
    play(): void;
    pause(): void;
    seekBy(delta: number): void;
    seekTo(seconds: number): void;
};

const ACTIONS: MediaSessionAction[] = [
    'play', 'pause', 'seekbackward', 'seekforward', 'seekto'
];

/** Salto por defecto cuando el sistema no dice cuánto. */
const DEFAULT_SEEK_OFFSET = 10;

/**
 * Cadencia máxima de `setPositionState`.
 *
 * El spec la sitúa en torno a 1 Hz y los navegadores han empezado a descartar
 * las llamadas que van por encima. El <video> emite `timeupdate` a ~4 Hz, así
 * que sin este freno se publicaban cuatro estados por segundo, tres de ellos
 * tirados a la basura. La superficie del sistema no se queda atrás por esto:
 * el estado lleva `playbackRate` justamente para que interpole entre avisos.
 */
const POSITION_MIN_MS = 1000;

export class MediaSessionBinding {
    private active = false;
    /** Cuándo se publicó el último estado de posición (ver POSITION_MIN_MS). */
    private lastPositionAt = 0;

    constructor(private host: MediaSessionHost) {}

    /** Publica el item actual y engancha los mandos. No hace nada en desktop. */
    start(enabled: boolean) {
        if (!enabled || !('mediaSession' in navigator)) return;
        const ms = navigator.mediaSession;

        try {
            ms.metadata = new MediaMetadata({
                title: this.host.title() || 'Jellyfin',
                artwork: this.host.artwork()
            });
        } catch { /* MediaMetadata no disponible: seguimos sin carátula */ }

        const set = (action: MediaSessionAction, handler: MediaSessionActionHandler) => {
            try {
                ms.setActionHandler(action, handler);
            } catch { /* acción no soportada por este navegador */ }
        };
        set('play', () => this.host.play());
        set('pause', () => this.host.pause());
        set('seekbackward', (d) => this.host.seekBy(-(d.seekOffset ?? DEFAULT_SEEK_OFFSET)));
        set('seekforward', (d) => this.host.seekBy(d.seekOffset ?? DEFAULT_SEEK_OFFSET));
        set('seekto', (d) => {
            if (d.seekTime != null) this.host.seekTo(d.seekTime);
        });

        this.active = true;
        this.lastPositionAt = 0;
        this.syncPlayback();
        this.syncPosition({ immediate: true });
    }

    /** El sistema pinta play o pausa según esto. */
    syncPlayback() {
        if (!this.active) return;
        navigator.mediaSession.playbackState = this.host.paused() ? 'paused' : 'playing';
    }

    /**
     * Alimenta la barra de progreso de la pantalla de bloqueo, como mucho una
     * vez por segundo (ver POSITION_MIN_MS).
     *
     * `immediate` salta el freno: lo usan los cambios que invalidan el estado
     * publicado —duración conocida, velocidad distinta, salto— y que por tanto
     * no pueden esperar a la siguiente ventana.
     */
    syncPosition({ immediate = false }: { immediate?: boolean } = {}) {
        if (!this.active) return;
        const now = Date.now();
        if (!immediate && now - this.lastPositionAt < POSITION_MIN_MS) return;
        const ms = navigator.mediaSession;
        if (typeof ms.setPositionState !== 'function') return;
        const state = this.host.position();
        if (!state) return;
        this.lastPositionAt = now;
        try {
            ms.setPositionState(state);
        } catch { /* valores transitorios inválidos durante un cambio de fuente */ }
    }

    /** Borra el item del sistema. Idempotente. */
    stop() {
        if (!this.active) return;
        this.active = false;
        const ms = navigator.mediaSession;
        ms.metadata = null;
        ms.playbackState = 'none';
        for (const action of ACTIONS) {
            try {
                ms.setActionHandler(action, null);
            } catch { /* ignorar */ }
        }
    }
}
