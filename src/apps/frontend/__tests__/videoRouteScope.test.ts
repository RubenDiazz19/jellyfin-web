// La ruta /video se monta SIN AppLayout, así que su `body` lleva
// `jf-video-active` pero no `jf-frontend-active`. Toda regla anclada solo a la
// segunda se pierde ahí, en silencio y sin que nada falle: simplemente el
// reproductor se ve distinto.
//
// Ya ha pasado dos veces —con `touch-action` y con el fondo de pantalla
// completa, donde el vídeo se quedaba detrás del fondo del navegador y solo
// reaparecía al salir con Esc—, así que estas son las reglas que no pueden
// volver a olvidarse.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Quita los comentarios. Sin esto, buscar «touch-action: manipulation»
 * encuentra antes el párrafo que lo explica que la regla que lo aplica.
 *
 * A mano y no con un regex: el que hace esto en una pasada es de los que se
 * atragantan con un fichero grande, y ESLint lo rechaza por eso.
 */
function stripComments(css: string): string {
    let out = '';
    let i = 0;
    for (;;) {
        const start = css.indexOf('/*', i);
        if (start < 0) return out + css.slice(i);
        out += css.slice(i, start);
        const end = css.indexOf('*/', start + 2);
        if (end < 0) return out;
        i = end + 2;
    }
}

const globalCss = stripComments(fs.readFileSync(
    path.resolve(process.cwd(), 'src/apps/frontend/presentation/styles/global.css'),
    'utf-8'
));

/**
 * Los selectores de cada regla cuyo cuerpo declara `needle`.
 *
 * Cortando por `}`, cada trozo es «selectores { declaraciones»; el último `{`
 * separa los dos porque un `@media` deja su cabecera delante, y ahí lo que
 * interesa es el selector de dentro.
 */
function selectorsFor(needle: string): string[] {
    const found: string[] = [];
    for (const chunk of globalCss.split('}')) {
        const open = chunk.lastIndexOf('{');
        if (open < 0) continue;
        if (chunk.slice(open + 1).includes(needle)) found.push(chunk.slice(0, open).trim());
    }
    expect(found.length, `ninguna regla declara «${needle}»`).toBeGreaterThan(0);
    return found;
}

/** ¿Alguna de las reglas que declaran `needle` alcanza a la ruta /video? */
const reachesVideoRoute = (needle: string) =>
    selectorsFor(needle).some((s) => s.includes('jf-video-active'));

describe('la ruta /video no se queda fuera de las reglas del frontend', () => {
    it('el fondo negro de pantalla completa la alcanza', () => {
        const fullscreenRules = selectorsFor('background: #000 !important')
            .filter((s) => s.includes(':fullscreen'));
        expect(fullscreenRules.some((s) => s.includes('jf-video-active'))).toBe(true);
    });

    it('y el del backdrop del navegador también', () => {
        const backdropRules = selectorsFor('background: #000 !important')
            .filter((s) => s.includes('::backdrop'));
        expect(backdropRules.some((s) => s.includes('jf-video-active'))).toBe(true);
    });

    it('el reproductor en pantalla completa se pinta en negro pase lo que pase', () => {
        // El suelo: no depende de qué clase lleve el body.
        expect(selectorsFor('background: #000 !important')
            .some((s) => s.includes('.jfp-video:fullscreen'))).toBe(true);
    });

    it('touch-action llega a los controles del reproductor', () => {
        // La primera vez que pasó esto: los botones del OSD se quedaban con el
        // retardo del doble tap porque la regla solo miraba al frontend.
        expect(reachesVideoRoute('touch-action: manipulation')).toBe(true);
    });
});
