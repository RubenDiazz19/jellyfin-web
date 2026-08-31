import { QueryCache, QueryClient, type Query } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { get, set, del } from 'idb-keyval';

// TODO: Move this file to lib/query

/** HTTP status code for unauthorized requests. */
const HTTP_UNAUTHORIZED = 401;
/** Maximum garbage collection time. Set to 24 hours for persistence. */
const MAX_GC_TIME = 24 * 60 * 60 * 1000;
/** Maximum stale time. Set to 1 minute for query reuse. */
const MAX_STALENESS = 60 * 1000;
/** Maximum number of retries for failed queries. */
const MAX_RETRIES = 2;

// NOTE: queryClient needs to be defined before the QueryCache so that it can be used in the onError callback.
// eslint-disable-next-line prefer-const
export let queryClient: QueryClient;

interface RequestError {
    status?: number;
    statusCode?: number;
    response?: {
        status?: number;
    };
}

function getErrorStatus(error: unknown): number | undefined {
    if (error && typeof error === 'object') {
        const reqErr = error as RequestError;
        return reqErr.response?.status ?? reqErr.status ?? reqErr.statusCode;
    }
    return undefined;
}

/** Query cache for handling query errors and side effects. */
const queryCache = new QueryCache({
    onError: (error, { queryKey }) => {
        if (!queryClient) return;

        const status = getErrorStatus(error);
        if (status === HTTP_UNAUTHORIZED) {
            try {
                // If a query fails due to authorization, cancel it and remove it from the cache to prevent showing
                // unauthorized data.
                void queryClient.cancelQueries({ queryKey });
                queryClient.setQueryData(queryKey, null);
            } catch (e) {
                console.warn('[QueryCache] failed to remove unauthorized data', e);
            }
        }
    }
});

queryClient = new QueryClient({
    queryCache,
    defaultOptions: {
        mutations: {
            networkMode: 'always' // network connection is not required if running on localhost
        },
        queries: {
            gcTime: MAX_GC_TIME,
            networkMode: 'always', // network connection is not required if running on localhost
            staleTime: MAX_STALENESS,
            retry: (failureCount, error) => {
                const status = getErrorStatus(error);
                // Don't retry if unauthorized
                if (status === HTTP_UNAUTHORIZED) return false;
                return failureCount < MAX_RETRIES;
            }
        }
    }
});

/**
 * How long a persisted cache stays usable after being written.
 *
 * Without it, `persistQueryClient` falls back to its own 24 h default, which
 * silently duplicates `MAX_GC_TIME`: stating it here keeps the two numbers
 * tied together instead of drifting apart.
 */
export const PERSIST_MAX_AGE = MAX_GC_TIME;

/**
 * What is worth writing to IndexedDB.
 *
 * The persister serialises the WHOLE cache on every change, so anything that
 * survives dehydration is paid for again and again. Errored and still-pending
 * queries are never worth restoring — a failure is not a cache — and neither
 * are the ones already stale beyond `PERSIST_MAX_AGE`, which would be thrown
 * away on the next restore anyway.
 */
export const shouldDehydrateQuery = (query: Query): boolean => {
    if (query.state.status !== 'success') return false;
    return Date.now() - query.state.dataUpdatedAt < PERSIST_MAX_AGE;
};

/** Create an IndexedDB persister for react-query-persist-client. Uses idb-keyval for simplicity. */
const createIDBPersister = (idbValidKey: IDBValidKey = 'query-cache') => ({
    persistClient: async (client: PersistedClient) => {
        await set(idbValidKey, client);
    },
    restoreClient: () => {
        return get<PersistedClient>(idbValidKey);
    },
    removeClient: async () => {
        await del(idbValidKey);
    }
} satisfies Persister);

export const persister = createIDBPersister('jellyfin-query-cache');
