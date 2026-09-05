import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ShowMetadataRows } from '../ShowMetadataRows';
import { DetailTable } from '../DetailSections';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

function mount(ui: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    return act(async () => {
        root?.render(ui);
    });
}

afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    root = null;
    host = null;
});

describe('ShowMetadataRows', () => {
    it('renderiza las filas presentes en el show', async () => {
        const mockShow = {
            creator: 'Vince Gilligan',
            directors: 'Vince Gilligan, Michelle MacLaren',
            studio: 'AMC',
            country: 'EE. UU.'
        };

        await mount(
            <DetailTable>
                <ShowMetadataRows show={mockShow} />
            </DetailTable>
        );

        expect(host?.textContent).toContain('Vince Gilligan');
        expect(host?.textContent).toContain('AMC');
        expect(host?.textContent).toContain('EE. UU.');
    });

    it('no renderiza filas de campos ausentes', async () => {
        const mockShow = {
            creator: undefined,
            directors: undefined,
            studio: 'HBO',
            country: undefined
        };

        await mount(
            <DetailTable>
                <ShowMetadataRows show={mockShow} />
            </DetailTable>
        );

        expect(host?.textContent).toContain('HBO');
        expect(host?.textContent).not.toContain('Vince Gilligan');
    });
});
