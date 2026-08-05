// El aviso de «hay más abajo» es de escritorio. En táctil iba en absoluto
// pegado al fondo del hero y se pintaba encima del botón de reproducir en
// cuanto la pantalla era corta (un móvil tumbado).

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MobileThemeProvider } from '../../../theme/MobileThemeProvider';
import { ScrollHint } from '../ScrollHint';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../data/api/theme', () => ({
    getServerThemePrefs: () => Promise.resolve(null),
    saveServerThemePrefs: () => Promise.resolve()
}));

let root: Root | null = null;
let host: HTMLElement | null = null;

function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root?.render(
            <MobileThemeProvider>
                <ScrollHint label='Episodios' />
            </MobileThemeProvider>
        );
    });
}

describe('ScrollHint', () => {
    beforeEach(() => {
        document.documentElement.className = '';
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        document.documentElement.className = '';
        document.getElementById('jfp-m3-tokens')?.remove();
    });

    it('desktop: se pinta', () => {
        document.documentElement.classList.add('layout-desktop');
        render();
        expect(host?.textContent).toContain('Episodios');
    });

    for (const layout of ['layout-mobile', 'layout-tablet']) {
        it(`${layout}: no se pinta`, () => {
            document.documentElement.classList.add('layout-mobile');
            if (layout === 'layout-tablet') document.documentElement.classList.add(layout);
            render();
            expect(host?.textContent).toBe('');
        });
    }
});
