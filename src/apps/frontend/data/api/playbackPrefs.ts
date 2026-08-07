// Preferencias del reproductor de ESTE dispositivo: cuánto salta cada botón y
// si el reloj enseña lo que queda o lo que dura.
//
// Se guardan con las mismas claves y las mismas unidades que el cliente nativo
// (`skipBackLength` y `skipForwardLength` en milisegundos, por usuario), así
// que el valor es el mismo se abra la app que se abra en este navegador. Como
// el resto de ajustes del reproductor —el bitrate, la apariencia de los
// subtítulos— no viaja al servidor: qué es cómodo saltar depende del mando que
// tengas delante, no de la cuenta.

import { loadSession } from '../session/session';

const SKIP_BACK_KEY = 'skipBackLength';
const SKIP_FORWARD_KEY = 'skipForwardLength';
const REMAINING_KEY = 'jfp-video-remaining-time';

/** Los mismos valores de fábrica que el nativo, en segundos. */
export const DEFAULT_SKIP_BACK = 10;
export const DEFAULT_SKIP_FORWARD = 30;

/** Con sesión abierta la preferencia es de ese usuario, como en el nativo. */
function key(name: string): string {
    const userId = loadSession()?.userId;
    return userId ? `${userId}-${name}` : name;
}

function readSeconds(name: string, fallback: number): number {
    const raw = Number(localStorage.getItem(key(name)));
    // El nativo lo guarda en milisegundos; aquí se trabaja en segundos, que es
    // la unidad del <video> y la del selector de Ajustes.
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw / 1000) : fallback;
}

export type SkipLengths = {
    /** Segundos que retrocede el botón de rebobinar. */
    back: number;
    /** Segundos que avanza el de adelantar. */
    forward: number;
};

export function getSkipLengths(): SkipLengths {
    return {
        back: readSeconds(SKIP_BACK_KEY, DEFAULT_SKIP_BACK),
        forward: readSeconds(SKIP_FORWARD_KEY, DEFAULT_SKIP_FORWARD)
    };
}

export function setSkipLengths(patch: Partial<SkipLengths>): SkipLengths {
    if (patch.back !== undefined) {
        localStorage.setItem(key(SKIP_BACK_KEY), String(patch.back * 1000));
    }
    if (patch.forward !== undefined) {
        localStorage.setItem(key(SKIP_FORWARD_KEY), String(patch.forward * 1000));
    }
    const merged = getSkipLengths();
    // Lo escucha el reproductor: cambiarlo con el vídeo abierto en otra
    // pestaña se nota sin tener que reabrirlo.
    window.dispatchEvent(new CustomEvent('jfp-playback-prefs'));
    return merged;
}

/** Si el reloj de la derecha cuenta hacia atrás en vez de enseñar la duración. */
export function getShowRemainingTime(): boolean {
    return localStorage.getItem(key(REMAINING_KEY)) === 'true';
}

export function setShowRemainingTime(on: boolean): void {
    localStorage.setItem(key(REMAINING_KEY), String(on));
    window.dispatchEvent(new CustomEvent('jfp-playback-prefs'));
}
