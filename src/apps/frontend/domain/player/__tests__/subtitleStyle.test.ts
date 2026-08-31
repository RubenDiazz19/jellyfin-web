// La apariencia de los subtítulos: que lo elegido en Ajustes llegue tal cual
// a la regla `::cue` y a la vista previa.
//
// Se prueba el mapeo y no el pintado porque es donde está el riesgo real: la
// regla se compone a mano en una cadena, así que un campo que se deje de
// escribir no rompe nada visible en los tests, solo hace que el ajuste no haga
// nada sobre el vídeo.

import { beforeAll, describe, expect, test, vi } from 'vitest';

// El módulo lee la sesión para saber de quién es la preferencia, y con ella
// entra el cliente de API legacy entero (playbackmanager incluido), que al
// cargarse suelta errores sin control y tumba la ejecución aunque todo pase.
vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        getApi: () => null,
        getCurrentUserId: () => null,
        getCurrentServerId: () => null,
        connect: () => Promise.resolve(),
        logout: () => Promise.resolve()
    }
}));

import {
    DEFAULT_SUBTITLE_APPEARANCE, applyCueLine, applySubtitleAppearance,
    removeSubtitleAppearance, subtitleCueCss, subtitleTextStyle
} from '../subtitleStyle';

describe('subtitleTextStyle', () => {
    test('de fábrica: blanco con contorno cerrado y sin caja', () => {
        const style = subtitleTextStyle(DEFAULT_SUBTITLE_APPEARANCE);
        expect(style.color).toBe('#ffffff');
        expect(style.background).toBe('transparent');
        // Ocho direcciones + la difusa: es lo que imita el trazo de libass.
        expect(style.textShadow.split(',')).toHaveLength(9);
    });

    test('cada tamaño da un cuerpo distinto y creciente', () => {
        const em = (textSize: 'smaller' | 'medium' | 'extralarge') =>
            parseFloat(subtitleTextStyle({ ...DEFAULT_SUBTITLE_APPEARANCE, textSize }).fontSize);

        expect(em('smaller')).toBeLessThan(em('medium'));
        expect(em('medium')).toBeLessThan(em('extralarge'));
    });

    test('versalitas cambia la caja, no la familia', () => {
        const plain = subtitleTextStyle(DEFAULT_SUBTITLE_APPEARANCE);
        const smallcaps = subtitleTextStyle({ ...DEFAULT_SUBTITLE_APPEARANCE, font: 'smallcaps' });

        expect(smallcaps.fontVariant).toBe('small-caps');
        expect(smallcaps.fontFamily).toBe(plain.fontFamily);
    });

    test('«sin sombra» no deja rastro de la de fábrica', () => {
        const style = subtitleTextStyle({ ...DEFAULT_SUBTITLE_APPEARANCE, dropShadow: 'none' });
        expect(style.textShadow).toBe('none');
    });
});

describe('subtitleCueCss', () => {
    test('apunta a las cues del reproductor y lleva lo elegido', () => {
        const css = subtitleCueCss({
            ...DEFAULT_SUBTITLE_APPEARANCE,
            textSize: 'large',
            textColor: '#ffee00',
            textBackground: 'rgba(0,0,0,0.6)',
            font: 'typewriter'
        });

        expect(css).toContain('.jfp-video-el::cue');
        expect(css).toContain('color: #ffee00');
        expect(css).toContain('background: rgba(0,0,0,0.6)');
        expect(css).toContain('Courier');
    });

    test('escribe las siete propiedades, no solo las que cambian', () => {
        const css = subtitleCueCss(DEFAULT_SUBTITLE_APPEARANCE);
        for (const prop of [
            'font-family', 'font-size', 'line-height', 'font-variant',
            'color', 'background', 'text-shadow'
        ]) {
            expect(css).toContain(`${prop}:`);
        }
    });
});

describe('applyCueLine', () => {
    /** Un doble de VTTCue: jsdom no lo trae. */
    class FakeCue {
        line: number | 'auto' = 'auto';
    }

    // `applyCueLine` filtra por `instanceof VTTCue`, así que el doble tiene
    // que pasar por uno.
    const asCues = (cues: FakeCue[]) => cues as unknown as TextTrackCueList;

    beforeAll(() => {
        vi.stubGlobal('VTTCue', FakeCue);
    });

    test('coloca las cues que no traen posición propia', () => {
        const cues = [new FakeCue(), new FakeCue()];
        applyCueLine(asCues(cues), -5);
        expect(cues.map((c) => c.line)).toEqual([-5, -5]);
    });

    test('respeta la posición que trae el propio subtítulo', () => {
        const fixed = new FakeCue();
        fixed.line = 2;
        applyCueLine(asCues([fixed]), -5);
        expect(fixed.line).toBe(2);
    });

    test('se puede volver a mover lo que ya movimos', () => {
        const cue = new FakeCue();
        applyCueLine(asCues([cue]), -5);
        applyCueLine(asCues([cue]), -1);
        expect(cue.line).toBe(-1);
    });
});

describe('applySubtitleAppearance y removeSubtitleAppearance', () => {
    test('inserta y elimina el elemento <style> del documento', () => {
        applySubtitleAppearance(DEFAULT_SUBTITLE_APPEARANCE);
        const style = document.getElementById('jfp-subtitle-appearance');
        expect(style).not.toBeNull();
        expect(style?.textContent).toContain('.jfp-video-el::cue');

        removeSubtitleAppearance();
        expect(document.getElementById('jfp-subtitle-appearance')).toBeNull();
    });
});
