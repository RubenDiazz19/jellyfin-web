import { describe, it, expect } from 'vitest';
import { T, C, HERO_POS, HERO_SCRIM } from '../tokens';

describe('theme tokens', () => {
    it('T define los valores base de diseño', () => {
        expect(T.bg).toBe('#000');
        expect(T.fg).toBe('#fff');
        expect(T.dim).toBeDefined();
        expect(T.hairline).toBeDefined();
        expect(T.ui).toContain('Inter');
    });

    it('C contiene las variables M3 adaptativas con fallback', () => {
        expect(C.bg).toContain('var(--md-sys-color-background');
        expect(C.fg).toContain('var(--md-sys-color-on-background');
        expect(C.surface).toContain('var(--md-sys-color-surface');
        expect(C.primary).toContain('var(--md-sys-color-primary');
    });

    it('HERO_POS define las posiciones clave de hero', () => {
        expect(HERO_POS.Esquina).toBeDefined();
        expect(HERO_POS.Esquina.justify).toBe('flex-end');
        expect(HERO_POS.Esquina.align).toBe('flex-start');

        expect(HERO_POS.Inferior).toBeDefined();
        expect(HERO_POS.Inferior.align).toBe('center');

        expect(HERO_POS.Centro).toBeDefined();
        expect(HERO_POS.Centro.justify).toBe('center');
    });

    it('HERO_SCRIM define opacidades de degradado válidas', () => {
        expect(HERO_SCRIM.Sutil).toBe(0.4);
        expect(HERO_SCRIM.Media).toBe(0.66);
        expect(HERO_SCRIM.Intensa).toBe(0.85);
    });
});
