// Barra de controles del reproductor: seek bar arrastrable (dividida por
// capítulos y con los tramos de intro/créditos marcados), tiempos,
// play/pausa, volumen, ajustes y fullscreen.
import globalize from 'lib/globalize';

import { useMemo, useRef, useState } from 'react';
import { queueVM } from '../../../domain/viewModels/QueueViewModel';
import {
    chapterDisplayName, chapterIndexAt, progressDividers
} from '../../../domain/player/format';
import { videoPlayerVM } from '../../../domain/viewModels/VideoPlayerViewModel';
import { useSignalValue } from '../../../domain/bridge/useViewModel';
import { PlayerIc } from './playerIcons';
import { VolumeSlider } from './VolumeSlider';
import { VideoSettingsMenu } from './VideoSettingsMenu';

function formatTime(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
    const s = Math.floor(totalSeconds % 60);
    const m = Math.floor((totalSeconds / 60) % 60);
    const h = Math.floor(totalSeconds / 3600);
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    const hours = h > 0 ? `${h}:` : '';
    return `${hours}${mm}:${String(s).padStart(2, '0')}`;
}

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

    // Suscripciones individuales: useViewModel suscribiría a TODOS los
    // signals del VM (audioTracks, subtitleUrl, buffering…); así solo
    // re-renderizamos por los 4 que este componente pinta de verdad.
    const duration = useSignalValue(videoPlayerVM.duration);
    const current = useSignalValue(videoPlayerVM.currentTime);
    const playing = useSignalValue(videoPlayerVM.playing);
    const fullscreen = useSignalValue(videoPlayerVM.fullscreen);
    const pipAvailable = useSignalValue(videoPlayerVM.pipAvailable);
    const pipActive = useSignalValue(videoPlayerVM.pipActive);
    const queueLength = useSignalValue(queueVM.items).length;
    const chapters = useSignalValue(videoPlayerVM.chapters);
    const segments = useSignalValue(videoPlayerVM.segmentList);
    // Se recalcula solo al cambiar de item o al llegar los segmentos, no en
    // cada timeupdate.
    const dividers = useMemo(
        () => progressDividers(chapters, segments, duration),
        [chapters, segments, duration]
    );

    const pct = dragPct ?? (duration > 0 ? (current / duration) * 100 : 0);
    const shownTime = dragPct != null ? (dragPct / 100) * duration : current;

    // Posición del puntero sobre la barra: alimenta la etiqueta flotante con
    // el tiempo y el nombre del capítulo al que se saltaría.
    const [hoverPct, setHoverPct] = useState<number | null>(null);
    const previewPct = dragPct ?? hoverPct;
    const previewTime = previewPct != null ? (previewPct / 100) * duration : 0;
    const previewChapterIndex = previewPct != null ? chapterIndexAt(chapters, previewTime) : -1;
    const previewChapter = previewChapterIndex >= 0 ?
        chapterDisplayName(chapters[previewChapterIndex]?.name, previewChapterIndex) :
        null;

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
                        className='jfp-video-progress-tip'
                        style={{ left: `${previewPct}%` }}
                    >
                        {previewChapter && (
                            <span className='jfp-video-progress-tip-name'>
                                {previewChapter}
                            </span>
                        )}
                        {formatTime(previewTime)}
                    </div>
                )}
            </div>

            <div className='jfp-video-controls-row'>
                <div className='jfp-video-controls-group'>
                    <button
                        type='button'
                        className='jfp-video-btn'
                        onClick={() => videoPlayerVM.seekBy(-10)}
                        aria-label={globalize.translate('AttributeSkipBackward')}
                    >
                        <PlayerIc.Replay10 />
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
                        onClick={() => videoPlayerVM.seekBy(10)}
                        aria-label={globalize.translate('AttributeSkipForward')}
                    >
                        <PlayerIc.Forward10 />
                    </button>
                    <VolumeSlider />
                    <span className='jfp-video-time'>
                        {formatTime(shownTime)}
                        <span className='jfp-video-time-total'> / {formatTime(duration)}</span>
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
