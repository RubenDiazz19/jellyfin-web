import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import QueryClientEventHandler from 'components/QueryClientEventHandler';
import { ApiProvider } from 'hooks/useApi';
import { UserSettingsProvider } from 'hooks/useUserSettings';
import { WebConfigProvider } from 'hooks/useWebConfig';
import browser from 'scripts/browser';
import { persister, queryClient, PERSIST_MAX_AGE, shouldDehydrateQuery } from 'utils/query/queryClient';

import RootAppRouter from 'RootAppRouter';

const useReactQueryDevtools = process.env.NODE_ENV !== 'production'
    && window.Proxy // '@tanstack/query-devtools' requires 'Proxy', which cannot be polyfilled for legacy browsers
    && !browser.tv; // Don't use devtools on the TV as the navigation is weird

const RootApp = () => (
    <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
            buster: __JF_BUILD_VERSION__,
            persister,
            maxAge: PERSIST_MAX_AGE,
            dehydrateOptions: { shouldDehydrateQuery }
        }}
    >
        <ApiProvider>
            <UserSettingsProvider>
                <WebConfigProvider>
                    <QueryClientEventHandler />
                    <RootAppRouter />
                </WebConfigProvider>
            </UserSettingsProvider>
        </ApiProvider>
        {useReactQueryDevtools && (
            <ReactQueryDevtools initialIsOpen={false} />
        )}
    </PersistQueryClientProvider>
);

export default RootApp;
