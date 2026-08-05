// El aviso de «siguiente episodio» mientras el capítulo termina.
//
// Es una cuenta atrás sobre la posición: se muestra a partir de cierto
// instante y su barra se llena justo cuando el vídeo se acaba, que es donde la
// View encadena con el siguiente. Aquí no se navega ni se toca el <video>:
// entra dónde va la reproducción, sale cuánto lleva llena la barra.

import { signal } from '@preact/signals-core';
import type { NextEpisode } from '../../data/api/playbackContext';

/**
 * Sin créditos detectados, el aviso sale en los últimos segundos del
 * capítulo. Con créditos detectados manda su inicio: la cuenta acompaña a los
 * créditos, como en Netflix.
 */
const WINDOW_SECONDS = 25;

/** Un outro que acaba a menos de esto del final cierra el episodio. */
const OUTRO_TAIL_SECONDS = 15;

export class AutoNextTracker {
    /** Episodio que viene después del actual, o null (película o final). */
    readonly next = signal<NextEpisode | null>(null);

    /**
     * Avance del aviso (0 → 1), o null si no toca mostrarlo. Al llegar a 1 el
     * capítulo acaba y la View encadena con el siguiente.
     */
    readonly progress = signal<number | null>(null);

    /** El usuario ha cerrado el aviso: no vuelve en este episodio. */
    private dismissed = false;

    /**
     * `outroStart` devuelve el inicio de los créditos si están marcados y
     * llegan hasta el final del item, o null. Se recibe como función y no como
     * lista de tramos para no acoplar esto al seguimiento de segmentos.
     */
    constructor(private outroStart: (duration: number, tail: number) => number | null) {}

    /** Instante en el que aparece el aviso. */
    startAt(duration: number): number {
        return this.outroStart(duration, OUTRO_TAIL_SECONDS) ?? duration - WINDOW_SECONDS;
    }

    /** Recalcula el avance del aviso para una posición. */
    syncTo(time: number, duration: number): void {
        if (!this.next.value || this.dismissed || duration <= 0) {
            this.hide();
            return;
        }
        const start = this.startAt(duration);
        if (time < start) {
            this.hide();
            return;
        }
        const span = Math.max(duration - start, 1);
        const ratio = Math.min(Math.max((time - start) / span, 0), 1);
        // Redondeo al 1%: evita repintar el OSD en cada timeupdate por una
        // diferencia invisible.
        const rounded = Math.round(ratio * 100) / 100;
        if (rounded !== this.progress.value) this.progress.value = rounded;
    }

    /** El usuario descarta el aviso: no vuelve en este episodio. */
    dismiss = () => {
        this.dismissed = true;
        this.progress.value = null;
    };

    /** Estado de partida de un item recién abierto. */
    reset(): void {
        this.dismissed = false;
        this.next.value = null;
        this.progress.value = null;
    }

    private hide(): void {
        if (this.progress.value != null) this.progress.value = null;
    }
}
