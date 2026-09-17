import { describe, it, expect } from 'vitest';
import {
    getSubtitleTextSizeOptions,
    getSubtitleFontOptions,
    getSubtitleDropShadowOptions
} from '../subtitleOptions';

describe('subtitleOptions', () => {
    it('getSubtitleTextSizeOptions devuelve las opciones de tamaño de texto', () => {
        const options = getSubtitleTextSizeOptions();
        const sizes = options.map(([val]) => val);
        expect(sizes).toEqual(['smaller', 'small', 'medium', 'large', 'larger', 'extralarge']);
        for (const [, label] of options) {
            expect(label).toBeTruthy();
        }
    });

    it('getSubtitleFontOptions devuelve las opciones de tipografía incluyendo la predeterminada', () => {
        const options = getSubtitleFontOptions();
        const fonts = options.map(([val]) => val);
        expect(fonts).toEqual(['', 'typewriter', 'print', 'console', 'cursive', 'casual', 'smallcaps']);
        for (const [, label] of options) {
            expect(label).toBeTruthy();
        }
    });

    it('getSubtitleDropShadowOptions devuelve las opciones de sombreado y contorno', () => {
        const options = getSubtitleDropShadowOptions();
        const shadows = options.map(([val]) => val);
        expect(shadows).toEqual(['uniform', 'dropshadow', 'raised', 'depressed', 'none']);
        for (const [, label] of options) {
            expect(label).toBeTruthy();
        }
    });
});
