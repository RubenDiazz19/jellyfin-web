import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getSkipLengths,
    setSkipLengths,
    getShowRemainingTime,
    setShowRemainingTime,
    DEFAULT_SKIP_BACK,
    DEFAULT_SKIP_FORWARD
} from '../playbackPrefs';
import * as sessionModule from '../../session/session';

vi.mock('../../session/session');

describe('playbackPrefs', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        vi.mocked(sessionModule.loadSession).mockReturnValue(null);
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('getSkipLengths y setSkipLengths', () => {
        it('devuelve los valores por defecto si no hay nada guardado', () => {
            const lengths = getSkipLengths();
            expect(lengths).toEqual({
                back: DEFAULT_SKIP_BACK,
                forward: DEFAULT_SKIP_FORWARD
            });
        });

        it('guarda en milisegundos y devuelve en segundos, emitiendo evento', () => {
            const spy = vi.fn();
            window.addEventListener('jfp-playback-prefs', spy);

            const updated = setSkipLengths({ back: 15, forward: 45 });
            expect(updated).toEqual({ back: 15, forward: 45 });

            expect(localStorage.getItem('skipBackLength')).toBe('15000');
            expect(localStorage.getItem('skipForwardLength')).toBe('45000');
            expect(spy).toHaveBeenCalledTimes(1);

            window.removeEventListener('jfp-playback-prefs', spy);
        });

        it('admite actualizaciones parciales', () => {
            setSkipLengths({ back: 20 });
            expect(getSkipLengths()).toEqual({
                back: 20,
                forward: DEFAULT_SKIP_FORWARD
            });

            setSkipLengths({ forward: 60 });
            expect(getSkipLengths()).toEqual({
                back: 20,
                forward: 60
            });
        });

        it('guarda por usuario si hay sesión activa', () => {
            vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'user-42' } as any);

            setSkipLengths({ back: 5, forward: 10 });
            expect(localStorage.getItem('user-42-skipBackLength')).toBe('5000');
            expect(localStorage.getItem('user-42-skipForwardLength')).toBe('10000');
            expect(getSkipLengths()).toEqual({ back: 5, forward: 10 });
        });
    });

    describe('getShowRemainingTime y setShowRemainingTime', () => {
        it('devuelve false por defecto', () => {
            expect(getShowRemainingTime()).toBe(false);
        });

        it('guarda el valor y emite evento', () => {
            const spy = vi.fn();
            window.addEventListener('jfp-playback-prefs', spy);

            setShowRemainingTime(true);
            expect(getShowRemainingTime()).toBe(true);
            expect(localStorage.getItem('jfp-video-remaining-time')).toBe('true');
            expect(spy).toHaveBeenCalledTimes(1);

            setShowRemainingTime(false);
            expect(getShowRemainingTime()).toBe(false);
            expect(localStorage.getItem('jfp-video-remaining-time')).toBe('false');
            expect(spy).toHaveBeenCalledTimes(2);

            window.removeEventListener('jfp-playback-prefs', spy);
        });

        it('asocia la preferencia al userId cuando hay sesión', () => {
            vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'u99' } as any);

            setShowRemainingTime(true);
            expect(localStorage.getItem('u99-jfp-video-remaining-time')).toBe('true');
            expect(getShowRemainingTime()).toBe(true);
        });
    });
});
