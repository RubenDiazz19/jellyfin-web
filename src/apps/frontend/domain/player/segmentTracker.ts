// Los tramos detectados del item (intro, resumen, créditos…) y qué se ofrece
// saltar en cada momento.
//
// Vive fuera del ViewModel porque es estado con reglas propias —cuál contiene
// la posición, cuáles ya se descartaron, dónde empiezan los créditos— y el VM
// solo necesita decirle «voy por aquí» y «salta». Nada de esto toca el
// <video>: entra un instante en segundos, sale un tramo o un destino.

import { signal } from '@preact/signals-core';
import type { MediaSegment } from '../../data/api/segments';

export class SegmentTracker {
    /**
     * Tramo que contiene la posición actual y todavía se ofrece saltar, o
     * null. La View lo usa para pintar el botón de salto.
     */
    readonly active = signal<MediaSegment | null>(null);

    /**
     * Todos los tramos del item (no solo el que contiene la posición). La
     * barra de progreso los pinta para ver de un vistazo dónde cae la intro o
     * los créditos.
     */
    readonly list = signal<MediaSegment[]>([]);

    private segments: MediaSegment[] = [];

    /** Tramos ya saltados o descartados, por su instante de inicio. */
    private skipped = new Set<number>();

    /** Tramos del item recién cargados. Reinicia lo descartado. */
    replace(segments: MediaSegment[]): void {
        this.segments = segments;
        this.list.value = segments;
        this.skipped.clear();
    }

    /** Recalcula el tramo activo para una posición. */
    syncTo(time: number): void {
        if (this.segments.length === 0) {
            if (this.active.value) this.active.value = null;
            return;
        }
        // Los créditos no ofrecen botón de salto: ese tramo es el del aviso
        // de siguiente episodio, que hace el mismo trabajo y además encadena.
        const found = this.segments.find(
            (s) => s.kind !== 'Outro'
                && time >= s.start && time < s.end
                && !this.skipped.has(s.start)
        ) ?? null;
        // Comparar por referencia evita repintar la View en cada timeupdate.
        if (found !== this.active.value) this.active.value = found;
    }

    /**
     * Descarta el tramo activo y devuelve a qué segundo hay que ir, o null si
     * no había ninguno.
     *
     * `duration` recorta el destino: un outro suele acabar exactamente en el
     * final del fichero y, sin el recorte, el salto dispara 'ended' antes de
     * que el <video> reporte la posición — el progreso se guardaría en 0.
     */
    skipActive(duration: number): number | null {
        const segment = this.active.value;
        if (!segment) return null;
        this.skipped.add(segment.start);
        this.active.value = null;
        return duration > 0 ? Math.min(segment.end, duration - 0.25) : segment.end;
    }

    /**
     * Vuelve a ofrecer los tramos que no han terminado en `time`: si el
     * usuario rebobina a la intro, el botón tiene que estar ahí otra vez
     * aunque ya la hubiera saltado.
     */
    unskipFrom(time: number): void {
        if (this.skipped.size === 0) return;
        for (const segment of this.segments) {
            if (segment.end > time) this.skipped.delete(segment.start);
        }
    }

    /**
     * Inicio de los créditos, si están marcados y llegan hasta el final del
     * item (a menos de `tail` segundos). Null si no hay ninguno así: es lo que
     * decide si el aviso de «siguiente episodio» acompaña a los créditos o
     * sale a secas en los últimos segundos.
     */
    outroStart(duration: number, tail: number): number | null {
        const outro = this.segments.find(
            (s) => s.kind === 'Outro' && s.end >= duration - tail
        );
        return outro ? outro.start : null;
    }

    reset(): void {
        this.segments = [];
        this.skipped.clear();
        this.active.value = null;
        this.list.value = [];
    }
}
