// Reproductor de vídeo del frontend: <video> nativo controlado por
// VideoPlayerViewModel + OSD propio (controles, ajustes, atajos de teclado).
import { useCallback, useEffect, useRef, useState } from 'react';
import { videoPlayerVM, type AspectRatio } from '../../../domain/viewModels/VideoPlayerViewModel';
import { useViewModel } from '../../../domain/bridge/useViewModel';
import { currentMobileLayout, observeLayoutMode } from '../../../shared/layoutMode';
import { PlayerIc } from './playerIcons';
import { VideoControls } from './VideoControls';
import { VideoGestures } from './VideoGestures';

const HIDE_CONTROLS_MS = 3000;
const HINTS_KEY = 'jfp-gesture-hints-seen';

// Detección de reproductor táctil. El reproductor se monta fuera de
// AppLayout (sin MobileThemeProvider), así que el modo se lee de las clases
// de <html> directamente. `portrait` alterna el OSD compacto/esencial.
function useTouchPlayback(): { touch: boolean; portrait: boolean } {
    const [touch, setTouch] = useState(() => currentMobileLayout() !== null);
    const [portrait, setPortrait] = useState(
        () => typeof window.matchMedia === 'function'
            && window.matchMedia('(orientation: portrait)').matches
    );
    useEffect(() => observeLayoutMode(() => setTouch(currentMobileLayout() !== null)), []);
    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia('(orientation: portrait)');
        const apply = () => setPortrait(mq.matches);
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);
    return { touch, portrait };
}

type Props = {
    itemId: string;
    startTicks?: number;
    title?: string;
    onClose: () => void;
};

export function VideoPlayer({ itemId, startTicks, title, onClose }: Props) {
    useViewModel(videoPlayerVM);
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [controlsVisible, setControlsVisible] = useState(true);
    const { touch, portrait } = useTouchPlayback();
    // Controles bloqueados (solo táctil): oculta OSD e ignora gestos hasta
    // desbloquear. Overlay de hints de primer uso.
    const [locked, setLocked] = useState(false);
    const [showHints, setShowHints] = useState(false);
    const [suggestLandscape, setSuggestLandscape] = useState(false);

    // startTicks/title solo importan al abrir; un cambio de itemId re-monta
    // la reproducción y captura los valores actuales.
    const openOpts = useRef({ startTicks, title });
    openOpts.current = { startTicks, title };

    useEffect(() => {
        const video = videoRef.current;
        const container = containerRef.current;
        if (!video || !container) return;
        const cleanup = videoPlayerVM.attach(video, container);
        void videoPlayerVM.open(itemId, openOpts.current);
        return cleanup;
    }, [itemId]);

    const showControls = useCallback(() => {
        setControlsVisible(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => {
            // En pausa los controles no se ocultan.
            if (!videoPlayerVM.playing.peek()) return;
            const root = containerRef.current;
            // Con un panel de ajustes abierto (subtítulos/audio/velocidad/
            // aspecto) NO ocultamos: si no, el OSD se desvanecía mientras
            // elegías una pista y el click caía en el vacío. El panel solo
            // existe en el DOM cuando está abierto.
            if (root?.querySelector('.jfp-video-settings-menu')) return;
            // Tampoco con el ratón encima de la barra.
            if (root?.querySelector('.jfp-video-controls:hover')) return;
            setControlsVisible(false);
        }, HIDE_CONTROLS_MS);
    }, []);

    // Al pausar, muestra los controles; al reanudar, rearma el temporizador.
    const playing = videoPlayerVM.playing.value;
    useEffect(() => { showControls(); }, [playing, showControls]);

    // Entrar/salir de pantalla completa siempre deja el OSD visible (vía el
    // signal del VM, que es la fuente de verdad del estado fullscreen — más
    // fiable que el evento del document en algunos navegadores).
    const isFullscreen = videoPlayerVM.fullscreen.value;
    useEffect(() => { showControls(); }, [isFullscreen, showControls]);

    // Cualquier actividad del usuario saca el OSD, escuchando en `document`
    // en vez de solo en el contenedor: en pantalla completa el elemento que
    // recibe el puntero puede no ser el nuestro (el <video>, el chrome del
    // navegador o la capa superior), y entonces los controles se quedaban
    // ocultos sin forma de recuperarlos. También lo mostramos al entrar o
    // salir de fullscreen para que siempre haya un punto de partida visible.
    useEffect(() => {
        const wake = () => showControls();
        const opts = { passive: true } as const;
        document.addEventListener('pointermove', wake, opts);
        document.addEventListener('mousemove', wake, opts);
        document.addEventListener('touchstart', wake, opts);
        document.addEventListener('wheel', wake, opts);
        document.addEventListener('keydown', wake, opts);
        document.addEventListener('fullscreenchange', wake);
        return () => {
            document.removeEventListener('pointermove', wake);
            document.removeEventListener('mousemove', wake);
            document.removeEventListener('touchstart', wake);
            document.removeEventListener('wheel', wake);
            document.removeEventListener('keydown', wake);
            document.removeEventListener('fullscreenchange', wake);
        };
    }, [showControls]);

    useEffect(() => () => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
    }, []);

    // Hints de gestos en el primer uso táctil (una vez, persistido).
    useEffect(() => {
        if (!touch) return;
        if (localStorage.getItem(HINTS_KEY)) return;
        setShowHints(true);
        const t = setTimeout(() => {
            setShowHints(false);
            localStorage.setItem(HINTS_KEY, '1');
        }, 4200);
        return () => clearTimeout(t);
    }, [touch]);

    const dismissHints = useCallback(() => {
        setShowHints(false);
        localStorage.setItem(HINTS_KEY, '1');
    }, []);

    // Sugerencia de landscape: chip breve al reproducir en vertical (una vez
    // por sesión, y solo si no está ya en horizontal).
    const suggestedRef = useRef(false);
    useEffect(() => {
        if (!touch || !portrait || suggestedRef.current) return;
        suggestedRef.current = true;
        setSuggestLandscape(true);
        const t = setTimeout(() => setSuggestLandscape(false), 3800);
        return () => clearTimeout(t);
    }, [touch, portrait]);

    // Atajos de teclado del OSD.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
            switch (e.key) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    videoPlayerVM.togglePlay();
                    break;
                case 'm':
                    videoPlayerVM.toggleMute();
                    break;
                case 'f':
                    videoPlayerVM.toggleFullscreen();
                    break;
                case 'p':
                    videoPlayerVM.togglePip();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    videoPlayerVM.seekBy(-10);
                    break;
                case 'ArrowRight':
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
                case 'Escape':
                    // Con fullscreen activo, Escape ya lo cierra el navegador.
                    if (!document.fullscreenElement) onClose();
                    break;
                default:
                    return;
            }
            showControls();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, showControls]);

    // Aplica el modo de los text tracks cuando cambia el subtítulo activo.
    const subtitleUrl = videoPlayerVM.subtitleUrl.value;
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        for (const track of Array.from(video.textTracks)) {
            track.mode = subtitleUrl ? 'showing' : 'disabled';
        }
    }, [subtitleUrl]);

    const loading = videoPlayerVM.loading.value;
    const buffering = videoPlayerVM.buffering.value;
    const error = videoPlayerVM.error.value;
    const brightness = videoPlayerVM.brightness.value;
    const idle = !controlsVisible && !error;
    const videoStyle = aspectRatioStyle(videoPlayerVM.aspectRatio.value);
    // El brillo (gesto táctil) es un filtro CSS; en desktop siempre es 1 y no
    // altera el render.
    if (touch && brightness < 1) videoStyle.filter = `brightness(${brightness})`;

    const rootClass = [
        'jfp-video',
        idle ? 'is-idle' : '',
        touch ? 'is-touch' : '',
        touch ? (portrait ? 'is-portrait' : 'is-landscape') : '',
        locked ? 'is-locked' : ''
    ].filter(Boolean).join(' ');

    // En táctil los gestos gobiernan el toque; el onClick/onDoubleClick del
    // ratón se desactiva para no duplicar acciones. En desktop, intactos.
    const mouseHandlers = touch ? {} : {
        onClick: () => { videoPlayerVM.togglePlay(); showControls(); },
        onDoubleClick: videoPlayerVM.toggleFullscreen
    };

    return (
        <div
            ref={containerRef}
            className={rootClass}
            onPointerMove={showControls}
            {...mouseHandlers}
        >
            {/* Los subtítulos se montan como <track> dinámico según la pista elegida. */}
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
                ref={videoRef} className='jfp-video-el' playsInline crossOrigin='anonymous'
                style={videoStyle}
            >
                {subtitleUrl && (
                    // key fuerza el remount: si solo cambia el src, el navegador
                    // no recarga el VTT y siguen apareciendo los subtítulos
                    // viejos.
                    <track
                        key={subtitleUrl}
                        kind='subtitles'
                        src={subtitleUrl}
                        default
                        label='Subtítulos'
                    />
                )}
            </video>

            {/* Gestos táctiles: solo mobile/tablet y con los controles
                desbloqueados. En desktop no se monta nada. */}
            {touch && !locked && (
                <VideoGestures onClose={onClose} onWake={showControls} />
            )}

            <div className='jfp-video-top' onClick={(e) => e.stopPropagation()}>
                <button
                    type='button'
                    className='jfp-video-btn'
                    onClick={onClose}
                    aria-label='Volver'
                >
                    <PlayerIc.Back />
                </button>
                {videoPlayerVM.title.value && (
                    <div className='jfp-video-title'>{videoPlayerVM.title.value}</div>
                )}
                {touch && (
                    <button
                        type='button'
                        className='jfp-video-btn jfp-video-top-lock'
                        onClick={() => setLocked(true)}
                        aria-label='Bloquear controles'
                    >
                        <PlayerIc.LockOpen />
                    </button>
                )}
            </div>

            {/* Bloqueo (táctil): oculta OSD y gestos, deja solo el candado. */}
            {touch && locked && (
                <button
                    type='button'
                    className='jfp-video-unlock'
                    onClick={() => setLocked(false)}
                    aria-label='Desbloquear controles'
                >
                    <PlayerIc.Lock />
                </button>
            )}

            {/* Sugerencia de landscape (táctil, vertical, una vez). */}
            {touch && suggestLandscape && !locked && (
                <div className='jfp-video-rotate-hint' onClick={(e) => e.stopPropagation()}>
                    <PlayerIc.Rotate size={18} />
                    Gira el dispositivo para pantalla completa
                </div>
            )}

            {/* Hints de gestos en el primer uso. */}
            {touch && showHints && !locked && (
                <div className='jfp-gesture-hints' onClick={dismissHints}>
                    <div className='jfp-gesture-hints-card'>
                        <div className='jfp-gesture-hints-title'>Gestos del reproductor</div>
                        <ul className='jfp-gesture-hints-list'>
                            <li>Toca para reproducir o pausar</li>
                            <li>Doble toque a los lados: ±10 s</li>
                            <li>Desliza horizontal para avanzar</li>
                            <li>Vertical: brillo (izq.) y volumen (der.)</li>
                            <li>Pellizca para ajustar el encuadre</li>
                        </ul>
                        <div className='jfp-gesture-hints-dismiss'>Toca para cerrar</div>
                    </div>
                </div>
            )}

            {(loading || buffering) && !error && (
                <div className='jfp-video-loading' aria-label='Cargando'>
                    <PlayerIc.Spinner />
                </div>
            )}

            {error && (
                <div className='jfp-video-error' onClick={(e) => e.stopPropagation()}>
                    <div className='jfp-video-error-msg'>{error}</div>
                    <button type='button' className='jfp-video-error-btn' onClick={onClose}>
                        Volver
                    </button>
                </div>
            )}

            <VideoControls />
        </div>
    );
}

// Traduce el modo de aspecto elegido a estilos del <video>. Los modos con
// proporción fija dan a la caja del vídeo esa relación (centrada, con barras
// donde haga falta) y estiran el contenido para llenarla.
function aspectRatioStyle(mode: AspectRatio): React.CSSProperties {
    switch (mode) {
        case 'cover':
            return { width: '100%', height: '100%', objectFit: 'cover' };
        case 'fill':
            return { width: '100%', height: '100%', objectFit: 'fill' };
        case '16:9':
        case '4:3':
        case '21:9': {
            const [w, h] = mode.split(':');
            return {
                position: 'absolute', inset: 0, margin: 'auto',
                width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%',
                aspectRatio: `${w} / ${h}`, objectFit: 'fill'
            };
        }
        default:
            return { width: '100%', height: '100%', objectFit: 'contain' };
    }
}
