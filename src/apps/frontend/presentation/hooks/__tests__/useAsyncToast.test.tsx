import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAsyncToast } from '../useAsyncToast';
import { ToastProvider } from '../../components/toast/ToastProvider';

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

describe('useAsyncToast', () => {
    it('ejecuta la acción con éxito y expone toast y loading', async () => {
        let hookResult!: ReturnType<typeof useAsyncToast>;

        function TestComponent() {
            hookResult = useAsyncToast();
            return null;
        }

        await mount(
            <ToastProvider>
                <TestComponent />
            </ToastProvider>
        );

        const onSuccess = vi.fn();
        let output: string | undefined;
        await act(async () => {
            output = await hookResult.run(async () => 'ok', {
                successMessage: 'Operación completada',
                onSuccess
            });
        });

        expect(output).toBe('ok');
        expect(onSuccess).toHaveBeenCalledWith('ok');
        expect(hookResult.loading).toBe(false);
    });

    it('captura el error y llama a onError', async () => {
        const onError = vi.fn();
        let hookResult!: ReturnType<typeof useAsyncToast>;

        function TestComponent() {
            hookResult = useAsyncToast();
            return null;
        }

        await mount(
            <ToastProvider>
                <TestComponent />
            </ToastProvider>
        );

        let output: string | undefined;
        await act(async () => {
            output = await hookResult.run(async () => {
                throw new Error('Fallo de red');
            }, {
                onError
            });
        });

        expect(output).toBeUndefined();
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
        expect(hookResult.loading).toBe(false);
    });
});
