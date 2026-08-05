import { argbFromHex, Hct, SchemeContent } from '@material/material-color-utilities';
import { describe, expect, it } from 'vitest';

import {
    buildM3CssFromTokens,
    M3_COLOR_ROLE_COUNT,
    M3_CONTRAST,
    M3_DEFAULT_SEED,
    M3_ELEVATION,
    M3_SHAPE,
    M3_SPEC,
    M3_TYPESCALE,
    M3_TYPESCALE_EMPHASIZED
} from '../m3';
// La derivación vive aparte: es el punto de corte de la librería de color,
// que solo se carga en mobile/tablet (ver colorScheme.ts).
import { buildM3Css, makeColorTokens } from '../colorScheme';

const HEX = /^#[0-9a-f]{6}$/;

describe('m3: paletas md-sys-color', () => {
    it('genera la paleta completa con hex válidos (light y dark)', () => {
        for (const scheme of ['light', 'dark'] as const) {
            const tokens = makeColorTokens(M3_DEFAULT_SEED, scheme);
            expect(Object.keys(tokens)).toHaveLength(M3_COLOR_ROLE_COUNT);
            for (const [token, value] of Object.entries(tokens)) {
                expect(token).toMatch(/^--md-sys-color-[a-z-]+$/);
                expect(value).toMatch(HEX);
            }
        }
    });

    it('incluye los roles dim y fixed del spec 2025', () => {
        const tokens = makeColorTokens(M3_DEFAULT_SEED, 'dark');
        for (const accent of ['primary', 'secondary', 'tertiary'] as const) {
            for (const role of [
                `${accent}-dim`,
                `${accent}-fixed`,
                `${accent}-fixed-dim`,
                `on-${accent}-fixed`,
                `on-${accent}-fixed-variant`
            ]) {
                expect(tokens[`--md-sys-color-${role}`], role).toMatch(HEX);
            }
        }
        expect(tokens['--md-sys-color-error-dim']).toMatch(HEX);

        // Los fixed valen lo mismo en claro y en oscuro: es su razón de ser.
        const light = makeColorTokens(M3_DEFAULT_SEED, 'light');
        expect(light['--md-sys-color-primary-fixed']).toBe(tokens['--md-sys-color-primary-fixed']);
        expect(light['--md-sys-color-on-primary-fixed']).toBe(tokens['--md-sys-color-on-primary-fixed']);
    });

    // Fija la limitación descrita en M3_SPEC: material-color-utilities acepta
    // el spec 2025 pero lo degrada a 2021 en la variante CONTENT, que es la
    // que usa la app. Si algún día lo soporta, este test avisa (y toca revisar
    // la paleta) en vez de cambiar todos los colores en silencio.
    it('el spec 2025 que se pide lo degrada la librería a 2021 en CONTENT', () => {
        expect(M3_SPEC).toBe('2025');
        const scheme = new SchemeContent(Hct.fromInt(argbFromHex(M3_DEFAULT_SEED)), true, 0, M3_SPEC);
        expect(scheme.specVersion).toBe('2021');
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
        // El shorthand del bottom sheet: redondas solo las de arriba.
        expect(css).toContain('--md-sys-shape-corner-extra-large-top: 28px 28px 0 0;');

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

    it('emite los 15 estilos emphasized sin tocar los baseline', () => {
        const css = buildM3Css(M3_DEFAULT_SEED, 'dark');

        expect(Object.keys(M3_TYPESCALE_EMPHASIZED)).toHaveLength(15);
        for (const [role, t] of Object.entries(M3_TYPESCALE_EMPHASIZED)) {
            expect(css).toContain(`--md-sys-typescale-${role}-size: ${t.size};`);
            expect(css).toContain(`--md-sys-typescale-${role}-weight: ${t.weight};`);
        }

        // Mismo tamaño que su baseline y un escalón más de peso: cambiar de
        // uno a otro no debe mover el layout.
        for (const [role, base] of Object.entries(M3_TYPESCALE)) {
            const emph = M3_TYPESCALE_EMPHASIZED[`${role}-emphasized`];
            expect(emph.size).toBe(base.size);
            expect(emph.lineHeight).toBe(base.lineHeight);
            expect(Number(emph.weight)).toBeGreaterThan(Number(base.weight));
        }

        // Los baseline siguen exactamente donde estaban.
        expect(css).toContain('--md-sys-typescale-label-small-weight: 500;');
        expect(css).toContain('--md-sys-typescale-display-large-weight: 400;');
    });

    it('buildM3Css es una fachada de buildM3CssFromTokens (misma salida)', () => {
        const contrast = M3_CONTRAST.more;
        const tokens = makeColorTokens('#a03040', 'dark', contrast);
        expect(buildM3CssFromTokens(tokens, 'dark', contrast))
            .toBe(buildM3Css('#a03040', 'dark', contrast));
    });

    it('emite el nivel de contraste activo como custom property', () => {
        expect(buildM3Css(M3_DEFAULT_SEED, 'dark')).toContain('--md-sys-contrast: 0;');
        expect(buildM3Css(M3_DEFAULT_SEED, 'dark', M3_CONTRAST.more)).toContain('--md-sys-contrast: 1;');
    });
});
