// El título de una fila lleva a su listado completo. En táctil es la única
// entrada a Series y Películas: la barra de arriba no tiene enlaces y la
// píldora de abajo lleva a Inicio, Buscar y Listas.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Row } from '../Row';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// useResponsive cuelga del provider del tema, cuyo sync remoto arrastra la
// cadena legacy (jellyfin-apiclient, playbackmanager) con efectos de módulo.
vi.mock('../../../../data/api/theme', () => ({
    getServerThemePrefs: () => Promise.resolve(null),
    saveServerThemePrefs: () => Promise.resolve()
}));

let root: Root | null = null;
let host: HTMLElement | null = null;

function render(onTitleClick?: () => void) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root?.render(
            <Row title='Series' onTitleClick={onTitleClick}>
                <div>contenido</div>
            </Row>
        );
    });
}

describe('Row', () => {
    beforeEach(() => {
        document.documentElement.className = 'layout-mobile';
    });

    afterEach(() => {
        act(() => { root?.unmount(); });
        host?.remove();
        root = null;
        host = null;
        document.documentElement.className = '';
    });

    it('sin destino el título es texto, no un botón', () => {
        render();
        expect(host?.querySelector('h3')?.textContent).toBe('Series');
        expect(host?.querySelector('button')).toBeNull();
    });

    it('con destino, pulsar el título navega', () => {
        const go = vi.fn();
        render(go);

        const btn = host?.querySelector('button');
        expect(btn).not.toBeNull();
        act(() => { (btn as HTMLElement).click(); });
        expect(go).toHaveBeenCalledTimes(1);
    });

    it('el título pulsable lleva un chevron que lo avisa', () => {
        // Sin marca ninguna, un título que navega no lo prueba nadie.
        render(() => undefined);
        expect(host?.querySelector('button')?.textContent).toContain('›');
    });
});
