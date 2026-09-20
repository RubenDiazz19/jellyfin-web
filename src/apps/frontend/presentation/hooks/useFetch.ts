import { useEffect, useState } from 'react';

type FetchState<T> = {
    data: T | null;
    error: Error | null;
    loading: boolean;
};

export function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
    const [state, setState] = useState<FetchState<T>>({
        data: null,
        error: null,
        loading: true
    });

    useEffect(() => {
        let alive = true;
        setState((s) => ({ ...s, loading: true, error: null }));

        fetcher()
            .then((data) => {
                if (alive) {
                    setState({ data, error: null, loading: false });
                }
            })
            .catch((err: unknown) => {
                if (alive) {
                    setState({ data: null, error: err instanceof Error ? err : new Error(String(err)), loading: false });
                }
            });

        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    const mutate = (data: T | null) => {
        setState((s) => ({ ...s, data }));
    };

    return { ...state, mutate };
}
