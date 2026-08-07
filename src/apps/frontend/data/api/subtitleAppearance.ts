// Cómo se ven los subtítulos: tamaño, tipografía, color, fondo y a qué altura
// se pintan.
//
// Se guarda con la misma clave y la misma forma que el Jellyfin nativo
// (`localplayersubtitleappearance3`, por usuario, en el almacenamiento local),
// para que la preferencia sea la misma se abra la app que se abra en este
// navegador. No viaja al servidor: en el nativo tampoco, es un ajuste del
// reproductor de este dispositivo.
//
// Quién lo aplica es `domain/player/subtitleStyle`; aquí solo se lee y se
// escribe.

import { loadSession } from '../session/session';

/** La misma que usa `userSettings.getSubtitleAppearanceSettings()`. */
const KEY = 'localplayersubtitleappearance3';

/**
 * Tamaños del selector nativo. El valor es el multiplicador que se aplica al
 * cuerpo de texto base del reproductor.
 */
export type SubtitleTextSize = 'smaller' | 'small' | 'medium' | 'large' | 'larger' | 'extralarge';

/** Familias del selector nativo; el valor vacío es la del reproductor. */
export type SubtitleFont = '' | 'typewriter' | 'print' | 'console' | 'cursive' | 'casual' | 'smallcaps';

/**
 * Cómo se despega el texto del fondo. `uniform` es el contorno cerrado que
 * imita a libass y es lo que el reproductor lleva puesto de fábrica.
 */
export type SubtitleDropShadow = 'uniform' | 'dropshadow' | 'raised' | 'depressed' | 'none';

export type SubtitleAppearance = {
    textSize: SubtitleTextSize;
    font: SubtitleFont;
    textColor: string;
    /** Color de la caja del texto; `transparent` = sin caja. */
    textBackground: string;
    dropShadow: SubtitleDropShadow;
    /**
     * Altura, en líneas. Negativo cuenta desde abajo (-3 = tres líneas por
     * encima del borde inferior), que es como lo guarda el nativo.
     */
    verticalPosition: number;
};

export const DEFAULT_SUBTITLE_APPEARANCE: SubtitleAppearance = {
    textSize: 'medium',
    font: '',
    textColor: '#ffffff',
    textBackground: 'transparent',
    dropShadow: 'uniform',
    verticalPosition: -3
};

/** Con la sesión abierta la preferencia es de ese usuario, como en el nativo. */
function storageKey(): string {
    const userId = loadSession()?.userId;
    return userId ? `${userId}-${KEY}` : KEY;
}

export function getSubtitleAppearance(): SubtitleAppearance {
    try {
        const raw = localStorage.getItem(storageKey());
        if (!raw) return { ...DEFAULT_SUBTITLE_APPEARANCE };
        // Lo que haya guardado el cliente nativo puede traer campos que aquí
        // no se usan (o faltarle los que sí): los defaults tapan el hueco.
        return { ...DEFAULT_SUBTITLE_APPEARANCE, ...JSON.parse(raw) as Partial<SubtitleAppearance> };
    } catch {
        return { ...DEFAULT_SUBTITLE_APPEARANCE };
    }
}

export function setSubtitleAppearance(patch: Partial<SubtitleAppearance>): SubtitleAppearance {
    const merged = { ...getSubtitleAppearance(), ...patch };
    localStorage.setItem(storageKey(), JSON.stringify(merged));
    // Lo escucha el reproductor para repintar sin tener que reabrirlo.
    window.dispatchEvent(new CustomEvent('jfp-subtitle-appearance'));
    return merged;
}
