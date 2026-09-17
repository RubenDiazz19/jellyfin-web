import { describe, it, expect, vi } from 'vitest';
import { getLocalePrefs, setLocalePrefs, getAvailableLocales } from '../preferences';
const mockCurrentSettings = {
    language: vi.fn(),
    dateTimeLocale: vi.fn()
};

vi.mock('scripts/settings/userSettings', () => ({
    currentSettings: mockCurrentSettings
}));
vi.mock('lib/globalize/locales', () => ({
    default: [{ lang: 'en' }, { lang: 'es' }]
}));

describe('preferences API', () => {
    it('getLocalePrefs gets current language and date locale', async () => {
        mockCurrentSettings.language.mockReturnValue('en-us');
        mockCurrentSettings.dateTimeLocale.mockReturnValue('en-GB');

        const prefs = await getLocalePrefs();
        expect(prefs.language).toBe('en-us');
        expect(prefs.dateTimeLocale).toBe('en-GB');
    });

    it('setLocalePrefs updates language and date locale', async () => {
        await setLocalePrefs({ language: 'es', dateTimeLocale: 'es-ES' });
        expect(mockCurrentSettings.language).toHaveBeenCalledWith('es');
        expect(mockCurrentSettings.dateTimeLocale).toHaveBeenCalledWith('es-ES');
    });

    it('getAvailableLocales returns list of languages', async () => {
        const list = await getAvailableLocales();
        expect(list).toEqual(['en', 'es']);
    });
});
