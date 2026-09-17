import { describe, it, expect, beforeEach } from 'vitest';
import { COLLECTION_STYLES } from '../collectionStylesStore';

describe('COLLECTION_STYLES', () => {
    beforeEach(() => {
        COLLECTION_STYLES._reset();
    });

    it('returns empty object for unknown collection by default', () => {
        expect(COLLECTION_STYLES.get('123')).toEqual({});
    });

    it('saves and returns a background color', () => {
        COLLECTION_STYLES.setColor('123', '#FF0000');
        expect(COLLECTION_STYLES.getColor('123')).toBe('#FF0000');
        expect(COLLECTION_STYLES.get('123').backgroundColor).toBe('#FF0000');
    });

    it('clears color when setting to undefined or empty string', () => {
        COLLECTION_STYLES.setColor('123', '#FF0000');
        COLLECTION_STYLES.setColor('123', '   ');
        expect(COLLECTION_STYLES.getColor('123')).toBeUndefined();
    });

    it('saves and returns backdrop and logo', () => {
        COLLECTION_STYLES.setBackdrop('123', 'http://backdrop.jpg');
        COLLECTION_STYLES.setLogo('123', 'http://logo.png');

        expect(COLLECTION_STYLES.getBackdrop('123')).toBe('http://backdrop.jpg');
        expect(COLLECTION_STYLES.getLogo('123')).toBe('http://logo.png');
    });

    it('prioritizes previews over saved settings', () => {
        COLLECTION_STYLES.setBackdrop('123', 'http://saved-backdrop.jpg');
        COLLECTION_STYLES.setPreview('123', 'Backdrop', 'blob://preview-backdrop');

        expect(COLLECTION_STYLES.getBackdrop('123')).toBe('blob://preview-backdrop');

        COLLECTION_STYLES.clearPreview('123', 'Backdrop');
        expect(COLLECTION_STYLES.getBackdrop('123')).toBe('http://saved-backdrop.jpg');
    });

    it('manages custom item order', () => {
        COLLECTION_STYLES.setOrder('123', ['item1', 'item2']);
        expect(COLLECTION_STYLES.getOrder('123')).toEqual(['item1', 'item2']);
    });

    it('clears all styles for a collection', () => {
        COLLECTION_STYLES.setColor('123', '#FF0000');
        COLLECTION_STYLES.setPreview('123', 'Logo', 'blob:logo');

        COLLECTION_STYLES.clear('123');

        expect(COLLECTION_STYLES.getColor('123')).toBeUndefined();
        expect(COLLECTION_STYLES.getLogo('123')).toBeUndefined();
    });

    it('increments version when touched', () => {
        const initialVersion = COLLECTION_STYLES.getVersion('123');
        expect(initialVersion).toBe(0);

        COLLECTION_STYLES.touch('123');
        expect(COLLECTION_STYLES.getVersion('123')).toBeGreaterThan(0);
    });
});
