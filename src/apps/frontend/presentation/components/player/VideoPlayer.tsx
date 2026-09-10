// Reproductor de vídeo del frontend: <video> nativo controlado por
// VideoPlayerViewModel + OSD propio (controles, ajustes, atajos de teclado).
import globalize from 'lib/globalize';

import { useCallback, useEffect, useRef, useState } from 'react';
import { queueVM, type QueueEntry } from '../../../domain/viewModels/QueueViewModel';
import { QueuePanel } from '../queue/QueuePanel';
import {
    segmentSkipLabelKey, subtitleTrackMode, type AspectRatio
} from '../../../domain/player/format';
import {
    applyCueLine, applySubtitleAppearance, getSubtitleAppearance
} from '../../../domain/player/subtitleStyle';
import { videoPlayerVM } from '../../../domain/viewModels/VideoPlayerViewModel';
import { useSignalValue, useVmSignals } from '../../../domain/bridge/useViewModel';
import { currentMobileLayout, observeLayoutMode } from '../../../shared/layoutMode';
import { haptic } from '../../../shared/haptics';
import { PlayerIc } from './playerIcons';import { CastButton } from './CastButton';
import { VideoControls } from './VideoControls';
import { VideoGestures } from './VideoGestures';
import { ShortcutsModal } from './ShortcutsModal';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useOsdVisibility } from './useOsdVisibility';
import { useSubtitleManager } from './useSubtitleManager';
// El OSD entero se pinta desde aquí, así que sus estilos entran con él: solo
// se descargan al abrir el reproductor, que es una ruta cargada bajo demanda.
import '../../styles/player.css';

const OSD_NOTICE_MS = 2200;
const GESTURE_HINTS_MS = 4200;
const SUGGEST_LANDSCAPE_MS = 3800;
const HINTS_KEY = 'jfp-gesture-hints-seen';

export function pointInRect(
    point: { x: number; y: number } | null,
    rect: { left: number; right: number; top: number; bottom: number }
): boolean {
    if (!point) return false;
    return point.x >= rect.left && point.x <= rect.right
        && point.y >= rect.top && point.y <= rect.bottom;
}

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
    /** La reproducción ha llegado al final: la ruta decide qué sigue. */
    onEnded: () => void;
    /** Reproduce otra entrada de la cola sin salir del reproductor. */
    onPlayQueued: (entry: QueueEntry) => void;
};

export function VideoPlayer({
    itemId, startTicks, title, onClose, onEnded, onPlayQueued
}: Props) {
    // Suscripción selectiva, no `useViewModel`: este componente no pinta ni
    // currentTime ni duration, y suscribirse a TODOS los signals del VM
    // significaba re-renderizar el reproductor entero ~4 veces por segundo
    // durante toda la reproducción — anulando de paso la suscripción fina que ya
    // hace VideoControls. La lista es exactamente lo que se lee más abajo.
    useVmSignals(videoPlayerVM, (vm) => [
        vm.activeSegment, vm.aspectRatio, vm.autoNextProgress, vm.brightness,
        vm.buffering, vm.ended, vm.error, vm.fullscreen, vm.loading,
        vm.nextEpisode, vm.playing, vm.subtitleUrl, vm.title, vm.subtitleOffset,
        vm.sleepTimerMode
    ]);
    // La cola cambia desde fuera del reproductor (menú de un item, otra
    // pestaña): sin suscripción, el aviso de "a continuación" se quedaría
    // anunciando lo que ya no toca.
    const queueItems = useSignalValue(queueVM.items);
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const subtitleUrl = videoPlayerVM.subtitleUrl.value;
    const subtitleOffset = videoPlayerVM.subtitleOffset.value;
    const { subtitleTrackRef, setSubtitleTrackRef } = useSubtitleManager(subtitleUrl, subtitleOffset);

    const [osdNotice, setOsdNotice] = useState<string | null>(null);
    const osdNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);

    const showNotice = useCallback((text: string) => {
        setOsdNotice(text);
        if (osdNoticeTimer.current) clearTimeout(osdNoticeTimer.current);
        osdNoticeTimer.current = setTimeout(() => {
            setOsdNotice(null);
            osdNoticeTimer.current = null;
        }, OSD_NOTICE_MS);
    }, []);

    const isFullscreen = videoPlayerVM.fullscreen.value;
    const playing = videoPlayerVM.playing.value;
    const activeSegment = videoPlayerVM.activeSegment.value;

    const {
        controlsVisible,
        skipVisible,
        showControls,
        trackPointer
    } = useOsdVisibility({
        containerRef,
        playing,
        isFullscreen,
        activeSegment
    });

    useKeyboardShortcuts({
        queueItems,
        shortcutsOpen,
        onPlayQueued,
        onClose,
        showControls,
        showNotice,
        setShortcutsOpen
    });

    const onPlayQueuedRef = useRef(onPlayQueued);
    onPlayQueuedRef.current = onPlayQueued;

    const { touch, portrait } = useTouchPlayback();
    // Controles bloqueados (solo táctil): oculta OSD e ignora gestos hasta
    // desbloquear. Overlay de hints de primer uso.
    const [locked, setLocked] = useState(false);
    const [showHints, setShowHints] = useState(false);
    const [suggestLandscape, setSuggestLandscape] = useState(false);
    const [queueOpen, setQueueOpen] = useState(false);

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

    // Fin de la reproducción → la ruta encadena con la cola. El VM no navega
    // (regla MVVM), así que la señal se traduce aquí en una llamada.
    const ended = videoPlayerVM.ended.value;
    const onEndedRef = useRef(onEnded);
    onEndedRef.current = onEnded;
    useEffect(() => {
        if (ended) onEndedRef.current();
    }, [ended]);

    useEffect(() => () => {
        if (osdNoticeTimer.current) clearTimeout(osdNoticeTimer.current);
    }, []);

    // Hints de gestos en el primer uso táctil (una vez, persistido).
    useEffect(() => {
        if (!touch) return;
        if (localStorage.getItem(HINTS_KEY)) return;
        setShowHints(true);
        const t = setTimeout(() => {
            setShowHints(false);
            localStorage.setItem(HINTS_KEY, '1');
        }, GESTURE_HINTS_MS);
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
        const t = setTimeout(() => setSuggestLandscape(false), SUGGEST_LANDSCAPE_MS);
        return () => clearTimeout(t);
    }, [touch, portrait]);

    // Aviso de temporizador de apagado completado.
    useEffect(() => {
        const onSleepExpired = () => {
            showNotice(globalize.translate('SleepTimerExpired'));
        };
        window.addEventListener('jfp-sleep-timer-expired', onSleepExpired);
        return () => window.removeEventListener('jfp-sleep-timer-expired', onSleepExpired);
    }, [showNotice]);

    // Aplica el modo de los text tracks cuando cambia el subtítulo activo:
    // solo se muestra la pista de la selección actual. El <track> anterior
    // no se desmonta al instante (el remount por key es asíncrono), así que
    // sin esto sus cues quedan "showing" y se pintan superpuestas a las
    // nuevas.
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const active = subtitleUrl ? subtitleTrackRef.current?.track ?? null : null;
        for (const track of Array.from(video.textTracks)) {
            track.mode = subtitleTrackMode(subtitleUrl, active, track);
        }
    }, [subtitleUrl, subtitleTrackRef]);

    // Cómo se ven los subtítulos (tamaño, tipografía, color, altura).
    //
    // Se aplica al abrir el reproductor y cada vez que Ajustes lo cambia, que
    // es lo que avisa por `jfp-subtitle-appearance`: así se puede tener el
    // vídeo puesto en una pestaña y ver el efecto de cada cambio al momento,
    // sin reabrir nada.
    useEffect(() => {
        const apply = () => {
            const appearance = getSubtitleAppearance();
            applySubtitleAppearance(appearance);
            applyCueLine(subtitleTrackRef.current?.track?.cues ?? null, appearance.verticalPosition);
        };
        apply();
        window.addEventListener('jfp-subtitle-appearance', apply);
        return () => window.removeEventListener('jfp-subtitle-appearance', apply);
    }, [subtitleUrl]);

    // Longitud de los saltos y formato del reloj: lo mismo, desde Ajustes.
    useEffect(() => {
        const apply = videoPlayerVM.reloadPlaybackPrefs;
        apply();
        window.addEventListener('jfp-playback-prefs', apply);
        return () => window.removeEventListener('jfp-playback-prefs', apply);
    }, []);

    // Los subtítulos, al pasar a la ventana de picture-in-picture.
    //
    // Los pinta el navegador a partir del `<track>`, en una capa que monta
    // junto al vídeo. Al salir a la ventana flotante esa capa no siempre viaja
    // con él y los subtítulos desaparecen, aunque la pista siga seleccionada y
    // en la pestaña se vieran hace un segundo. Apagar la pista y volver a
    // encenderla obliga al navegador a montar la capa de nuevo, ya en la
    // ventana — y lo mismo al volver.
    //
    // El apagado y el encendido tienen que ir en dos frames distintos: en el
    // mismo, el navegador ve el estado final y no hay nada que rehacer.
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !subtitleUrl) return;
        let frame = 0;
        const remount = () => {
            const track = subtitleTrackRef.current?.track;
            if (!track) return;
            track.mode = 'disabled';
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => { track.mode = 'showing'; });
        };
        video.addEventListener('enterpictureinpicture', remount);
        video.addEventListener('leavepictureinpicture', remount);
        return () => {
            cancelAnimationFrame(frame);
            video.removeEventListener('enterpictureinpicture', remount);
            video.removeEventListener('leavepictureinpicture', remount);
        };
    }, [subtitleUrl]);

    const loading = videoPlayerVM.loading.value;
    const buffering = videoPlayerVM.buffering.value;
    const error = videoPlayerVM.error.value;
    const autoNext = videoPlayerVM.autoNextProgress.value;
    // Lo que se anuncia tiene que ser lo que va a sonar: al terminar manda la
    // cola (si el usuario ha encolado algo a propósito) y si no el siguiente
    // episodio de la serie — el mismo orden que aplica VideoRoute.
    const queuedNext = queueItems[0];
    const nextEpisode = queuedNext ?
        {
            id: queuedNext.itemId,
            title: queuedNext.title,
            label: queuedNext.subtitle ?? '',
            thumb: queuedNext.poster
        } :
        videoPlayerVM.nextEpisode.value;

    // El mismo «siguiente» que anuncia el aviso de los créditos alimenta el
    // botón ▶| de la ventana flotante y de los mandos del sistema. Se registra
    // desde aquí porque encadenar es navegar, y de eso no se encarga el VM.
    // Sin nada detrás se retira, y el navegador lo pinta apagado.
    const nextId = nextEpisode?.id;
    const nextTitle = nextEpisode?.title;
    useEffect(() => {
        if (!nextId) {
            videoPlayerVM.setNextTrack(null);
            return;
        }
        videoPlayerVM.setNextTrack(
            () => onPlayQueuedRef.current({ itemId: nextId, title: nextTitle ?? '' })
        );
        return () => { videoPlayerVM.setNextTrack(null); };
    }, [nextId, nextTitle]);

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
            onPointerMove={(e) => { trackPointer(e.nativeEvent); showControls(); }}
            {...mouseHandlers}
        >
            {/* Los subtítulos se montan como <track> dinámico según la pista elegida. */}
            {/* `preload='auto'`: en Direct Play el <video> no tiene src hasta
                que el VM lo asigna, y con el preload por defecto («metadata»)
                el navegador se paraba ahí a esperar al play(). Con auto empieza
                a bufferear en cuanto tiene la URL. En HLS por MSE no aplica —no
                hay src que precargar—, así que no estorba. */}
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
                ref={videoRef} className='jfp-video-el' playsInline crossOrigin='anonymous'
                preload='auto'
                style={videoStyle}
            >
                {subtitleUrl && (
                    // key fuerza el remount: si solo cambia el src, el navegador
                    // no recarga el VTT y siguen apareciendo los subtítulos
                    // viejos.
                    <track
                        ref={setSubtitleTrackRef}
                        key={subtitleUrl}
                        kind='subtitles'
                        src={subtitleUrl}
                        default
                        label={globalize.translate('Subtitles')}
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
                    aria-label={globalize.translate('ButtonBack')}
                >
                    <PlayerIc.Back />
                </button>
                {videoPlayerVM.title.value && (
                    <div className='jfp-video-title'>{videoPlayerVM.title.value}</div>
                )}
                <div className='jfp-video-top-actions'>
                    <CastButton itemId={itemId} />
                    {touch && (
                        <button
                            type='button'
                            className='jfp-video-btn'
                            onClick={() => { haptic('select'); setLocked(true); }}
                            aria-label={globalize.translate('LockControls')}
                        >
                            <PlayerIc.LockOpen />
                        </button>
                    )}
                </div>
            </div>

            {/* Bloqueo (táctil): oculta OSD y gestos, deja solo el candado. */}
            {touch && locked && (
                <button
                    type='button'
                    className='jfp-video-unlock'
                    onClick={() => { haptic('select'); setLocked(false); }}
                    aria-label={globalize.translate('UnlockControls')}
                >
                    <PlayerIc.Lock />
                </button>
            )}

            {/* Sugerencia de landscape (táctil, vertical, una vez). */}
            {touch && suggestLandscape && !locked && (
                <div className='jfp-video-rotate-hint' onClick={(e) => e.stopPropagation()}>
                    <PlayerIc.Rotate size={18} />
                    {globalize.translate('MessageRotateForFullscreen')}
                </div>
            )}

            {/* Siguiente episodio: un solo botón que se va llenando mientras
                el capítulo termina; al llenarse, `ended` encadena solo.
                Pulsarlo salta ya. Ocupa el sitio del botón de saltar
                créditos, al que sustituye. */}
            {autoNext != null && nextEpisode && !locked && (
                <button
                    type='button'
                    className='jfp-video-nextup'
                    onClick={(e) => {
                        e.stopPropagation();
                        haptic('select');
                        onPlayQueued({ itemId: nextEpisode.id, title: nextEpisode.title });
                    }}
                >
                    <span
                        className='jfp-video-nextup-fill'
                        style={{ transform: `scaleX(${autoNext})` }}
                    />
                    <span className='jfp-video-nextup-text'>
                        {globalize.translate('NextEpisode')}
                    </span>
                </button>
            )}

            {/* Saltar intro/resumen: aparece al entrar en el tramo y
                desaparece suavemente a los 3 s si no se toca. Los créditos
                no llevan botón: usa el nextup. */}
            {activeSegment && !locked && (
                <button
                    type='button'
                    className={`jfp-video-skip ${skipVisible ? 'is-visible' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        haptic('select');
                        videoPlayerVM.skipActiveSegment();
                    }}
                >
                    {globalize.translate(segmentSkipLabelKey(activeSegment.kind))}
                    <PlayerIc.SkipForward size={15} />
                </button>
            )}

            {/* Hints de gestos en el primer uso. */}
            {touch && showHints && !locked && (
                <div className='jfp-gesture-hints' onClick={dismissHints}>
                    <div className='jfp-gesture-hints-card'>
                        <div className='jfp-gesture-hints-title'>{globalize.translate('HeaderPlayerGestures')}</div>
                        <ul className='jfp-gesture-hints-list'>
                            <li>{globalize.translate('GestureTapPlayPause')}</li>
                            <li>{globalize.translate('GestureDoubleTapSeek')}</li>
                            <li>{globalize.translate('GestureSwipeSeek')}</li>
                            <li>{globalize.translate('GestureVerticalBrightnessVolume')}</li>
                            <li>{globalize.translate('GesturePinchZoom')}</li>
                        </ul>
                        <div className='jfp-gesture-hints-dismiss'>{globalize.translate('GestureTapToClose')}</div>
                    </div>
                </div>
            )}

            {(loading || buffering) && !error && (
                <div className='jfp-video-loading' aria-label={globalize.translate('Loading')}>
                    <PlayerIc.Spinner />
                </div>
            )}

            {error && (
                <div className='jfp-video-error' onClick={(e) => e.stopPropagation()}>
                    <div className='jfp-video-error-msg'>{error}</div>
                    <button type='button' className='jfp-video-error-btn' onClick={onClose}>
                        {globalize.translate('ButtonBack')}
                    </button>
                </div>
            )}

            {/* Cola de reproducción: panel lateral sobre el vídeo. */}
            {queueOpen && (
                <div
                    className='jfp-video-queue'
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className='jfp-video-queue-head'>
                        <span>{globalize.translate('HeaderPlayQueue')}</span>
                        <button
                            type='button'
                            className='jfp-video-btn'
                            onClick={() => setQueueOpen(false)}
                            aria-label={globalize.translate('ButtonClose')}
                        >
                            <span aria-hidden='true'>✕</span>
                        </button>
                    </div>
                    <QueuePanel
                        dense
                        onPlay={(entry) => {
                            queueVM.takeFor(entry.itemId);
                            setQueueOpen(false);
                            onPlayQueued(entry);
                        }}
                    />
                </div>
            )}

            {osdNotice && (
                <div className='jfp-video-osd-badge' role='status' aria-live='polite'>
                    {osdNotice}
                </div>
            )}

            {shortcutsOpen && (
                <ShortcutsModal onClose={() => setShortcutsOpen(false)} />
            )}

            <VideoControls onToggleQueue={() => setQueueOpen((v) => !v)} />
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
