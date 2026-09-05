// Pruebas unitarias de SeasonsHeading: estado inicial minimalista, despliegue y
// alternancia al pulsar sobre el texto (sin caja ni temporizador).

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { SeasonsHeading } from '../SeasonsHeading';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

function renderComponent(props: { seasonCount: number; episodeCount: number; marginBottom?: number }) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root?.render(
            <SeasonsHeading
                seasonCount={props.seasonCount}
                episodeCount={props.episodeCount}
                marginBottom={props.marginBottom ?? 32}
            />
        );
    });
}

describe('SeasonsHeading', () => {
    afterEach(() => {
        act(() => {
            root?.unmount();
        });
        host?.remove();
        root = null;
        host = null;
    });

    it('muestra «1 season» / «1 temporada» en singular cuando solo hay una temporada', () => {
        renderComponent({ seasonCount: 1, episodeCount: 12 });
        const button = host?.querySelector('button');
        expect(button?.textContent).toMatch(/1 (season|temporada)/i);
        expect(button?.getAttribute('aria-expanded')).toBe('false');
        const episodeContainer = button?.querySelector('[aria-hidden]');
        expect(episodeContainer?.getAttribute('aria-hidden')).toBe('true');
    });

    it('muestra «X seasons» / «X temporadas» en plural cuando hay más de una temporada', () => {
        renderComponent({ seasonCount: 3, episodeCount: 36 });
        const button = host?.querySelector('button');
        expect(button?.textContent).toMatch(/3 (seasons|temporadas)/i);
    });

    it('despliega los episodios de forma minimalista al pulsar encima del texto', () => {
        renderComponent({ seasonCount: 1, episodeCount: 12 });
        const button = host?.querySelector('button');
        expect(button?.getAttribute('aria-expanded')).toBe('false');

        // Al hacer clic, se abre
        act(() => {
            button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(button?.getAttribute('aria-expanded')).toBe('true');
        const episodeContainer = button?.querySelector('[aria-hidden]');
        expect(episodeContainer?.getAttribute('aria-hidden')).toBe('false');
        expect(episodeContainer?.textContent).toMatch(/12 (episodes|episodios)/i);
    });

    it('vuelve al estado anterior al pulsar de nuevo', () => {
        renderComponent({ seasonCount: 2, episodeCount: 20 });
        const button = host?.querySelector('button');

        // Clic 1: abre
        act(() => {
            button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        expect(button?.getAttribute('aria-expanded')).toBe('true');

        // Clic 2: cierra
        act(() => {
            button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        expect(button?.getAttribute('aria-expanded')).toBe('false');
        const episodeContainer = button?.querySelector('[aria-hidden]');
        expect(episodeContainer?.getAttribute('aria-hidden')).toBe('true');
    });

    it('soporta «1 episodio» en singular correctamente', () => {
        renderComponent({ seasonCount: 1, episodeCount: 1 });
        const button = host?.querySelector('button');

        act(() => {
            button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        const episodeContainer = button?.querySelector('[aria-hidden]');
        expect(episodeContainer?.textContent).toMatch(/1 episode|1 episodio/i);
    });
});
