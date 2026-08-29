// Colaborador de VideoPlayerViewModel para la gestión de subtítulos.
// Maneja las pistas disponibles, el subtítulo seleccionado, la URL VTT externa,
// el retraso de carga para evitar saturación de transcode, y el quemado de subtítulos gráficos.

import { signal } from '@preact/signals-core';
import type { MediaStreamInfo } from '../../data/api/playback';

export class SubtitlesBinding {
    subtitleTracks = signal<MediaStreamInfo[]>([]);

    /** Índice del subtítulo activo, o null = desactivados. */
    selectedSubtitle = signal<number | null>(null);
    /** URL del VTT activo (solo subtítulos de texto). La View pinta <track>. */
    subtitleUrl = signal<string | null>(null);

    /** Desfase manual de sincronización en segundos (ej. +0.5s o -0.5s). */
    subtitleOffset = signal<number>(0);

    /**
     * Subtítulo que el servidor está quemando en el flujo de vídeo (subtítulo
     * gráfico: PGS, VOBSUB). Si está puesto, cambiar de subtítulo exige
     * recargar la fuente para pedir otro transcode.
     */
    burnedSubtitle: number | null = null;
    private pendingSubtitleUrl: string | null = null;

    /**
     * Retrasa la petición del VTT hasta que el vídeo empiece a reproducir.
     * Evita que el servidor extraiga todas las pistas a la vez durante el arranque.
     */
    publishSubtitle(url: string | null, hasStarted: boolean): void {
        if (url == null || hasStarted) {
            this.pendingSubtitleUrl = null;
            this.subtitleUrl.value = url;
            return;
        }
        this.pendingSubtitleUrl = url;
        this.subtitleUrl.value = null;
    }

    /** Suelta el subtítulo que esperaba a que arrancara la reproducción. */
    flushPendingSubtitle(): void {
        const url = this.pendingSubtitleUrl;
        if (!url) return;
        this.pendingSubtitleUrl = null;
        this.subtitleUrl.value = url;
    }

    /** Ajusta el desfase de subtítulos absoluto en segundos (acotado entre -30s y +30s). */
    setSubtitleOffset(seconds: number): void {
        const clamped = Math.round(Math.min(Math.max(seconds, -30), 30) * 10) / 10;
        this.subtitleOffset.value = clamped;
    }

    /** Incrementa o decrementa el desfase de subtítulos (ej. ±0.1s). */
    adjustSubtitleOffset(delta: number): void {
        this.setSubtitleOffset(this.subtitleOffset.value + delta);
    }

    resetSubtitleOffset(): void {
        this.subtitleOffset.value = 0;
    }

    reset(): void {
        this.subtitleTracks.value = [];
        this.selectedSubtitle.value = null;
        this.subtitleUrl.value = null;
        this.pendingSubtitleUrl = null;
        this.burnedSubtitle = null;
        this.subtitleOffset.value = 0;
    }
}
