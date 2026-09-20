import { useState, useCallback } from 'react';
import { useToast } from '../../presentation/components/toast/ToastProvider';

interface AsyncActionOpts {
    success?: string;
    onClose?: () => void;
}

export function useAsyncAction<Args extends unknown[], R>(action: (...args: Args) => Promise<R>, opts?: AsyncActionOpts) {
    const [busy, setBusy] = useState(false);
    const toast = useToast();

    const execute = useCallback(async (...args: Args) => {
        if (busy) return;
        setBusy(true);
        try {
            await action(...args);
            if (opts?.success) toast(opts.success, 'success');
            opts?.onClose?.();
        } catch (e) {
            toast((e as Error).message, 'warn');
        } finally {
            setBusy(false);
        }
    }, [action, opts, toast, busy]);

    return { execute, busy };
}
