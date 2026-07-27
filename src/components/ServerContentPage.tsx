import { AUTHORIZATION_HEADER } from '@jellyfin/sdk/lib/constants';
import { getAuthorizationHeader } from '@jellyfin/sdk/lib/utils';
import { FunctionComponent, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import viewManager from './viewManager/viewManager';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import type { RestoreViewFailResponse } from 'types/viewManager';

interface ServerContentPageProps {
    view: string
}

/**
 * Page component that renders html content from a server request.
 * Uses the ViewManager to dynamically load and execute the page JS.
 */
const ServerContentPage: FunctionComponent<ServerContentPageProps> = ({ view }) => {
    const location = useLocation();

    useEffect(() => {
        const loadPage = () => {
            const viewOptions = {
                url: location.pathname + location.search,
                state: location.state,
                autoFocus: false,
                options: {
                    supportsThemeMedia: false,
                    enableMediaControl: true
                }
            };

            viewManager.tryRestoreView(viewOptions)
                .catch(async (result?: RestoreViewFailResponse) => {
                    if (!result?.cancelled) {
                        const api = ServerConnections.getApi();
                        if (!api) return;

                        // Fetch the view html from the server and translate it.
                        // These are plugin configuration pages: the response is
                        // html, not json, so it goes through the axios instance
                        // directly instead of a generated endpoint.
                        const { data } = await api.axiosInstance.get<string>(
                            api.getUri(view + location.search),
                            {
                                responseType: 'text',
                                headers: {
                                    [AUTHORIZATION_HEADER]: getAuthorizationHeader(
                                        api.clientInfo,
                                        api.deviceInfo,
                                        api.accessToken
                                    )
                                }
                            }
                        );

                        viewManager.loadView({
                            ...viewOptions,
                            view: globalize.translateHtml(data)
                        });
                    }
                });
        };

        loadPage();
    },
    // location.state is NOT included as a dependency here since dialogs will update state while the current view stays the same
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
        view,
        location.pathname,
        location.search
    ]);

    return null;
};

export default ServerContentPage;
