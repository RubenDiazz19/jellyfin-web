// Reproductor de vídeo del frontend: <video> nativo controlado por
// VideoPlayerViewModel + OSD propio (controles, ajustes, atajos de teclado).
import { useCallback, useEffect, useRef, useState } from 'react';
import { videoPlayerVM } from '../../../domain/viewModels/VideoPlayerViewModel';
import { useViewModel } from '../../../domain/bridge/useViewModel';
import { PlayerIc } from './playerIcons';
import { VideoControls } from './VideoControls';

const HIDE_CONTROLS_MS = 3000;

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
            // Tampoco con el ratón encima de la barra: ocultarla justo cuando
            // vas a pulsar un botón es lo que la hacía inalcanzable.
            if (containerRef.current?.querySelector('.jfp-video-controls:hover')) return;
            setControlsVisible(false);
        }, HIDE_CONTROLS_MS);
    }, []);

    // Al pausar, muestra los controles; al reanudar, rearma el temporizador.
    const playing = videoPlayerVM.playing.value;
    useEffect(() => { showControls(); }, [playing, showControls]);

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
    const idle = !controlsVisible && !error;

    return (
        <div
            ref={containerRef}
            className={`jfp-video${idle ? ' is-idle' : ''}`}
            onPointerMove={showControls}
            onClick={() => { videoPlayerVM.togglePlay(); showControls(); }}
            onDoubleClick={videoPlayerVM.toggleFullscreen}
        >
            {/* Los subtítulos se montan como <track> dinámico según la pista elegida. */}
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className='jfp-video-el' playsInline crossOrigin='anonymous'>
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
            </div>

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
