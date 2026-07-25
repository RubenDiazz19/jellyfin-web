import { describe, expect, it } from 'vitest';

import {
    buildM3Css,
    M3_CONTRAST,
    M3_DEFAULT_SEED,
    M3_ELEVATION,
    M3_SHAPE,
    M3_TYPESCALE,
    makeColorTokens
} from '../m3';

const HEX = /^#[0-9a-f]{6}$/;

describe('m3: paletas md-sys-color', () => {
    it('genera la paleta completa con hex válidos (light y dark)', () => {
        for (const scheme of ['light', 'dark'] as const) {
            const tokens = makeColorTokens(M3_DEFAULT_SEED, scheme);
            expect(Object.keys(tokens)).toHaveLength(37);
            for (const [token, value] of Object.entries(tokens)) {
                expect(token).toMatch(/^--md-sys-color-[a-z-]+$/);
                expect(value).toMatch(HEX);
            }
        }
    });

    it('light y dark difieren, y la paleta responde al seed', () => {
        const dark = makeColorTokens(M3_DEFAULT_SEED, 'dark');
        const light = makeColorTokens(M3_DEFAULT_SEED, 'light');
        expect(dark['--md-sys-color-surface']).not.toBe(light['--md-sys-color-surface']);
        expect(dark['--md-sys-color-on-surface']).not.toBe(light['--md-sys-color-on-surface']);

        const otherSeed = makeColorTokens('#a03040', 'dark');
        expect(otherSeed['--md-sys-color-primary']).not.toBe(dark['--md-sys-color-primary']);
    });

    it('el contraste alto cambia la paleta y sigue dando hex válidos', () => {
        const std = makeColorTokens(M3_DEFAULT_SEED, 'dark', M3_CONTRAST.standard);
        const more = makeColorTokens(M3_DEFAULT_SEED, 'dark', M3_CONTRAST.more);
        // Sube el contraste de on-surface contra su superficie → cambia el token.
        expect(more['--md-sys-color-on-surface']).not.toBe(std['--md-sys-color-on-surface']);
        for (const value of Object.values(more)) expect(value).toMatch(HEX);
    });

    it('un contraste fuera de rango se recorta en vez de degenerar', () => {
        const clamped = makeColorTokens(M3_DEFAULT_SEED, 'dark', 99);
        const max = makeColorTokens(M3_DEFAULT_SEED, 'dark', 1);
        expect(clamped).toEqual(max);
    });
});

describe('m3: stylesheet generado', () => {
    it('queda scopeado a mobile/tablet y NUNCA a :root ni a desktop/tv', () => {
        const css = buildM3Css(M3_DEFAULT_SEED, 'dark');
        expect(css).toContain('html.layout-mobile');
        expect(css).toContain('html.layout-tablet');
        expect(css).not.toContain(':root');
        expect(css).not.toContain('layout-desktop');
        expect(css).not.toContain('layout-tv');
    });

    it('incluye elevation 0–5, corner tokens y las 15 escalas tipográficas', () => {
        const css = buildM3Css(M3_DEFAULT_SEED, 'light');

        expect(M3_ELEVATION).toHaveLength(6);
        for (let level = 0; level <= 5; level++) {
            expect(css).toContain(`--md-sys-elevation-level${level}:`);
        }

        for (const corner of Object.keys(M3_SHAPE)) {
            expect(css).toContain(`--md-sys-shape-corner-${corner}:`);
        }

        // Tokens de movimiento M3 (Fase 7).
        expect(css).toContain('--md-sys-motion-easing-emphasized-decelerate:');
        expect(css).toContain('--md-sys-motion-duration-medium2:');

        expect(Object.keys(M3_TYPESCALE)).toHaveLength(15);
        for (const role of Object.keys(M3_TYPESCALE)) {
            expect(css).toContain(`--md-sys-typescale-${role}-size:`);
            expect(css).toContain(`--md-sys-typescale-${role}-line-height:`);
            expect(css).toContain(`--md-sys-typescale-${role}-weight:`);
        }

        expect(css).toContain('--md-sys-color-scheme: light;');
    });

    it('emite el nivel de contraste activo como custom property', () => {
        expect(buildM3Css(M3_DEFAULT_SEED, 'dark')).toContain('--md-sys-contrast: 0;');
        expect(buildM3Css(M3_DEFAULT_SEED, 'dark', M3_CONTRAST.more)).toContain('--md-sys-contrast: 1;');
    });
});
