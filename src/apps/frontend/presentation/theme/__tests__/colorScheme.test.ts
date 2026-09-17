import { describe, it, expect } from 'vitest';
import { makeColorTokens, buildM3Css } from '../colorScheme';
import { M3_CONTRAST } from '../m3';

describe('colorScheme', () => {
    describe('makeColorTokens', () => {
        it('genera mapa de tokens con prefijo --md-sys-color- para modo oscuro', () => {
            const tokens = makeColorTokens('#00aa88', 'dark');
            expect(tokens).toBeDefined();
            expect(tokens['--md-sys-color-primary']).toBeDefined();
            expect(tokens['--md-sys-color-background']).toBeDefined();
            expect(tokens['--md-sys-color-surface']).toBeDefined();
        });

        it('genera mapa de tokens para modo claro', () => {
            const tokens = makeColorTokens('#00aa88', 'light');
            expect(tokens).toBeDefined();
            expect(tokens['--md-sys-color-primary']).toBeDefined();
        });

        it('respeta diferentes niveles de contraste', () => {
            const standard = makeColorTokens('#00aa88', 'dark', M3_CONTRAST.standard);
            const high = makeColorTokens('#00aa88', 'dark', M3_CONTRAST.more);
            expect(standard['--md-sys-color-primary']).toBeDefined();
            expect(high['--md-sys-color-primary']).toBeDefined();
        });
    });

    describe('buildM3Css', () => {
        it('devuelve cadena CSS con tokens y reglas de estilo', () => {
            const css = buildM3Css('#00aa88', 'dark');
            expect(typeof css).toBe('string');
            expect(css).toContain('--md-sys-color-primary');
            expect(css).toContain('--md-sys-elevation');
        });
    });
});
