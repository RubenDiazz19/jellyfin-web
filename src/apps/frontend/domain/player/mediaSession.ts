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

export class MediaSessionBinding {
    private active = false;

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
        this.syncPlayback();
        this.syncPosition();
    }

    /** El sistema pinta play o pausa según esto. */
    syncPlayback() {
        if (!this.active) return;
        navigator.mediaSession.playbackState = this.host.paused() ? 'paused' : 'playing';
    }

    /** Alimenta la barra de progreso de la pantalla de bloqueo. */
    syncPosition() {
        if (!this.active) return;
        const ms = navigator.mediaSession;
        if (typeof ms.setPositionState !== 'function') return;
        const state = this.host.position();
        if (!state) return;
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
