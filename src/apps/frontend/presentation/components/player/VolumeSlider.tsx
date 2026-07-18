// Control de volumen: botón mute + slider horizontal.
import { videoPlayerVM } from '../../../domain/viewModels/VideoPlayerViewModel';
import { useViewModel } from '../../../domain/bridge/useViewModel';
import { PlayerIc } from './playerIcons';

export function VolumeSlider() {
    useViewModel(videoPlayerVM);
    const muted = videoPlayerVM.muted.value || videoPlayerVM.volume.value === 0;
    const volume = muted ? 0 : videoPlayerVM.volume.value;
    return (
        <div className='jfp-video-volume'>
            <button
                type='button'
                className='jfp-video-btn'
                onClick={videoPlayerVM.toggleMute}
                aria-label={muted ? 'Activar sonido' : 'Silenciar'}
            >
                {muted ? <PlayerIc.VolumeMuted /> : <PlayerIc.VolumeHigh />}
            </button>
            <input
                type='range'
                min={0}
                max={1}
                step={0.02}
                value={volume}
                aria-label='Volumen'
                onChange={(e) => videoPlayerVM.setVolume(Number(e.target.value))}
                style={{ ['--jfp-vol' as string]: `${volume * 100}%` }}
            />
        </div>
    );
}
