// Barra de controles del reproductor: seek bar arrastrable, tiempos,
// play/pausa, volumen, ajustes y fullscreen.
import { useRef, useState } from 'react';
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

export function VideoControls() {
    const barRef = useRef<HTMLDivElement>(null);
    const [dragPct, setDragPct] = useState<number | null>(null);

    // Suscripciones individuales: useViewModel suscribiría a TODOS los
    // signals del VM (audioTracks, subtitleUrl, buffering…); así solo
    // re-renderizamos por los 4 que este componente pinta de verdad.
    const duration = useSignalValue(videoPlayerVM.duration);
    const current = useSignalValue(videoPlayerVM.currentTime);
    const playing = useSignalValue(videoPlayerVM.playing);
    const fullscreen = useSignalValue(videoPlayerVM.fullscreen);

    const pct = dragPct ?? (duration > 0 ? (current / duration) * 100 : 0);
    const shownTime = dragPct != null ? (dragPct / 100) * duration : current;

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
                aria-label='Posición'
                aria-valuemin={0}
                aria-valuemax={Math.floor(duration)}
                aria-valuenow={Math.floor(shownTime)}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => setDragPct(null)}
            >
                <div className='jfp-video-progress-track'>
                    <div className='jfp-video-progress-fill' style={{ width: `${pct}%` }} />
                    <div className='jfp-video-progress-thumb' style={{ left: `${pct}%` }} />
                </div>
            </div>

            <div className='jfp-video-controls-row'>
                <div className='jfp-video-controls-group'>
                    <button
                        type='button'
                        className='jfp-video-btn jfp-video-btn-play'
                        onClick={videoPlayerVM.togglePlay}
                        aria-label={playing ? 'Pausa' : 'Reproducir'}
                    >
                        {playing ? <PlayerIc.Pause /> : <PlayerIc.Play />}
                    </button>
                    <VolumeSlider />
                    <span className='jfp-video-time'>
                        {formatTime(shownTime)}
                        <span className='jfp-video-time-total'> / {formatTime(duration)}</span>
                    </span>
                </div>
                <div className='jfp-video-controls-group'>
                    <VideoSettingsMenu />
                    <button
                        type='button'
                        className='jfp-video-btn'
                        onClick={videoPlayerVM.toggleFullscreen}
                        aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                    >
                        {fullscreen ? <PlayerIc.FullscreenExit /> : <PlayerIc.Fullscreen />}
                    </button>
                </div>
            </div>
        </div>
    );
}
