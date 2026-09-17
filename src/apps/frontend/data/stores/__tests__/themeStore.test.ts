import { describe, it, expect, beforeEach } from 'vitest';
import { THEME_STORE, isThemeMode, isSeedColor, ThemePrefs } from '../themeStore';

describe('THEME_STORE', () => {
    beforeEach(() => {
        THEME_STORE._reset();
    });

    describe('Validators', () => {
        it('validates theme modes', () => {
            expect(isThemeMode('dark')).toBe(true);
            expect(isThemeMode('light')).toBe(true);
            expect(isThemeMode('system')).toBe(true);
            expect(isThemeMode('other')).toBe(false);
        });

        it('validates seed colors', () => {
            expect(isSeedColor('#ff0000')).toBe(true);
            expect(isSeedColor('#FF0000')).toBe(true);
            expect(isSeedColor('#000000')).toBe(true);
            expect(isSeedColor('ff0000')).toBe(false); // missing hash
            expect(isSeedColor('#ff000')).toBe(false); // too short
            expect(isSeedColor('#ff00000')).toBe(false); // too long
            expect(isSeedColor(null)).toBe(false);
        });
    });

    describe('Store operations', () => {
        it('loads default values if empty', () => {
            const prefs = THEME_STORE.load();
            expect(prefs).toEqual({
                mode: 'dark',
                seed: null,
                seedSource: 'auto'
            });
        });

        it('saves and loads preferences', () => {
            const newPrefs: ThemePrefs = {
                mode: 'light',
                seed: '#aabbcc',
                seedSource: 'manual'
            };
            THEME_STORE.save(newPrefs);

            const loaded = THEME_STORE.load();
            expect(loaded).toEqual(newPrefs);
        });

        it('falls back to defaults for invalid stored properties', () => {
            localStorage.setItem('jfp-theme', JSON.stringify({
                mode: 'invalid_mode',
                seed: 'not_a_color',
                seedSource: 'auto'
            }));

            const loaded = THEME_STORE.load();
            expect(loaded).toEqual({
                mode: 'dark', // fallback
                seed: null, // fallback
                seedSource: 'auto'
            });
        });

        it('lowercases seed colors when loaded from raw storage', () => {
            localStorage.setItem('jfp-theme', JSON.stringify({
                mode: 'light',
                seed: '#AABBCC',
                seedSource: 'manual'
            }));

            const loaded = THEME_STORE.load();
            expect(loaded.seed).toBe('#aabbcc');
        });
    });
});
