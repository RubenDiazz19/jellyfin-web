// De la preferencia de subtítulos al CSS que el navegador aplica a las cues.
//
// `::cue` no se puede estilar desde React: el texto vive en el shadow DOM del
// <video> y no hay elemento al que ponerle `style`. Tampoco sirven las
// variables CSS —Chromium no las resuelve dentro de `::cue`—, así que la única
// vía es escribir una regla con los valores ya calculados. Eso es lo que hace
// este módulo: compone la regla y la deja en una hoja de estilo suya, que
// pisa a la de `player.css` por ir después en el documento.
//
// La posición vertical va aparte, en `cue.line`: `::cue` no admite colocación.

import {
    DEFAULT_SUBTITLE_APPEARANCE,
    type SubtitleAppearance, type SubtitleDropShadow, type SubtitleFont, type SubtitleTextSize
} from '../../data/api/subtitleAppearance';

export type { SubtitleAppearance, SubtitleDropShadow, SubtitleFont, SubtitleTextSize };
export {
    DEFAULT_SUBTITLE_APPEARANCE,
    getSubtitleAppearance,
    setSubtitleAppearance
} from '../../data/api/subtitleAppearance';

/** Cuerpo de texto de cada tamaño, relativo al del vídeo. */
const TEXT_SIZE_EM: Record<SubtitleTextSize, number> = {
    smaller: 0.7,
    small: 0.85,
    medium: 1.05,
    large: 1.35,
    larger: 1.7,
    extralarge: 2.2
};

/** La del reproductor, que es también la de «versalitas» (solo cambia la caja). */
const DEFAULT_FONT_STACK = "'Inter', system-ui, sans-serif";

/** Las mismas familias que ofrece el selector nativo. */
const FONT_STACK: Record<Exclude<SubtitleFont, '' | 'smallcaps'>, string> = {
    typewriter: "'Courier New', Courier, monospace",
    print: 'Georgia, "Times New Roman", serif',
    console: 'Consolas, "Lucida Console", monospace',
    cursive: '"Segoe Script", "Brush Script MT", cursive',
    casual: '"Comic Sans MS", "Chalkboard SE", cursive'
};

function fontStack(font: SubtitleFont): string {
    if (!font || font === 'smallcaps') return DEFAULT_FONT_STACK;
    return FONT_STACK[font] ?? DEFAULT_FONT_STACK;
}

/**
 * El contorno de `uniform`, que es el de fábrica: ocho sombras alrededor para
 * cerrar el trazo (`text-shadow` es lo único que `::cue` admite para esto) y
 * una novena difusa que despega el texto de los fondos claros.
 */
function uniformOutline(): string {
    const dirs = [
        [-2, -2], [0, -2], [2, -2],
        [-2, 0], [2, 0],
        [-2, 2], [0, 2], [2, 2]
    ];
    return [
        ...dirs.map(([x, y]) => `${x}px ${y}px 0 #000`),
        '0 2px 6px rgb(0 0 0 / 80%)'
    ].join(', ');
}

const DROP_SHADOW_CSS: Record<SubtitleDropShadow, string> = {
    uniform: uniformOutline(),
    dropshadow: '2px 2px 4px rgb(0 0 0 / 85%)',
    raised: '1px 1px 0 #000, 2px 2px 0 rgb(0 0 0 / 70%), 3px 3px 2px rgb(0 0 0 / 45%)',
    depressed: '-1px -1px 0 rgb(0 0 0 / 85%), 1px 1px 0 rgb(255 255 255 / 25%)',
    none: 'none'
};

/**
 * Las propiedades que definen el aspecto del texto, ya resueltas.
 *
 * Sale de aquí en forma de objeto y no de CSS suelto porque lo consumen dos
 * sitios: la regla `::cue` del reproductor y la vista previa de Ajustes, que
 * es un elemento normal. Con una sola fuente no pueden acabar enseñando cosas
 * distintas, que es justo lo que hace inútil a una vista previa.
 *
 * El tamaño sale en `em` a propósito: sobre el vídeo se mide contra el cuerpo
 * que el navegador da a las cues (que escala con el tamaño del reproductor), y
 * en la vista previa, contra el que le ponga la caja.
 */
export function subtitleTextStyle(appearance: SubtitleAppearance): {
    fontFamily: string;
    fontSize: string;
    lineHeight: string;
    fontVariant: string;
    color: string;
    background: string;
    textShadow: string;
} {
    const a = { ...DEFAULT_SUBTITLE_APPEARANCE, ...appearance };
    return {
        fontFamily: fontStack(a.font),
        fontSize: `${TEXT_SIZE_EM[a.textSize] ?? TEXT_SIZE_EM.medium}em`,
        lineHeight: '1.4',
        fontVariant: a.font === 'smallcaps' ? 'small-caps' : 'normal',
        color: a.textColor,
        background: a.textBackground,
        textShadow: DROP_SHADOW_CSS[a.dropShadow] ?? DROP_SHADOW_CSS.uniform
    };
}

/** La regla `::cue` que corresponde a estos ajustes. */
export function subtitleCueCss(appearance: SubtitleAppearance): string {
    const style = subtitleTextStyle(appearance);
    const body = [
        `font-family: ${style.fontFamily}`,
        `font-size: ${style.fontSize}`,
        `line-height: ${style.lineHeight}`,
        `font-variant: ${style.fontVariant}`,
        `color: ${style.color}`,
        `background: ${style.background}`,
        `text-shadow: ${style.textShadow}`
    ].map((line) => `    ${line};`).join('\n');

    return `.jfp-video-el::cue {\n${body}\n}`;
}

const STYLE_ID = 'jfp-subtitle-appearance';

/**
 * Deja la regla puesta en el documento. Reutiliza la misma etiqueta en cada
 * llamada: aplicar un cambio no debe ir dejando hojas de estilo muertas.
 */
export function applySubtitleAppearance(appearance: SubtitleAppearance): void {
    if (typeof document === 'undefined') return;
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        document.head.appendChild(style);
    }
    style.textContent = subtitleCueCss(appearance);
}

/**
 * Cues que hemos colocado nosotros.
 *
 * Sin esto, la posición solo se podría cambiar una vez: al escribir `line` la
 * cue deja de estar en `auto` y en la siguiente pasada ya no habría forma de
 * distinguirla de una que trae posición propia del subtítulo.
 */
const positioned = new WeakSet<VTTCue>();

/**
 * Sube o baja las cues.
 *
 * `line` se cuenta en líneas de texto: negativo desde abajo (-3, el valor de
 * fábrica, deja tres líneas de aire) y positivo desde arriba. Se aplica cue a
 * cue porque el navegador coloca cada una por su cuenta; las que ya traen
 * posición del propio subtítulo (un cartel arriba de la pantalla) se respetan.
 */
export function applyCueLine(cues: TextTrackCueList | null, verticalPosition: number): void {
    for (const cue of Array.from(cues ?? [])) {
        if (!(cue instanceof VTTCue)) continue;
        if (cue.line !== 'auto' && !positioned.has(cue)) continue;
        cue.line = verticalPosition;
        positioned.add(cue);
    }
}
