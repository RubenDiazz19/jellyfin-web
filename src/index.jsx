import { createRoot } from 'react-dom/client';

// NOTE: We need to import this first to initialize the connection
import { ServerConnections } from 'lib/jellyfin-apiclient';

import { appHost } from './components/apphost';
import loading from 'components/loading/loading';
import { appRouter } from './components/router/appRouter';
import globalize from './lib/globalize';
import { loadCoreDictionary } from 'lib/globalize/loader';
import { currentSettings as userSettings } from './scripts/settings/userSettings';
import { serverAddress } from './utils/dashboard';
import Events from './utils/events';
import { preconnectToServer } from './utils/preconnect';

import RootApp from './RootApp';

// Import the button webcomponent for the legacy dashboard views
import './elements/emby-button/emby-button';

// Import site styles
import './styles/site.scss';
import './styles/dashboard.scss';

async function init() {
    // Log current version to console to help out with issue triage and debugging
    console.info(
        `[${__PACKAGE_JSON_NAME__}]
version: ${__PACKAGE_JSON_VERSION__}
commit: ${__COMMIT_SHA__}
build: ${__JF_BUILD_VERSION__}`);

    // Initialize app host
    await appHost.init();

    // Initialize the api client
    const serverUrl = await serverAddress();
    if (serverUrl) {
        // Antes de initApiClient: así el handshake con el servidor corre en
        // paralelo con lo que queda de arranque (diccionario, tema) en vez de
        // pagarse enterito en la primera petición de la API.
        preconnectToServer(serverUrl);
        ServerConnections.initApiClient(serverUrl);
    }

    // Point globalize at the user's locale preferences before loading strings
    globalize.setLocaleSettings(userSettings);

    // Load the translation dictionary
    await loadCoreDictionary();
    // Update localization on user changes
    Events.on(ServerConnections, 'localusersignedin', globalize.updateCurrentCulture);
    Events.on(ServerConnections, 'localusersignedout', globalize.updateCurrentCulture);

    // Load the font styles
    import('./styles/fonts.scss');

    // Register API request error handlers
    ServerConnections.getApiClients().forEach(apiClient => {
        Events.off(apiClient, 'requestfail', appRouter.onRequestFail);
        Events.on(apiClient, 'requestfail', appRouter.onRequestFail);
    });
    Events.on(ServerConnections, 'apiclientcreated', (_e, apiClient) => {
        Events.off(apiClient, 'requestfail', appRouter.onRequestFail);
        Events.on(apiClient, 'requestfail', appRouter.onRequestFail);
    });

    // Render the app
    renderApp();
}

function renderApp() {
    const container = document.getElementById('reactRoot');
    // Remove the splash logo
    container.innerHTML = '';

    loading.show();

    const root = createRoot(container);
    root.render(
        <RootApp />
    );
}

init();
