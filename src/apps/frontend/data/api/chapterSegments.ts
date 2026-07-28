// Segmentos saltables derivados de los CAPÍTULOS del item. Es el respaldo de
// `segments.ts` para la mayoría de servidores, que no tienen instalado un
// proveedor de segmentos (Intro Skipper y compañía) pero sí traen capítulos.
//
// Módulo aparte y sin I/O a propósito: el ViewModel lo importa directamente
// (es una transformación pura) y así no arrastra la capa HTTP.

import type { ItemChapter } from './playbackContext';
import type { MediaSegment, MediaSegmentKind } from './segments';

/** Nombres de capítulo que delatan cada tipo de segmento. */
const CHAPTER_PATTERNS: [MediaSegmentKind, RegExp][] = [
    [
        'Recap',
        /\b(recap|previously|resumen|anteriormente|en episodios anteriores)\b/i
    ],
    // 'OP'/'ED' (convención de anime) solo valen como nombre COMPLETO del
    // capítulo, con un número opcional detrás ("OP", "ED2"). Como palabra
    // suelta dentro de una frase darían falsos positivos ("Ed vuelve a
    // casa") y un salto equivocado se come contenido de verdad.
    [
        'Intro',
        /^op\s?\d*$|\b(intro|introduction|opening|cabecera|entradilla|apertura|sintonia|sintonía|title sequence|main title|theme song)\b/i
    ],
    [
        'Outro',
        /^ed\s?\d*$|\b(outro|ending|credits|créditos|creditos|cierre)\b/i
    ],
    ['Preview', /\b(preview|next episode|avance|próximamente|proximamente)\b/i]
];

/**
 * Un capítulo de intro/resumen larguísimo casi siempre es un capítulo normal
 * mal nombrado ("Introduction" como primer acto de una película). Saltarlo
 * se comería minutos de contenido, así que por encima de este umbral no se
 * ofrece el botón. Los créditos finales no se acotan: pueden durar mucho.
 */
const MAX_SKIPPABLE_SECONDS = 300;

/**
 * Deriva segmentos saltables de los capítulos del item. Se usa solo cuando el
 * servidor no devuelve segmentos propios: estos son una heurística sobre el
 * nombre del capítulo, no una detección real.
 */
export function segmentsFromChapters(
    chapters: ItemChapter[],
    runtimeSeconds?: number
): MediaSegment[] {
    const sorted = [...chapters].sort((a, b) => a.start - b.start);

    return sorted
        .flatMap((chapter, i): MediaSegment[] => {
            const name = chapter.name?.trim();
            if (!name) return [];
            const match = CHAPTER_PATTERNS.find(([, re]) => re.test(name));
            if (!match) return [];
            const kind = match[0];

            // El capítulo llega hasta el siguiente; el último, hasta el final.
            const end = sorted[i + 1]?.start ?? runtimeSeconds ?? 0;
            const start = chapter.start;
            if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
            if (kind !== 'Outro' && end - start > MAX_SKIPPABLE_SECONDS) return [];
            return [{ kind, start, end }];
        })
        .sort((a, b) => a.start - b.start);
}
