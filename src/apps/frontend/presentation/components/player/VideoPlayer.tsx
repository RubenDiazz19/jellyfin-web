// Reproductor de vídeo del frontend: <video> nativo controlado por
// VideoPlayerViewModel + OSD propio (controles, ajustes, atajos de teclado).
import globalize from 'lib/globalize';

import { useCallback, useEffect, useRef, useState } from 'react';
import { queueVM, type QueueEntry } from '../../../domain/viewModels/QueueViewModel';
import { QueuePanel } from '../queue/QueuePanel';
import {
    sanitizeVttCueText, segmentSkipLabelKey, subtitleTrackMode, type AspectRatio
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
// El OSD entero se pinta desde aquí, así que sus estilos entran con él: solo
// se descargan al abrir el reproductor, que es una ruta cargada bajo demanda.
import '../../styles/player.css';

const HIDE_CONTROLS_MS = 3000;
const SKIP_VISIBLE_MS = 3000;
/** Actividad del usuario que saca el OSD. Ver el efecto que los engancha. */
const WAKE_EVENTS = [
    'pointermove', 'mousemove', 'pointerdown', 'touchstart', 'wheel', 'keydown'
] as const;
const HINTS_KEY = 'jfp-gesture-hints-seen';

/** Las dos barras del OSD, que son lo que no debe irse bajo el puntero. */
const OSD_BARS = '.jfp-video-controls, .jfp-video-top';

export function pointInRect(
    point: { x: number; y: number } | null,
    rect: { left: number; right: number; top: number; bottom: number }
): boolean {
    if (!point) return false;
    return point.x >= rect.left && point.x <= rect.right
        && point.y >= rect.top && point.y <= rect.bottom;
}

/** ¿El puntero está sobre alguna de las barras del OSD? */
function pointerIsOverBars(root: Element, point: { x: number; y: number } | null): boolean {
    if (!point) return false;
    return [...root.querySelectorAll(OSD_BARS)]
        .some((bar) => pointInRect(point, bar.getBoundingClientRect()));
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
    const subtitleTrackRef = useRef<HTMLTrackElement | null>(null);
    const cueOriginalTimes = useRef(new WeakMap<VTTCue, { start: number; end: number }>());

    const [osdNotice, setOsdNotice] = useState<string | null>(null);
    const osdNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);

    const showNotice = useCallback((text: string) => {
        setOsdNotice(text);
        if (osdNoticeTimer.current) clearTimeout(osdNoticeTimer.current);
        osdNoticeTimer.current = setTimeout(() => {
            setOsdNotice(null);
            osdNoticeTimer.current = null;
        }, 2200);
    }, []);

    // Callback ref en vez de onLoad: 'load' no está en la lista de eventos
    // que el linter admite en <track>, y de paso evita el listener JSX que
    // React tendría que reatachar en cada render.
    const setSubtitleTrackRef = useCallback((el: HTMLTrackElement | null) => {
        subtitleTrackRef.current = el;
        if (!el) return;
        el.addEventListener('load', () => {
            // El conversor del servidor a veces deja override tags ASS sin
            // depurar en el VTT; se limpian aquí antes de que se pinten.
            for (const cue of Array.from(el.track.cues ?? [])) {
                if (cue instanceof VTTCue && cue.text.includes('{')) {
                    cue.text = sanitizeVttCueText(cue.text);
                }
            }
            applyCueLine(el.track.cues, getSubtitleAppearance().verticalPosition);
            const offset = videoPlayerVM.subtitleOffset.peek();
            if (offset !== 0 && el.track.cues) {
                for (const cue of Array.from(el.track.cues)) {
                    if (!(cue instanceof VTTCue)) continue;
                    let orig = cueOriginalTimes.current.get(cue);
                    if (!orig) {
                        orig = { start: cue.startTime, end: cue.endTime };
                        cueOriginalTimes.current.set(cue, orig);
                    }
                    cue.startTime = Math.max(0, orig.start + offset);
                    cue.endTime = Math.max(0, orig.end + offset);
                }
            }
        });
    }, []);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [controlsVisible, setControlsVisible] = useState(true);
    // Auto-ocultado del botón de saltar intro/resumen: aparece al entrar en
    // el tramo y desaparece solo tras SKIP_VISIBLE_MS sin tocar. Mismo
    // comportamiento que el botón de ending (nextup), que tampoco requiere
    // acción del usuario para seguir siendo útil.
    const [skipVisible, setSkipVisible] = useState(false);
    const skipHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    /**
     * Dónde está el puntero. Se guarda en cada movimiento porque `:hover` no
     * sirve para esto — ver `canHide`.
     */
    const pointer = useRef<{ x: number; y: number } | null>(null);

    /**
     * Apunta dónde está el ratón.
     *
     * Solo el ratón deja rastro: un dedo no se queda «encima» de nada al
     * levantarse, así que recordar dónde tocó dejaría el OSD clavado para
     * siempre en cuanto alguien tocara la barra de controles.
     */
    const trackPointer = useCallback((e: Event) => {
        if (e instanceof PointerEvent && e.pointerType !== 'mouse') {
            pointer.current = null;
            return;
        }
        // PointerEvent extiende MouseEvent, así que esto cubre las dos vías.
        if (e instanceof MouseEvent) pointer.current = { x: e.clientX, y: e.clientY };
    }, []);

    /** Si el OSD puede desaparecer ahora mismo. */
    const canHide = useCallback(() => {
        // En pausa los controles no se ocultan.
        if (!videoPlayerVM.playing.peek()) return false;
        const root = containerRef.current;
        if (!root) return false;
        // Con un panel de ajustes abierto (subtítulos/audio/velocidad/
        // aspecto) NO ocultamos: si no, el OSD se desvanecía mientras elegías
        // una pista y el click caía en el vacío. El panel solo existe en el
        // DOM cuando está abierto.
        if (root.querySelector('.jfp-video-settings-menu')) return false;
        // Y tampoco con el puntero encima de una de las barras.
        //
        // Esto se miraba con `.jfp-video-controls:hover`, y ahí estaba el bug
        // de «paso el ratón por encima y no se ven»: mientras el OSD está
        // oculto la barra lleva `pointer-events: none`, así que el movimiento
        // que lo despierta impacta en el vídeo, no en ella. Al quitar la clase
        // la barra vuelve a ser interactiva, pero Chrome NO reevalúa el hover
        // con el ratón quieto, así que `:hover` seguía en false: tres segundos
        // después el OSD se desvanecía con el cursor justo encima, y sin
        // volver a mover el ratón no había forma de recuperarlo. La posición
        // del puntero contra el rectángulo real no depende de eso.
        return !pointerIsOverBars(root, pointer.current);
    }, []);

    const showControls = useCallback(() => {
        setControlsVisible(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
        const arm = () => {
            hideTimer.current = setTimeout(() => {
                hideTimer.current = null;
                // Si ahora no se puede, se vuelve a intentar. Antes cada
                // motivo hacía `return` a secas y el autoocultado quedaba
                // muerto hasta el siguiente movimiento del ratón.
                if (!canHide()) { arm(); return; }
                setControlsVisible(false);
            }, HIDE_CONTROLS_MS);
        };
        arm();
    }, [canHide]);

    // Al entrar en un nuevo tramo saltable el botón se muestra 3 s. Al salir
    // del tramo (activeSegment → null) se cancela el timer y se oculta.
    // Cualquier actividad del usuario (ratón, teclado, táctil) rearma el
    // timer mientras siga en el tramo, igual que hace el OSD con su propio
    // temporizador.
    const activeSegment = videoPlayerVM.activeSegment.value;
    // Ref para leer el segmento actual sin closures rancias en el wake handler.
    const activeSegmentRef = useRef(activeSegment);
    activeSegmentRef.current = activeSegment;

    const showSkip = useCallback(() => {
        if (!activeSegmentRef.current) return;
        setSkipVisible(true);
        if (skipHideTimer.current) clearTimeout(skipHideTimer.current);
        skipHideTimer.current = setTimeout(() => {
            skipHideTimer.current = null;
            setSkipVisible(false);
        }, SKIP_VISIBLE_MS);
    }, []);

    useEffect(() => {
        if (skipHideTimer.current) clearTimeout(skipHideTimer.current);
        if (!activeSegment) {
            setSkipVisible(false);
            return;
        }
        // Nuevo segmento: mostrar y armar el timer inicial.
        showSkip();
        return () => {
            if (skipHideTimer.current) clearTimeout(skipHideTimer.current);
        };
    // Solo reaccionar al cambio de segmento (kind+start como clave estable).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSegment?.kind, activeSegment?.start]);

    // Fin de la reproducción → la ruta encadena con la cola. El VM no navega
    // (regla MVVM), así que la señal se traduce aquí en una llamada.
    const ended = videoPlayerVM.ended.value;
    const onEndedRef = useRef(onEnded);
    onEndedRef.current = onEnded;
    useEffect(() => {
        if (ended) onEndedRef.current();
    }, [ended]);

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
    // `pointermove` y `mousemove` son el mismo gesto entrando dos veces, y el
    // `onPointerMove` del contenedor es una tercera. La redundancia se queda A
    // PROPÓSITO: en pantalla completa no siempre llegan las tres, y quitar las
    // de más dejó el OSD sin despertar justo ahí. Despertar de sobra no cuesta
    // nada — el `setState` a un valor igual no repinta y reprogramar el
    // temporizador son dos llamadas.
    useEffect(() => {
        const wake = (e: Event) => {
            trackPointer(e);
            showControls();
            // Si hay un tramo saltable activo, el movimiento del usuario
            // rearma el botón de skip para que vuelva a ser visible 5 s más.
            showSkip();
        };
        const opts = { passive: true } as const;
        for (const type of WAKE_EVENTS) document.addEventListener(type, wake, opts);
        document.addEventListener('fullscreenchange', wake);
        return () => {
            for (const type of WAKE_EVENTS) document.removeEventListener(type, wake);
            document.removeEventListener('fullscreenchange', wake);
        };
    }, [showControls, showSkip, trackPointer]);

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
                case 'K':
                    e.preventDefault();
                    videoPlayerVM.togglePlay();
                    break;
                case 'm':
                case 'M':
                    videoPlayerVM.toggleMute();
                    break;
                case 'f':
                case 'F':
                    videoPlayerVM.toggleFullscreen();
                    break;
                case 'p':
                case 'P':
                    videoPlayerVM.togglePip();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    videoPlayerVM.skipBackward();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    videoPlayerVM.skipForward();
                    break;
                case 'j':
                case 'J':
                    e.preventDefault();
                    videoPlayerVM.seekBy(-10);
                    break;
                case 'l':
                case 'L':
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
                case 'c':
                case 'C':
                    videoPlayerVM.toggleSubtitles();
                    break;
                case 'g':
                case 'G': {
                    videoPlayerVM.adjustSubtitleOffset(-0.1);
                    const off = videoPlayerVM.subtitleOffset.peek();
                    showNotice(`${globalize.translate('SubtitleOffset')}: ${off > 0 ? '+' : ''}${off.toFixed(1)}s`);
                    break;
                }
                case 'h':
                case 'H': {
                    videoPlayerVM.adjustSubtitleOffset(0.1);
                    const off = videoPlayerVM.subtitleOffset.peek();
                    showNotice(`${globalize.translate('SubtitleOffset')}: ${off > 0 ? '+' : ''}${off.toFixed(1)}s`);
                    break;
                }
                case '[': {
                    const r = Math.max(0.25, Math.round((videoPlayerVM.playbackRate.peek() - 0.25) * 100) / 100);
                    videoPlayerVM.setPlaybackRate(r);
                    showNotice(`${globalize.translate('LabelPlaybackSpeed')}: ${r}×`);
                    break;
                }
                case ']': {
                    const r = Math.min(3, Math.round((videoPlayerVM.playbackRate.peek() + 0.25) * 100) / 100);
                    videoPlayerVM.setPlaybackRate(r);
                    showNotice(`${globalize.translate('LabelPlaybackSpeed')}: ${r}×`);
                    break;
                }
                case 's':
                case 'S':
                    if (videoPlayerVM.activeSegment.peek()) {
                        videoPlayerVM.skipActiveSegment();
                    }
                    break;
                case 'n':
                case 'N': {
                    const qNext = queueItems[0];
                    if (qNext) {
                        onPlayQueued({ itemId: qNext.itemId, title: qNext.title });
                    } else if (videoPlayerVM.nextEpisode.peek()) {
                        const next = videoPlayerVM.nextEpisode.peek()!;
                        onPlayQueued({ itemId: next.id, title: next.title });
                    }
                    break;
                }
                case '?':
                    setShortcutsOpen((o) => !o);
                    break;
                case '0':
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                case '6':
                case '7':
                case '8':
                case '9': {
                    const pct = Number(e.key) / 10;
                    const dur = videoPlayerVM.duration.peek();
                    if (dur > 0) videoPlayerVM.seek(pct * dur);
                    break;
                }
                case 'Escape':
                    if (shortcutsOpen) {
                        setShortcutsOpen(false);
                        break;
                    }
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
    }, [onClose, showControls, showNotice, onPlayQueued, queueItems, shortcutsOpen]);

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
    const subtitleUrl = videoPlayerVM.subtitleUrl.value;
    const subtitleOffset = videoPlayerVM.subtitleOffset.value;
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const active = subtitleUrl ? subtitleTrackRef.current?.track ?? null : null;
        for (const track of Array.from(video.textTracks)) {
            track.mode = subtitleTrackMode(subtitleUrl, active, track);
        }
    }, [subtitleUrl]);

    // Aplica el desfase en vivo a los cues de la pista VTT activa.
    useEffect(() => {
        const track = subtitleTrackRef.current?.track;
        if (!track) return;
        const applyOffset = () => {
            const cues = track.cues;
            if (!cues) return;
            for (const cue of Array.from(cues)) {
                if (!(cue instanceof VTTCue)) continue;
                let orig = cueOriginalTimes.current.get(cue);
                if (!orig) {
                    orig = { start: cue.startTime, end: cue.endTime };
                    cueOriginalTimes.current.set(cue, orig);
                }
                cue.startTime = Math.max(0, orig.start + subtitleOffset);
                cue.endTime = Math.max(0, orig.end + subtitleOffset);
            }
        };
        applyOffset();
    }, [subtitleUrl, subtitleOffset]);

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
    const onPlayQueuedRef = useRef(onPlayQueued);
    onPlayQueuedRef.current = onPlayQueued;
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
