import { describe, it, expect } from 'vitest';
import {
    getLanguageOptions,
    getSubtitleModeOptions,
    getLocaleOptions,
    getSkipLengthOptions,
    getBitrateOptions
} from '../options';

describe('settings options', () => {
    it('getLanguageOptions incluye la opción vacía de Cualquier idioma y códigos estándar', () => {
        const options = getLanguageOptions();
        expect(options[0][0]).toBe('');
        expect(options[0][1]).toBeDefined();

        const codes = options.map(([code]) => code);
        expect(codes).toContain('spa');
        expect(codes).toContain('eng');
        expect(codes).toContain('jpn');
    });

    it('getSubtitleModeOptions devuelve las 5 opciones con etiquetas y textos de ayuda', () => {
        const options = getSubtitleModeOptions();
        expect(options).toHaveLength(5);
        const modes = options.map(([mode]) => mode);
        expect(modes).toEqual(['Default', 'Smart', 'OnlyForced', 'Always', 'None']);
        for (const [, label, help] of options) {
            expect(label).toBeTruthy();
            expect(help).toBeTruthy();
        }
    });

    it('getLocaleOptions añade la opción Auto y ordena alfabéticamente los nombres', () => {
        const locales = ['es', 'en', 'fr'];
        const options = getLocaleOptions(locales);

        expect(options[0][0]).toBe('');
        expect(options.slice(1)).toHaveLength(3);
    });

    it('getSkipLengthOptions devuelve los intervalos de salto en segundos', () => {
        const options = getSkipLengthOptions();
        const values = options.map(([val]) => val);
        expect(values).toEqual(['5', '10', '15', '20', '25', '30']);
    });

    it('getBitrateOptions mapea los límites de bitrate en Mbps', () => {
        const options = getBitrateOptions();
        expect(options.length).toBeGreaterThan(0);
        expect(options[0][0]).toBe(4_000_000);
        expect(options[0][1]).toContain('4 Mbps');
    });
});
