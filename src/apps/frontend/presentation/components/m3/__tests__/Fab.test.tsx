import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Fab } from '../Fab';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

function render(ui: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => { root?.render(ui); });
}

describe('Fab', () => {
    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
    });

    it('renderiza el botón con aria-label e invoca onClick', () => {
        const onClick = vi.fn();
        render(<Fab icon={<span>+</span>} ariaLabel='Añadir' onClick={onClick} />);
        const btn = host?.querySelector('button');
        expect(btn?.getAttribute('aria-label')).toBe('Añadir');
        act(() => { btn?.click(); });
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('muestra la etiqueta en modo extendido', () => {
        render(<Fab icon={<span>+</span>} label='Reproducir' ariaLabel='Reproducir' onClick={() => undefined} />);
        expect(host?.textContent).toContain('Reproducir');
    });
});
