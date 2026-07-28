import type { Api } from '@jellyfin/sdk';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client';
import type { Event } from 'jellyfin-apiclient';
import { type FC, type PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';

import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';

import { ServerConnections } from 'lib/jellyfin-apiclient';
import events from 'utils/events';

export interface JellyfinApiContext {
    api?: Api
    user?: UserDto
}

export const ApiContext = createContext<JellyfinApiContext>({});
export const useApi = () => useContext(ApiContext);

export const ApiProvider: FC<PropsWithChildren<unknown>> = ({ children }) => {
    const [ serverId, setServerId ] = useState<string>();
    const [ api, setApi ] = useState<Api>();
    const [ user, setUser ] = useState<UserDto>();

    const context = useMemo(() => ({
        api,
        user
    }), [ api, user ]);

    useEffect(() => {
        const updateApiUser = (_e: Event | undefined, newUser: UserDto) => {
            setUser(newUser);

            if (newUser.ServerId) {
                setServerId(newUser.ServerId);
            }
        };

        const currentApi = ServerConnections.getApi();
        if (currentApi) {
            getUserApi(currentApi)
                .getCurrentUser()
                .then(({ data: newUser }) => updateApiUser(undefined, newUser))
                .catch(err => {
                    console.info('[ApiProvider] Could not get current user', err);
                });
        }

        const resetApiUser = () => {
            setServerId(undefined);
            setUser(undefined);
        };

        events.on(ServerConnections, 'localusersignedin', updateApiUser);
        events.on(ServerConnections, 'localusersignedout', resetApiUser);

        return () => {
            events.off(ServerConnections, 'localusersignedin', updateApiUser);
            events.off(ServerConnections, 'localusersignedout', resetApiUser);
        };
    }, [ setServerId, setUser ]);

    useEffect(() => {
        setApi(serverId ? ServerConnections.getApi(serverId) : undefined);
    }, [ serverId, setApi ]);

    return (
        <ApiContext.Provider value={context}>
            {children}
        </ApiContext.Provider>
    );
};
