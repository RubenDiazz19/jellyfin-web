import { signal } from '@preact/signals-core';
import type { TrickplayData, TrickplayThumbnail } from '../../data/api/playbackContext';
import type { ApiService } from '../../data/api/ApiService';

export class TrickplayManager {
    /** Datos de Trickplay para previsualización de fotogramas al arrastrar la barra. */
    trickplay = signal<TrickplayData | null>(null);

    constructor(private api: ApiService) {}

    getThumbnail = (seconds: number): TrickplayThumbnail | null => {
        const trickplay = this.trickplay.value;
        const serverUrl = this.api.session.load()?.serverUrl ?? '';
        if (trickplay) {
            const thumb = this.api.playback.getTrickplayThumbnail(trickplay, seconds, serverUrl);
            if (thumb) return thumb;
        }
        return null;
    };

    reset() {
        this.trickplay.value = null;
    }
}
