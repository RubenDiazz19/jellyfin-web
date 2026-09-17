import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '../ErrorBoundary';
import { logger } from '../../../../domain/logger';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../../../domain/logger', () => ({
    logger: {
        error: vi.fn()
    }
}));

describe('ErrorBoundary', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        vi.clearAllMocks();
    });

    it('renderiza a los hijos cuando no hay error', () => {
        const root = createRoot(container);
        act(() => {
            root.render(
                <ErrorBoundary>
                    <div id='child'>Contenido seguro</div>
                </ErrorBoundary>
            );
        });

        expect(container.querySelector('#child')?.textContent).toBe('Contenido seguro');
        root.unmount();
    });

    it('captura el error y renderiza la interfaz de fallback', () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        function FailingComponent(): React.ReactNode {
            throw new Error('Fallo crítico simulado');
        }

        const root = createRoot(container);
        act(() => {
            root.render(
                <ErrorBoundary>
                    <FailingComponent />
                </ErrorBoundary>
            );
        });

        expect(logger.error).toHaveBeenCalledWith(
            '[ErrorBoundary]',
            expect.any(Error),
            expect.any(String)
        );
        expect(container.textContent).toContain('Fallo crítico simulado');

        consoleErrorSpy.mockRestore();
        root.unmount();
    });

    it('gestiona la acción de volver al inicio reseteando el error', () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        let shouldFail = true;
        function MaybeFailingComponent() {
            if (shouldFail) {
                throw new Error('Fallo temporal');
            }
            return <div id='recovered'>Recuperado</div>;
        }

        const root = createRoot(container);
        act(() => {
            root.render(
                <ErrorBoundary>
                    <MaybeFailingComponent />
                </ErrorBoundary>
            );
        });

        expect(container.textContent).toContain('Fallo temporal');

        // Simulamos que el error se soluciona antes de pulsar volver al inicio
        shouldFail = false;
        const buttons = container.querySelectorAll('button');
        const backButton = buttons[1]; // Segundo botón: volver al inicio

        act(() => {
            backButton?.click();
        });

        expect(window.location.hash).toBe('#/');
        consoleErrorSpy.mockRestore();
        root.unmount();
    });
});
