// Colaborador de VideoPlayerViewModel para la integración con RemotePlayback (Cast / AirPlay).
// Gestiona el estado de conexión con receptores remotos, la disponibilidad y los prompts.

import { signal } from '@preact/signals-core';

export class CastBinding {
    /** Hay receptores de Remote Playback (Chromecast/AirPlay) alcanzables. */
    castAvailable = signal(false);
    castState = signal<RemotePlaybackState>('disconnected');

    /** Sigue la disponibilidad de receptores remotos mientras dure el attach. */
    watch(video: HTMLVideoElement): () => void {
        const remote = video.remote;
        if (!remote || typeof remote.watchAvailability !== 'function') {
            return () => {};
        }

        this.castState.value = remote.state;
        const onConnecting = () => { this.castState.value = 'connecting'; };
        const onConnect = () => { this.castState.value = 'connected'; };
        const onDisconnect = () => { this.castState.value = 'disconnected'; };
        remote.addEventListener('connecting', onConnecting);
        remote.addEventListener('connect', onConnect);
        remote.addEventListener('disconnect', onDisconnect);

        let watchId: number | null = null;
        remote.watchAvailability((available) => { this.castAvailable.value = available; })
            .then((id) => { watchId = id; })
            .catch(() => { this.castAvailable.value = false; });

        return () => {
            remote.removeEventListener('connecting', onConnecting);
            remote.removeEventListener('connect', onConnect);
            remote.removeEventListener('disconnect', onDisconnect);
            if (watchId != null) void remote.cancelWatchAvailability(watchId).catch(() => {});
        };
    }

    /** Abre el selector de receptores del navegador (Cast/AirPlay). */
    prompt(video: HTMLVideoElement | null): void {
        const remote = video?.remote;
        if (!remote) return;
        void remote.prompt().catch(() => {});
    }

    /**
     * Pausa la reproducción local porque se ha delegado en un Chromecast.
     */
    pauseForCast(video: HTMLVideoElement | null, stopProgressTimer: () => void): void {
        video?.pause();
        stopProgressTimer();
    }

    reset(): void {
        this.castAvailable.value = false;
        this.castState.value = 'disconnected';
    }
}
