// La escala de breakpoints vive en dos sitios por fuerza (TS no se puede
// importar desde SCSS y al revés tampoco): `utils/breakpoints.ts` y
// `styles/_breakpoints.scss`. Este test es lo que impide que se separen —
// tocar uno sin el otro rompe la suite.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { BREAKPOINTS, FRONTEND_DESKTOP_MIN_WIDTH, mediaDown, mediaUp } from './breakpoints';

const scss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/styles/_breakpoints.scss'),
    'utf-8'
);

/** Valor en px de una variable `$key: <n>em;` del SCSS (1em = 16px). */
function scssPx(key: string): number {
    const m = new RegExp(`\\$${key}:\\s*([\\d.]+)em`).exec(scss);
    if (!m) throw new Error(`No está $${key} en _breakpoints.scss`);
    return Number(m[1]) * 16;
}

describe('escala de breakpoints', () => {
    it('TS y SCSS declaran los mismos cortes', () => {
        for (const [key, px] of Object.entries(BREAKPOINTS)) {
            expect(scssPx(key), `$${key} en _breakpoints.scss`).toBe(px);
        }
    });

    it('coincide con la escala de MUI, que es la que ya usa el dashboard', () => {
        expect(BREAKPOINTS).toEqual({ sm: 600, md: 900, lg: 1200, xl: 1536 });
    });

    it('los cortes van de menor a mayor', () => {
        const values = Object.values(BREAKPOINTS);
        expect([...values].sort((a, b) => a - b)).toEqual(values);
    });
});

describe('excepción del frontend propio', () => {
    it('el escritorio del frontend empieza en 1024, no en lg', () => {
        // Subirlo a lg (1200) metería los portátiles de 1024–1199 en el layout
        // táctil; bajarlo a md (900) dejaría fuera al iPad en horizontal.
        expect(FRONTEND_DESKTOP_MIN_WIDTH).toBe(1024);
        expect(FRONTEND_DESKTOP_MIN_WIDTH).toBeGreaterThan(BREAKPOINTS.md);
        expect(FRONTEND_DESKTOP_MIN_WIDTH).toBeLessThan(BREAKPOINTS.lg);
    });
});

describe('helpers de media query', () => {
    it('mediaUp usa el corte tal cual', () => {
        expect(mediaUp('md')).toBe('(min-width: 900px)');
    });

    it('mediaDown no se solapa con mediaUp del mismo corte', () => {
        expect(mediaDown('md')).toBe('(max-width: 899.95px)');
    });
});
