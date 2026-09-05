import { useCallback, useState } from 'react';
import { useToast } from '../components/toast/ToastProvider';

export type AsyncToastOptions<T> = {
    successMessage?: string | ((result: T) => string);
    errorMessage?: string | ((error: Error) => string);
    onSuccess?: (result: T) => void;
    onError?: (error: Error) => void;
};

/**
 * Hook para acciones asíncronas con feedback en Toast y estado de carga (`loading`).
 *
 * Encapsula el ciclo try/catch/finally repetido en formularios, diálogos y botones de acción:
 * muestra notificación de éxito o aviso de error según corresponda.
 */
export function useAsyncToast() {
    const toast = useToast();
    const [loading, setLoading] = useState(false);

    const run = useCallback(async <T>(
        action: () => Promise<T>,
        options?: AsyncToastOptions<T>
    ): Promise<T | undefined> => {
        setLoading(true);
        try {
            const result = await action();
            if (options?.successMessage) {
                const msg = typeof options.successMessage === 'function' ?
                    options.successMessage(result) :
                    options.successMessage;
                toast(msg, 'success');
            }
            options?.onSuccess?.(result);
            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            const msg = options?.errorMessage ?
                (typeof options.errorMessage === 'function' ? options.errorMessage(error) : options.errorMessage) :
                error.message;
            toast(msg, 'warn');
            options?.onError?.(error);
            return undefined;
        } finally {
            setLoading(false);
        }
    }, [toast]);

    return { run, loading, toast };
}
