import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TitlePreferences } from '../titlePreferences';
import * as languagePrefsModule from '../../../data/preferences/languagePrefs';

vi.mock('../../../data/preferences/languagePrefs');

describe('TitlePreferences', () => {
    let prefs: TitlePreferences;
    const userId = 'user-1';

    beforeEach(() => {
        vi.clearAllMocks();
        prefs = new TitlePreferences(() => userId);
    });

    it('resets state for a new item', () => {
        prefs.isSeries.value = true;
        prefs.pref.value = { audio: 'spa' };

        prefs.reset('item-123');

        expect(prefs.isSeries.value).toBe(false);
        expect(prefs.pref.value).toBeNull();
    });

    it('adopts playback context and loads saved preferences', () => {
        vi.mocked(languagePrefsModule.getTitleLanguagePref).mockReturnValue({ audio: 'eng' });

        prefs.adopt({ titleId: 'series-1', isEpisode: true } as any);

        expect(prefs.isSeries.value).toBe(true);
        expect(prefs.pref.value).toEqual({ audio: 'eng' });
        expect(languagePrefsModule.getTitleLanguagePref).toHaveBeenCalledWith(userId, 'series-1');
    });

    it('hasAny checks if any preferences exist for the user', () => {
        vi.mocked(languagePrefsModule.countTitleLanguagePrefs).mockReturnValue(1);
        expect(prefs.hasAny()).toBe(true);

        vi.mocked(languagePrefsModule.countTitleLanguagePrefs).mockReturnValue(0);
        expect(prefs.hasAny()).toBe(false);
    });

    it('remembers a language preference and reloads it', () => {
        prefs.adopt({ titleId: 'series-1', isEpisode: true } as any);
        vi.mocked(languagePrefsModule.getTitleLanguagePref).mockReturnValue({ audio: 'fre' });

        prefs.remember({ audio: 'fre' });

        expect(languagePrefsModule.setTitleLanguagePref).toHaveBeenCalledWith(userId, 'series-1', { audio: 'fre' });
        expect(prefs.pref.value).toEqual({ audio: 'fre' });
    });

    it('clears language preferences', () => {
        prefs.adopt({ titleId: 'series-1', isEpisode: true } as any);

        prefs.clear();

        expect(languagePrefsModule.clearTitleLanguagePref).toHaveBeenCalledWith(userId, 'series-1');
        expect(prefs.pref.value).toBeNull();
    });
});
