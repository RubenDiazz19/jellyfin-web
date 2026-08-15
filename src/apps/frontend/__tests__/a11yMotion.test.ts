// A11y — `prefers-reduced-motion` (WCAG 2.3.3). Las reglas viven en CSS, así
// que se comprueban sobre el texto: que existan, que cubran toda la app y —lo
// importante— que NO usen `animation: none`, que dejaría invisibles los
// elementos cuyo keyframe de entrada acaba en el estado visible.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { frontendCss } from './frontendCss';

const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf-8');

const siteScss = read('src/styles/site.scss');
const globalCss = frontendCss();

const REDUCE = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/;

/** Cuerpo del primer bloque `@media (prefers-reduced-motion: reduce)`. */
function reduceBlock(css: string): string {
    const start = css.search(REDUCE);
    if (start < 0) throw new Error('No hay bloque prefers-reduced-motion');
    // Cierra por conteo de llaves desde la del @media.
    let depth = 0;
    let i = css.indexOf('{', start);
    const from = i;
    for (; i < css.length; i++) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}' && --depth === 0) return css.slice(from, i + 1);
    }
    throw new Error('Bloque prefers-reduced-motion sin cerrar');
}

describe('prefers-reduced-motion: cobertura', () => {
    it('site.scss lo aplica a toda la app (dashboard y vistas legacy)', () => {
        const block = reduceBlock(siteScss);
        expect(block).toContain('*::before');
        expect(block).toContain('*::after');
    });

    it('el frontend lo aplica también a la ruta /video, que va sin AppLayout', () => {
        const block = reduceBlock(globalCss);
        expect(block).toContain('body.jf-frontend-active');
        expect(block).toContain('body.jf-video-active');
    });
});

describe('prefers-reduced-motion: los keyframes existentes se respetan', () => {
    for (const [name, css] of [['site.scss', siteScss], ['frontend', globalCss]] as const) {
        describe(name, () => {
            const block = reduceBlock(css);

            it('acorta la animación en vez de anularla', () => {
                // `animation: none` / `animation-name: none` descartaría el
                // fotograma final de los keyframes con fill-mode `both`
                // (fadein → opacity 1, jfp-sheet-in → transform none) y el
                // elemento quedaría invisible o desplazado.
                expect(block).not.toMatch(/animation\s*:\s*none/);
                expect(block).not.toMatch(/animation-name\s*:\s*none/);
                expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
            });

            it('detiene los bucles infinitos (spinner, skeleton, pulse)', () => {
                // Sin esto un `infinite` se repetiría a 0.01ms: peor que antes.
                expect(block).toMatch(/animation-iteration-count:\s*1\s*!important/);
            });

            it('neutraliza también transiciones y scroll suave del CSS', () => {
                expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
                expect(block).toMatch(/scroll-behavior:\s*auto\s*!important/);
            });
        });
    }
});

describe('prefers-reduced-motion: lo que el CSS no alcanza', () => {
    it('el scroll suave por JS del scrollManager consulta la preferencia', () => {
        // `behavior: 'smooth'` y el scroll animado a mano ganan siempre a la
        // propiedad CSS `scroll-behavior`.
        const scrollManager = read('src/legacy/components/scrollManager.js');
        expect(scrollManager).toContain('prefersReducedMotion()');
    });

    it('el ripple M3 no pinta el ink con movimiento reducido', () => {
        expect(read('src/apps/frontend/shared/ripple.ts')).toContain('prefersReducedMotion()');
    });
});
