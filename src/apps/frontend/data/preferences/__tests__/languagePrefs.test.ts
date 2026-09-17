import { describe, it, expect, beforeEach } from 'vitest';
import { getTitleLanguagePref, setTitleLanguagePref, countTitleLanguagePrefs, clearAllTitleLanguagePrefs, clearTitleLanguagePref } from '../languagePrefs';

describe('languagePrefs', () => {
    const USER_ID = 'test-user-123';

    beforeEach(() => {
        localStorage.clear();
    });

    it('returns null if no preference is set', () => {
        expect(getTitleLanguagePref(USER_ID, 'title-1')).toBeNull();
    });

    it('sets and retrieves title language preference', () => {
        setTitleLanguagePref(USER_ID, 'title-1', { audio: 'spa' });

        const pref = getTitleLanguagePref(USER_ID, 'title-1');
        expect(pref).toEqual({ audio: 'spa' });
    });

    it('merges partial updates without overwriting other properties', () => {
        setTitleLanguagePref(USER_ID, 'title-1', { audio: 'spa' });
        setTitleLanguagePref(USER_ID, 'title-1', { subtitle: 'eng' });

        const pref = getTitleLanguagePref(USER_ID, 'title-1');
        expect(pref).toEqual({ audio: 'spa', subtitle: 'eng' });
    });

    it('counts preferences correctly', () => {
        setTitleLanguagePref(USER_ID, 'title-1', { audio: 'spa' });
        setTitleLanguagePref(USER_ID, 'title-2', { audio: 'eng' });

        expect(countTitleLanguagePrefs(USER_ID)).toBe(2);
    });

    it('clears specific title preference', () => {
        setTitleLanguagePref(USER_ID, 'title-1', { audio: 'spa' });
        setTitleLanguagePref(USER_ID, 'title-2', { audio: 'eng' });

        clearTitleLanguagePref(USER_ID, 'title-1');

        expect(getTitleLanguagePref(USER_ID, 'title-1')).toBeNull();
        expect(getTitleLanguagePref(USER_ID, 'title-2')).toEqual({ audio: 'eng' });
    });

    it('clears all preferences for a user', () => {
        setTitleLanguagePref(USER_ID, 'title-1', { audio: 'spa' });
        setTitleLanguagePref(USER_ID, 'title-2', { audio: 'eng' });

        clearAllTitleLanguagePrefs(USER_ID);

        expect(countTitleLanguagePrefs(USER_ID)).toBe(0);
    });
});
