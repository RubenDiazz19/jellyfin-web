// Pruebas del selector de géneros: renderizado de píldoras, descarte con ×,
// sugerencias interactivas con +, buscador con lupa animada, traducción a español y añadido por teclado.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { GenreEditor } from '../GenreEditor';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

async function render(ui: React.ReactElement) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root?.render(ui); });
}

afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    root = null;
    host = null;
});

describe('GenreEditor', () => {
    test('renderiza las píldoras de los géneros asignados con su botón de eliminar', async () => {
        const onChange = vi.fn();
        await render(<GenreEditor label='Géneros' genres={['Aventura', 'Fantasía']} onChange={onChange} />);

        expect(host?.textContent).toContain('Aventura');
        expect(host?.textContent).toContain('Fantasía');
        expect(host?.textContent).toContain('Géneros');

        const buttons = host?.querySelectorAll('button');
        // Debe haber botones de borrado para cada género
        const deleteButtons = Array.from(buttons ?? []).filter((b) => b.textContent === '×');
        expect(deleteButtons).toHaveLength(2);

        // Al pulsar '×' en Fantasía, onChange se llama con solo ['Aventura']
        await act(async () => {
            deleteButtons[1].click();
        });
        expect(onChange).toHaveBeenCalledWith(['Aventura']);
    });

    test('traduce géneros al castellano y descompone Acción y Aventura en individuales', async () => {
        const onChange = vi.fn();
        await render(
            <GenreEditor
                genres={['Action & Adventure', 'Sci-Fi & Fantasy', 'Drama']}
                onChange={onChange}
            />
        );

        // No deben verse los términos en inglés
        expect(host?.textContent).not.toContain('Action & Adventure');
        expect(host?.textContent).not.toContain('Sci-Fi & Fantasy');

        // Tampoco deben aparecer las opciones compuestas
        expect(host?.textContent).not.toContain('Acción y Aventura');
        expect(host?.textContent).not.toContain('Ciencia ficción y Fantasía');

        // Deben verse como píldoras individuales
        expect(host?.textContent).toContain('Acción');
        expect(host?.textContent).toContain('Aventura');
        expect(host?.textContent).toContain('Ciencia ficción');
        expect(host?.textContent).toContain('Fantasía');
        expect(host?.textContent).toContain('Drama');
    });

    test('las sugerencias muestran géneros disponibles con prefijo + y los añade al pulsar', async () => {
        const onChange = vi.fn();
        await render(<GenreEditor genres={['Acción']} onChange={onChange} />);

        // 'Acción' ya está asignada, por lo que no debe salir en las sugerencias con +
        const buttons = host?.querySelectorAll('button');
        const addAccion = Array.from(buttons ?? []).find((b) => b.textContent?.trim() === '+ Acción');
        expect(addAccion).toBeUndefined();

        // Debe haber sugerencias disponibles como '+ Aventura' o '+ Comedia'
        const addAventura = Array.from(buttons ?? []).find((b) => b.textContent?.trim() === '+ Aventura');
        expect(addAventura).toBeDefined();

        await act(async () => {
            addAventura?.click();
        });
        expect(onChange).toHaveBeenCalledWith(['Acción', 'Aventura']);
    });

    test('el buscador con lupa filtra las sugerencias en tiempo real', async () => {
        const onChange = vi.fn();
        await render(<GenreEditor genres={[]} onChange={onChange} />);

        const input = host?.querySelector('input');
        expect(input).toBeDefined();

        // Tecleamos 'mister'
        await act(async () => {
            if (input) {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    'value'
                )?.set;
                nativeInputValueSetter?.call(input, 'mister');
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        // La sugerencia '+ Misterio' debe estar visible
        const buttons = host?.querySelectorAll('button');
        const misterio = Array.from(buttons ?? []).find((b) => b.textContent?.includes('Misterio'));
        expect(misterio).toBeDefined();
    });

    test('pulsar Enter en el buscador añade el género tecleado', async () => {
        const onChange = vi.fn();
        await render(<GenreEditor genres={['Drama']} onChange={onChange} />);

        const input = host?.querySelector('input');
        expect(input).toBeDefined();

        await act(async () => {
            if (input) {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    'value'
                )?.set;
                nativeInputValueSetter?.call(input, 'Terror');
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        await act(async () => {
            input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        });

        expect(onChange).toHaveBeenCalledWith(['Drama', 'Terror']);
    });
});
