import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import globalize from 'lib/globalize';
import { TagsDialog } from '../TagsDialog';

const mockGetItemRaw = vi.fn();
const mockSetItemTags = vi.fn();

vi.mock('../../../../domain/api', () => ({
    getItemRaw: (id: string) => mockGetItemRaw(id),
    setItemTags: (id: string, tags: string[]) => mockSetItemTags(id, tags)
}));

vi.mock('../../toast/ToastProvider', () => ({
    useToast: () => vi.fn()
}));

vi.mock('../../../../domain/tags', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../domain/tags')>();
    return {
        ...actual,
        autoTagsFor: vi.fn((id: string | undefined) => {
            if (id === 'shogun-id') return ['Bélico', 'Época histórica'];
            return [];
        })
    };
});

let root: Root | null = null;
let host: HTMLElement | null = null;

async function render(props: { itemId: string; itemTitle?: string; onClose: () => void }) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
        root?.render(<TagsDialog {...props} />);
    });
}

function dialog(): HTMLElement {
    const el = document.querySelector('[role="dialog"]');
    if (!el) throw new Error('no se ha pintado el diálogo');
    return el as HTMLElement;
}

afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    root = null;
    host = null;
    vi.clearAllMocks();
});

describe('TagsDialog', () => {
    beforeEach(() => {
        mockGetItemRaw.mockResolvedValue({
            Id: 'shogun-id',
            Tags: []
        });
        mockSetItemTags.mockResolvedValue(undefined);
    });

    test('carga las autoTags aunque el servidor tenga Tags vacío', async () => {
        const onClose = vi.fn();
        await render({ itemId: 'shogun-id', itemTitle: 'Shōgun', onClose });

        const d = dialog();
        expect(d.textContent).toContain('Bélico');
        expect(d.textContent).toContain('Época histórica');
    });

    test('combina serverTags válidos y autoTags deduplicando', async () => {
        mockGetItemRaw.mockResolvedValue({
            Id: 'shogun-id',
            Tags: ['bélico', 'Drama', 'aftercreditsstinger'] // aftercreditsstinger se descarta
        });

        const onClose = vi.fn();
        await render({ itemId: 'shogun-id', itemTitle: 'Shōgun', onClose });

        const d = dialog();
        expect(d.textContent).toContain('Bélico');
        expect(d.textContent).toContain('Época histórica');
        expect(d.textContent).toContain('Drama');
        expect(d.textContent).not.toContain('aftercreditsstinger');
    });

    test('muestra placeholder traducido de LabelSearchTags', async () => {
        const onClose = vi.fn();
        await render({ itemId: 'shogun-id', itemTitle: 'Shōgun', onClose });

        const input = dialog().querySelector('input');
        expect(input).not.toBeNull();
        expect(input?.placeholder).toBe(globalize.translate('LabelSearchTags'));
        expect(input?.placeholder).not.toBe('LabelSearchTags');
    });

    test('permite quitar una etiqueta y guardar', async () => {
        const onClose = vi.fn();
        await render({ itemId: 'shogun-id', itemTitle: 'Shōgun', onClose });

        // Quitar Bélico
        const deleteBelicoBtn = dialog().querySelector('button[aria-label="Delete Bélico"]') as HTMLButtonElement;
        expect(deleteBelicoBtn).not.toBeNull();
        await act(async () => {
            deleteBelicoBtn.click();
        });

        expect(dialog().textContent).not.toContain('Bélico');
        expect(dialog().textContent).toContain('Época histórica');

        // Guardar
        const saveBtn = [...dialog().querySelectorAll('button')].find(
            (b) => b.textContent?.trim() === globalize.translate('Save')
        );
        expect(saveBtn).not.toBeNull();
        await act(async () => {
            saveBtn?.click();
        });

        expect(mockSetItemTags).toHaveBeenCalledWith('shogun-id', ['Época histórica']);
        expect(onClose).toHaveBeenCalled();
    });
});
