import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import globalize from 'lib/globalize';
import { TagsTab } from '../TagsTab';

const mockGetItemRaw = vi.fn();
const mockSetItemTags = vi.fn();

vi.mock('../../../../../domain/api', () => ({
    getItemRaw: (id: string) => mockGetItemRaw(id),
    setItemTags: (id: string, tags: string[]) => mockSetItemTags(id, tags)
}));

vi.mock('../../../toast/ToastProvider', () => ({
    useToast: () => vi.fn()
}));

vi.mock('../../../../../domain/tags', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../../domain/tags')>();
    return {
        ...actual,
        autoTagsFor: vi.fn((id: string | undefined) => {
            if (id === 'item-1') return ['Venganza', 'Época histórica'];
            return [];
        })
    };
});

let root: Root | null = null;
let host: HTMLElement | null = null;

async function render(props: { itemId: string; onClose?: () => void }) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
        root?.render(<TagsTab {...props} />);
    });
}

afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    root = null;
    host = null;
    vi.clearAllMocks();
});

describe('TagsTab', () => {
    beforeEach(() => {
        mockGetItemRaw.mockResolvedValue({
            Id: 'item-1',
            Tags: ['Melancólica']
        });
        mockSetItemTags.mockResolvedValue(undefined);
    });

    test('combina etiquetas del servidor con autoTags', async () => {
        await render({ itemId: 'item-1' });

        expect(host?.textContent).toContain('Melancólica');
        expect(host?.textContent).toContain('Venganza');
        expect(host?.textContent).toContain('Época histórica');
    });

    test('permite guardar etiquetas modificadas', async () => {
        const onClose = vi.fn();
        await render({ itemId: 'item-1', onClose });

        const deleteDramaBtn = host?.querySelector('button[aria-label="Delete Melancólica"]') as HTMLButtonElement;
        expect(deleteDramaBtn).not.toBeNull();
        await act(async () => {
            deleteDramaBtn.click();
        });

        expect(host?.querySelector('button[aria-label="Delete Melancólica"]')).toBeNull();

        const saveBtn = Array.from(host?.querySelectorAll('button') ?? []).find(
            (b) => b.textContent?.trim() === globalize.translate('Save')
        );
        expect(saveBtn).toBeDefined();

        await act(async () => {
            saveBtn?.click();
        });

        expect(mockSetItemTags).toHaveBeenCalledWith('item-1', ['Época histórica', 'Venganza']);
        expect(onClose).toHaveBeenCalled();
    });
});
