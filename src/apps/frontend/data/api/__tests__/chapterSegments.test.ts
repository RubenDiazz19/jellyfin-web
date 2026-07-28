// Respaldo del botón de salto cuando el servidor no tiene proveedor de
// segmentos: deducir intro/créditos/resumen de los nombres de capítulo.

import { describe, expect, test } from 'vitest';
import { segmentsFromChapters } from '../chapterSegments';

describe('segmentsFromChapters', () => {
    test('deduce la intro y la acota con el capítulo siguiente', () => {
        const segments = segmentsFromChapters([
            { start: 0, name: 'Recap' },
            { start: 40, name: 'Opening Credits' },
            { start: 130, name: 'Chapter 3' }
        ], 1500);

        expect(segments).toEqual([
            { kind: 'Recap', start: 0, end: 40 },
            { kind: 'Intro', start: 40, end: 130 }
        ]);
    });

    test('el último capítulo llega hasta la duración del item', () => {
        const segments = segmentsFromChapters([
            { start: 0, name: 'Chapter 1' },
            { start: 1400, name: 'End Credits' }
        ], 1500);

        expect(segments).toEqual([{ kind: 'Outro', start: 1400, end: 1500 }]);
    });

    test('ignora los capítulos sin nombre reconocible', () => {
        expect(segmentsFromChapters([
            { start: 0, name: 'Chapter 1' },
            { start: 300, name: '' },
            { start: 600 }
        ], 900)).toEqual([]);
    });

    test('descarta una "intro" demasiado larga para ser una cabecera', () => {
        // "Introduction" como primer acto de una película: saltarlo se comería
        // seis minutos de contenido.
        expect(segmentsFromChapters([
            { start: 0, name: 'Introduction' },
            { start: 400, name: 'Chapter 2' }
        ], 3000)).toEqual([]);
    });

    test('los créditos finales sí pueden ser largos', () => {
        expect(segmentsFromChapters([
            { start: 0, name: 'Chapter 1' },
            { start: 3000, name: 'Créditos' }
        ], 3600)).toEqual([{ kind: 'Outro', start: 3000, end: 3600 }]);
    });

    test('sin duración conocida, el último capítulo no genera segmento', () => {
        expect(segmentsFromChapters([{ start: 100, name: 'Intro' }])).toEqual([]);
    });

    test('acepta OP/ED como nombre completo (convención de anime)', () => {
        const segments = segmentsFromChapters([
            { start: 0, name: 'Scene 1' },
            { start: 90, name: 'OP' },
            { start: 180, name: 'Scene 3' },
            { start: 1400, name: 'ED2' }
        ], 1500);

        expect(segments).toEqual([
            { kind: 'Intro', start: 90, end: 180 },
            { kind: 'Outro', start: 1400, end: 1500 }
        ]);
    });

    test('OP/ED dentro de una frase no cuentan', () => {
        // "Ed vuelve a casa" es un capítulo normal: saltarlo se comería la
        // escena entera.
        expect(segmentsFromChapters([
            { start: 0, name: 'Ed vuelve a casa' },
            { start: 200, name: 'Scene 2' }
        ], 1500)).toEqual([]);
    });

    test('ordena por inicio aunque los capítulos lleguen desordenados', () => {
        const segments = segmentsFromChapters([
            { start: 1400, name: 'Ending' },
            { start: 30, name: 'Intro' },
            { start: 90, name: 'Chapter 2' }
        ], 1500);

        expect(segments.map((s) => s.kind)).toEqual(['Intro', 'Outro']);
    });
});
