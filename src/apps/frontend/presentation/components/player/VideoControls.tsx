// Barra de controles del reproductor: seek bar arrastrable (dividida por
// capítulos y con los tramos de intro/créditos marcados), tiempos,
// play/pausa, volumen, ajustes y fullscreen.
import globalize from 'lib/globalize';

import { useEffect, useMemo, useRef, useState } from 'react';
import { queueVM } from '../../../domain/viewModels/QueueViewModel';
import {
    chapterDisplayName, chapterIndexAt, formatTime, progressDividers
} from '../../../domain/player/format';
import { videoPlayerVM } from '../../../domain/viewModels/VideoPlayerViewModel';
import { useSignalValue } from '../../../domain/bridge/useViewModel';
import { formatPlaybackEndTime } from '../../theme/format';
import { PlayerIc } from './playerIcons';
import { VolumeSlider } from './VolumeSlider';
import { VideoSettingsMenu } from './VideoSettingsMenu';

/** % de la barra que ocupa un instante del vídeo. */
function toPct(seconds: number, duration: number): number {
    if (duration <= 0) return 0;
    return Math.min(Math.max((seconds / duration) * 100, 0), 100);
}

type Props = {
    onToggleQueue: () => void;
};

export function VideoControls({ onToggleQueue }: Props) {
    const barRef = useRef<HTMLDivElement>(null);
    const [dragPct, setDragPct] = useState<number | null>(null);
    const [now, setNow] = useState(() => new Date());

    // Suscripciones individuales: useViewModel suscribiría a TODOS los
    // signals del VM (audioTracks, subtitleUrl, buffering…); así solo
    // re-renderizamos por los que este componente pinta de verdad.
    const duration = useSignalValue(videoPlayerVM.duration);
    const current = useSignalValue(videoPlayerVM.currentTime);
    const playing = useSignalValue(videoPlayerVM.playing);
    const fullscreen = useSignalValue(videoPlayerVM.fullscreen);
    const pipAvailable = useSignalValue(videoPlayerVM.pipAvailable);
    const pipActive = useSignalValue(videoPlayerVM.pipActive);
    const queueLength = useSignalValue(queueVM.items).length;
    const chapters = useSignalValue(videoPlayerVM.chapters);
    const segments = useSignalValue(videoPlayerVM.segmentList);
    const skip = useSignalValue(videoPlayerVM.skip);
    const showRemaining = useSignalValue(videoPlayerVM.showRemainingTime);
    const playbackRate = useSignalValue(videoPlayerVM.playbackRate);
    useSignalValue(videoPlayerVM.trickplay);

    const hasDuration = duration > 0;
    // Actualiza la referencia horaria cada segundo cuando el reproductor tiene duración
    // para que la hora prevista de fin avance automáticamente con el reloj real.
    useEffect(() => {
        if (!hasDuration) return;
        const timer = setInterval(() => {
            setNow(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, [hasDuration]);
    // Se recalcula solo al cambiar de item o al llegar los segmentos, no en
    // cada timeupdate.
    const dividers = useMemo(
        () => progressDividers(chapters, segments, duration),
        [chapters, segments, duration]
    );

    const pct = dragPct ?? (duration > 0 ? (current / duration) * 100 : 0);
    const shownTime = dragPct != null ? (dragPct / 100) * duration : current;
    const remainingSeconds = duration > 0 ? Math.max(0, duration - shownTime) : 0;
    const endTimeText = formatPlaybackEndTime(remainingSeconds, playbackRate, now);

    // Posición del puntero sobre la barra: alimenta la etiqueta flotante con
    // el tiempo y el nombre del capítulo al que se saltaría.
    const [hoverPct, setHoverPct] = useState<number | null>(null);
    const previewPct = dragPct ?? hoverPct;
    const previewTime = previewPct != null ? (previewPct / 100) * duration : 0;
    const previewChapterIndex = previewPct != null ? chapterIndexAt(chapters, previewTime) : -1;
    const previewChapter = previewChapterIndex >= 0 ?
        chapterDisplayName(chapters[previewChapterIndex]?.name, previewChapterIndex) :
        null;
    const thumbnail = previewPct != null ? videoPlayerVM.getThumbnail(previewTime) : null;
    const thumbBoxWidth = 200;
    const thumbScale = thumbnail && !thumbnail.isSingleImage && thumbnail.width > 0 ?
        thumbBoxWidth / thumbnail.width :
        1;
    const thumbBoxHeight = thumbnail ?
        (thumbnail.isSingleImage ?
            Math.round((thumbnail.height / thumbnail.width) * thumbBoxWidth) :
            Math.round(thumbnail.height * thumbScale)) :
        112;

    const pctFromEvent = (e: React.PointerEvent): number => {
        const rect = barRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0) return 0;
        return Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 0), 100);
    };

    const onPointerDown = (e: React.PointerEvent) => {
        if (duration <= 0) return;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        setDragPct(pctFromEvent(e));
    };
    const onPointerMove = (e: React.PointerEvent) => {
        setHoverPct(pctFromEvent(e));
        if (dragPct == null) return;
        setDragPct(pctFromEvent(e));
    };
    const onPointerUp = (e: React.PointerEvent) => {
        if (dragPct == null) return;
        videoPlayerVM.seek((pctFromEvent(e) / 100) * duration);
        setDragPct(null);
    };

    return (
        <div className='jfp-video-controls' onClick={(e) => e.stopPropagation()}>
            {endTimeText && (
                <div className='jfp-video-controls-info'>
                    <span className='jfp-video-ends-at'>{endTimeText}</span>
                </div>
            )}
            <div
                ref={barRef}
                className='jfp-video-progress'
                role='slider'
                aria-label={globalize.translate('LabelPosition')}
                aria-valuemin={0}
                aria-valuemax={Math.floor(duration)}
                aria-valuenow={Math.floor(shownTime)}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => setDragPct(null)}
                onPointerLeave={() => setHoverPct(null)}
            >
                <div className='jfp-video-progress-track'>
                    <div className='jfp-video-progress-fill' style={{ width: `${pct}%` }} />
                    {/* Cortes de la barra: inicio de capítulo y extremos de los
                        tramos detectados (intro, créditos). Solo la división,
                        sin colorear el tramo. */}
                    {dividers.map((t) => (
                        <div
                            key={t}
                            className='jfp-video-progress-mark'
                            style={{ left: `${toPct(t, duration)}%` }}
                        />
                    ))}
                    <div className='jfp-video-progress-thumb' style={{ left: `${pct}%` }} />
                </div>
                {previewPct != null && duration > 0 && (
                    <div
                        className={`jfp-video-progress-tip${thumbnail ? ' has-thumbnail' : ''}`}
                        style={{ left: `${previewPct}%` }}
                    >
                        {thumbnail && (
                            <div
                                className='jfp-video-progress-thumb-frame'
                                style={{
                                    width: `${thumbBoxWidth}px`,
                                    height: `${thumbBoxHeight}px`,
                                    backgroundImage: `url("${thumbnail.url}")`,
                                    backgroundPosition: thumbnail.isSingleImage ?
                                        'center' :
                                        `-${Math.round(thumbnail.x * thumbScale)}px -${Math.round(thumbnail.y * thumbScale)}px`,
                                    backgroundSize: thumbnail.isSingleImage ?
                                        'cover' :
                                        `${Math.round(thumbnail.sheetWidth * thumbScale)}px ${Math.round(thumbnail.sheetHeight * thumbScale)}px`
                                }}
                            />
                        )}
                        <div className='jfp-video-progress-tip-text'>
                            {previewChapter && (
                                <span className='jfp-video-progress-tip-name'>
                                    {previewChapter}
                                </span>
                            )}
                            <span className='jfp-video-progress-tip-time'>{formatTime(previewTime)}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className='jfp-video-controls-row'>
                <div className='jfp-video-controls-group'>
                    <button
                        type='button'
                        className='jfp-video-btn'
                        onClick={videoPlayerVM.skipBackward}
                        aria-label={globalize.translate('AttributeSkipBackward')}
                    >
                        <PlayerIc.Replay seconds={skip.back} />
                    </button>
                    <button
                        type='button'
                        className='jfp-video-btn jfp-video-btn-play'
                        onClick={videoPlayerVM.togglePlay}
                        aria-label={globalize.translate(playing ? 'ButtonPause' : 'Play')}
                    >
                        {playing ? <PlayerIc.Pause /> : <PlayerIc.Play />}
                    </button>
                    <button
                        type='button'
                        className='jfp-video-btn'
                        onClick={videoPlayerVM.skipForward}
                        aria-label={globalize.translate('AttributeSkipForward')}
                    >
                        <PlayerIc.Forward seconds={skip.forward} />
                    </button>
                    <VolumeSlider />
                    <span className='jfp-video-time'>
                        {formatTime(shownTime)}
                        {/* Lo que queda o lo que dura: el signo delante es lo
                            que distingue una lectura de la otra de un vistazo. */}
                        <span className='jfp-video-time-total'>
                            {showRemaining ?
                                ` -${formatTime(Math.max(duration - shownTime, 0))}` :
                                ` / ${formatTime(duration)}`}
                        </span>
                    </span>
                </div>
                <div className='jfp-video-controls-group'>
                    <VideoSettingsMenu />
                    {queueLength > 0 && (
                        <button
                            type='button'
                            className='jfp-video-btn jfp-video-queue-btn'
                            onClick={onToggleQueue}
                            aria-label={globalize.translate('HeaderPlayQueue')}
                        >
                            <PlayerIc.Queue />
                            <span className='jfp-video-queue-count'>{queueLength}</span>
                        </button>
                    )}
                    {/* El botón de emitir (Cast/AirPlay) vive arriba a la
                        derecha, junto al de bloqueo: ver CastButton. */}
                    {pipAvailable && (
                        <button
                            type='button'
                            className={`jfp-video-btn${pipActive ? ' is-active' : ''}`}
                            onClick={videoPlayerVM.togglePip}
                            aria-label={globalize.translate(pipActive ? 'ExitPictureInPicture' : 'PictureInPicture')}
                        >
                            <PlayerIc.Pip />
                        </button>
                    )}
                    <button
                        type='button'
                        className='jfp-video-btn'
                        onClick={videoPlayerVM.toggleFullscreen}
                        aria-label={globalize.translate(fullscreen ? 'ExitFullscreen' : 'ButtonFullscreen')}
                    >
                        {fullscreen ? <PlayerIc.FullscreenExit /> : <PlayerIc.Fullscreen />}
                    </button>
                </div>
            </div>
        </div>
    );
}
