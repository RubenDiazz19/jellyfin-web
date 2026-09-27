import { signal } from '@preact/signals-core';
import type { AspectRatio } from './format';
import { clamp } from '../../shared/math';

export class VideoFilters {
    playbackRate = signal(1);
    aspectRatio = signal<AspectRatio>('auto');
    brightness = signal(1);

    private video: HTMLVideoElement | null = null;

    attach(video: HTMLVideoElement) {
        this.video = video;
        // Restaurar la velocidad de reproducción al nuevo <video>
        if (this.playbackRate.value !== 1) {
            video.defaultPlaybackRate = this.playbackRate.value;
            video.playbackRate = this.playbackRate.value;
        }
    }

    detach() {
        this.video = null;
    }

    setPlaybackRate = (rate: number) => {
        if (!Number.isFinite(rate)) return;
        const r = clamp(rate, 0.25, 3);
        const v = this.video;
        if (v) {
            // load() (recarga por cambio de pista) resetea playbackRate al valor
            // de defaultPlaybackRate — fijando ambos, la velocidad sobrevive.
            v.defaultPlaybackRate = r;
            v.playbackRate = r;
        }
        this.playbackRate.value = r;
    };

    setAspectRatio = (mode: AspectRatio) => {
        this.aspectRatio.value = mode;
    };

    /** Ajusta el brillo del vídeo (filtro CSS). No baja de 0.15 (negro total). */
    setBrightness = (value: number) => {
        this.brightness.value = clamp(value, 0.15, 1);
    };

    reset() {
        this.playbackRate.value = 1;
        this.brightness.value = 1;
        this.aspectRatio.value = 'auto';
    }
}
