import { describe, it, expect, vi } from 'vitest';
import globalize from 'lib/globalize';
import { buildMoreMenuItems } from '../moreMenuBuilder';
import type { MenuItem } from '../ItemMenuList';

function findByLabel(items: MenuItem[], label: string) {
    return items.find((i): i is Extract<MenuItem, { label: string }> => 'label' in i && i.label === label);
}

describe('moreMenuBuilder', () => {
    const mockToast = vi.fn();
    const defaultParams = {
        type: 'movie' as const,
        isReal: true,
        isSelected: false,
        canQueue: true,
        toast: mockToast,
        doPlay: vi.fn(),
        doPlayNextEpisode: vi.fn(),
        doQueue: vi.fn(),
        openNative: vi.fn(),
        doDownload: vi.fn(),
        doSelect: vi.fn(),
        setEditor: vi.fn(),
        setAddTo: vi.fn(),
        setRefreshOpen: vi.fn(),
        setTagsOpen: vi.fn(),
        setConfirmDelete: vi.fn()
    };

    it('construye las opciones para tipo movie con sesión real', () => {
        const items = buildMoreMenuItems(defaultParams);
        expect(items.length).toBeGreaterThan(0);

        // Debe contener opción de reproducir desde el principio
        const playItem = findByLabel(items, globalize.translate('PlayFromBeginning'));
        expect(playItem).toBeDefined();

        // Debe contener opciones de cola
        const queueNext = findByLabel(items, globalize.translate('PlayNextInQueue'));
        expect(queueNext).toBeDefined();

        // Debe contener opción de descarga
        const downloadItem = findByLabel(items, globalize.translate('Download'));
        expect(downloadItem).toBeDefined();

        // Debe contener opción de borrado
        const deleteItem = findByLabel(items, globalize.translate('Delete'));
        expect(deleteItem).toBeDefined();
        expect(deleteItem?.danger).toBe(true);
    });

    it('construye las opciones para tipo show con shuffle custom y continue', () => {
        const onShuffle = vi.fn();
        const items = buildMoreMenuItems({
            ...defaultParams,
            type: 'show',
            nextEpisodeId: 'ep1',
            onShuffle
        });

        const nextEp = findByLabel(items, globalize.translate('PlayNextEpisode'));
        expect(nextEp).toBeDefined();

        const shuffleLabel = globalize.translate('ShufflePlay') || globalize.translate('Shuffle');
        const shuffleItem = findByLabel(items, shuffleLabel);
        expect(shuffleItem).toBeDefined();
        shuffleItem?.fn?.();
        expect(onShuffle).toHaveBeenCalled();
    });

    it('incluye opción de selección si el item es selectable', () => {
        const doSelect = vi.fn();
        const items = buildMoreMenuItems({
            ...defaultParams,
            selectable: { id: 'm1', kind: 'movie', title: 'Test Movie' },
            isSelected: false,
            doSelect
        });

        const selectItem = findByLabel(items, globalize.translate('Select'));
        expect(selectItem).toBeDefined();
        selectItem?.fn?.();
        expect(doSelect).toHaveBeenCalled();
    });

    it('usa menú legacy si isReal es falso', () => {
        const items = buildMoreMenuItems({
            ...defaultParams,
            isReal: false
        });

        expect(items.some((i) => 'label' in i && i.label === globalize.translate('Download'))).toBe(true);
        expect(items.some((i) => 'label' in i && i.label === globalize.translate('PlayFromBeginning'))).toBe(false);
    });
});
