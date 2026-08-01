// Vocabulario del reproductor: cómo se nombran capítulos y tramos, y dónde
// van los cortes de la barra de progreso.
//
// Todo aquí es puro —entra data, sale texto o números— y no toca el <video>.
// Vive fuera del ViewModel porque es lo que consume el OSD directamente: la
// View no puede importar de data/ (regla de capas), así que este módulo hace
// también de puerta para los tipos de segmentos y capítulos.

import globalize from 'lib/globalize';

import type { ItemChapter } from '../../data/api/playbackContext';
import type { MediaSegment, MediaSegmentKind } from '../../data/api/segments';

export type { ItemChapter, MediaSegment, MediaSegmentKind };

/** Jellyfin cuenta el tiempo en «ticks» de 100 ns. */
export const TICKS_PER_SECOND = 10_000_000;

/**
 * Dónde reanudar, en ticks, sabiendo cuánto dura el item (en minutos) y por
 * dónde iba (0..1). `undefined` = empezar por el principio, que es lo que
 * espera el reproductor cuando no hay nada que reanudar.
 *
 * Lo usan las cuatro fichas: el progreso les llega de sitios distintos —del
 * item, del episodio en curso, del store local— pero la cuenta es la misma.
 */
export function ticksFromProgress(
    runtimeMinutes: number | undefined, progress: number
): number | undefined {
    if (!runtimeMinutes || progress <= 0) return undefined;
    return Math.round(runtimeMinutes * 60 * progress * TICKS_PER_SECOND);
}

// Modos de relación de aspecto que ofrece el OSD. 'auto' = tal cual (contain),
// 'cover' = rellena la pantalla recortando, 'fill' = estira ignorando la
// proporción; el resto fuerza esa proporción de display.
export type AspectRatio = 'auto' | 'cover' | 'fill' | '16:9' | '4:3' | '21:9';

/** Clave de traducción del botón de salto para cada tipo de segmento. */
export function segmentSkipLabelKey(kind: MediaSegmentKind): string {
    switch (kind) {
        case 'Intro': return 'SkipIntro';
        case 'Outro': return 'SkipCredits';
        case 'Recap': return 'SkipRecap';
        case 'Preview': return 'SkipPreview';
        case 'Commercial': return 'SkipCommercial';
        default: return 'Skip';
    }
}

/**
 * Nombres de capítulo genéricos que ponen los encoders, siempre en inglés,
 * con la clave de traducción que les corresponde. El grupo capturado, si lo
 * hay, es el número que va dentro del nombre.
 */
const GENERIC_CHAPTER_NAMES: [RegExp, string][] = [
    [/^scene\s*(\d+)$/i, 'ChapterScene'],
    [/^chapter\s*(\d+)$/i, 'LabelChapterNumber'],
    [/^part\s*(\d+)$/i, 'ChapterPart'],
    [/^(?:intro|introduction|opening|opening credits|op\s?\d*)$/i, 'ChapterIntro'],
    [/^(?:credits|end credits|closing credits|ending|outro|ed\s?\d*)$/i, 'ChapterCredits'],
    [/^(?:recap|previously)$/i, 'ChapterRecap'],
    [/^(?:preview|next episode)$/i, 'ChapterPreview']
];

/**
 * Nombre presentable de un capítulo. Los ficheros suelen traer nombres
 * genéricos del encoder («Scene 3», «Credits»): esos se traducen. Un nombre
 * de verdad —el título real de la escena— se deja tal cual, que para eso lo
 * puso quien preparó el fichero.
 */
export function chapterDisplayName(name: string | undefined, index: number): string {
    const raw = name?.trim();
    if (!raw) return globalize.translate('LabelChapterNumber', String(index + 1));
    for (const [pattern, key] of GENERIC_CHAPTER_NAMES) {
        const match = pattern.exec(raw);
        if (match) return globalize.translate(key, match[1] ?? '');
    }
    return raw;
}

/** Nombre del tramo detectado, para las listas de saltos. */
export function segmentDisplayName(kind: MediaSegmentKind): string {
    switch (kind) {
        case 'Intro': return globalize.translate('ChapterIntro');
        case 'Outro': return globalize.translate('ChapterCredits');
        case 'Recap': return globalize.translate('ChapterRecap');
        case 'Preview': return globalize.translate('ChapterPreview');
        default: return globalize.translate('Unknown');
    }
}

/** Posición del capítulo que contiene un instante, o -1 si no hay ninguno. */
export function chapterIndexAt(chapters: ItemChapter[], seconds: number): number {
    let found = -1;
    for (let i = 0; i < chapters.length; i++) {
        if (chapters[i].start > seconds) break;
        found = i;
    }
    return found;
}

/** Capítulo que contiene un instante, o null si el item no trae capítulos. */
export function chapterAt(chapters: ItemChapter[], seconds: number): ItemChapter | null {
    const index = chapterIndexAt(chapters, seconds);
    return index >= 0 ? chapters[index] : null;
}

/** Dos cortes más próximos que esto son el mismo sitio: se pinta uno. */
const DIVIDER_MERGE_SECONDS = 1;

/**
 * Puntos donde se corta la barra de progreso: el inicio de cada capítulo y
 * los dos extremos de cada tramo detectado (así la intro o los créditos
 * quedan delimitados aunque no haya un capítulo que los marque). Se devuelven
 * en segundos, ordenados y sin duplicados; los extremos del vídeo no cuentan,
 * que ahí ya está el borde de la barra.
 */
export function progressDividers(
    chapters: ItemChapter[], segments: MediaSegment[], duration: number
): number[] {
    if (duration <= 0) return [];
    const points = [
        ...chapters.map((c) => c.start),
        ...segments.flatMap((s) => [s.start, s.end])
    ]
        .filter((t) => t > DIVIDER_MERGE_SECONDS && t < duration - DIVIDER_MERGE_SECONDS)
        .sort((a, b) => a - b);

    return points.filter(
        (t, i) => i === 0 || t - points[i - 1] > DIVIDER_MERGE_SECONDS
    );
}

/**
 * Marca de la barra de progreso: un capítulo del fichero o un tramo detectado
 * (intro, créditos…). Sirve para el menú de saltos.
 */
export type PlayerMark = { start: number; name?: string; kind?: MediaSegmentKind };

/** Distancia por debajo de la cual un segmento y un capítulo son el mismo sitio. */
const MARK_MERGE_SECONDS = 5;

/**
 * Une capítulos y segmentos en una sola lista de saltos ordenada. Un segmento
 * que empieza donde ya hay un capítulo no se duplica: el nombre del capítulo
 * es más informativo que "Saltar intro".
 */
export function playerMarks(chapters: ItemChapter[], segments: MediaSegment[]): PlayerMark[] {
    const marks: PlayerMark[] = chapters.map((c) => ({ start: c.start, name: c.name }));
    for (const segment of segments) {
        const covered = chapters.some(
            (c) => Math.abs(c.start - segment.start) <= MARK_MERGE_SECONDS
        );
        if (!covered) marks.push({ start: segment.start, kind: segment.kind });
    }
    return marks.sort((a, b) => a.start - b.start);
}
