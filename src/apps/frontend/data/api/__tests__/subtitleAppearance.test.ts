import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getSubtitleAppearance,
    setSubtitleAppearance,
    DEFAULT_SUBTITLE_APPEARANCE
} from '../subtitleAppearance';
import * as sessionModule from '../../session/session';

vi.mock('../../session/session');

describe('subtitleAppearance', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        vi.mocked(sessionModule.loadSession).mockReturnValue(null);
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('devuelve los valores por defecto si no hay datos en localStorage', () => {
        const appearance = getSubtitleAppearance();
        expect(appearance).toEqual(DEFAULT_SUBTITLE_APPEARANCE);
    });

    it('devuelve los valores por defecto si el contenido de localStorage está corrupto', () => {
        localStorage.setItem('localplayersubtitleappearance3', 'invalid-json{');
        const appearance = getSubtitleAppearance();
        expect(appearance).toEqual(DEFAULT_SUBTITLE_APPEARANCE);
    });

    it('combina campos guardados con los valores por defecto', () => {
        localStorage.setItem('localplayersubtitleappearance3', JSON.stringify({
            textSize: 'large',
            textColor: '#ffff00'
        }));

        const appearance = getSubtitleAppearance();
        expect(appearance.textSize).toBe('large');
        expect(appearance.textColor).toBe('#ffff00');
        expect(appearance.font).toBe(DEFAULT_SUBTITLE_APPEARANCE.font);
        expect(appearance.dropShadow).toBe(DEFAULT_SUBTITLE_APPEARANCE.dropShadow);
    });

    it('guarda las preferencias, emite evento y devuelve el objeto resultante', () => {
        const spy = vi.fn();
        window.addEventListener('jfp-subtitle-appearance', spy);

        const updated = setSubtitleAppearance({
            textSize: 'smaller',
            dropShadow: 'dropshadow'
        });

        expect(updated.textSize).toBe('smaller');
        expect(updated.dropShadow).toBe('dropshadow');
        expect(updated.textColor).toBe('#ffffff');

        const saved = JSON.parse(localStorage.getItem('localplayersubtitleappearance3') ?? '{}');
        expect(saved.textSize).toBe('smaller');
        expect(saved.dropShadow).toBe('dropshadow');
        expect(spy).toHaveBeenCalledTimes(1);

        window.removeEventListener('jfp-subtitle-appearance', spy);
    });

    it('asocia la clave al usuario si hay sesión activa', () => {
        vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'u-123' } as any);

        setSubtitleAppearance({ textSize: 'extralarge' });
        expect(localStorage.getItem('u-123-localplayersubtitleappearance3')).not.toBeNull();
        expect(localStorage.getItem('localplayersubtitleappearance3')).toBeNull();

        const loaded = getSubtitleAppearance();
        expect(loaded.textSize).toBe('extralarge');
    });
});
