import { signal } from '@preact/signals-core';
import type { MediaStreamInfo } from '../../data/api/playback';
import type { TitlePreferences } from './titlePreferences';

export class AudioTrackManager {
    audioTracks = signal<MediaStreamInfo[]>([]);
    /** Índice del stream de audio activo (índice Jellyfin, no posición). */
    selectedAudio = signal<number | null>(null);

    constructor(
        private prefs: TitlePreferences,
        private onReload: (opts: { audioStreamIndex: number }) => Promise<void>
    ) {}

    setAudioTrack = (index: number) => {
        if (index === this.selectedAudio.value) return;
        const language = this.audioTracks.value.find((a) => a.index === index)?.language;
        if (language) this.prefs.remember({ audio: language });
        void this.onReload({ audioStreamIndex: index });
    };

    reset() {
        this.audioTracks.value = [];
        this.selectedAudio.value = null;
    }
}
