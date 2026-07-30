import { getImageApi } from '@jellyfin/sdk/lib/utils/api/image-api';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';

import { appHost } from 'components/apphost';
import appSettings from 'scripts/settings/appSettings';
import { setUserInfo } from 'scripts/settings/userSettings';
import { detectBitrate } from 'utils/bitrateTest';
import Dashboard from 'utils/dashboard';
import Events from 'utils/events';

import ConnectionManager from './connectionManager';
import Credentials from './credentials';
import ServerHandle from './serverHandle';

class ServerConnections extends ConnectionManager {
    firstConnection = false;

    constructor() {
        super(...arguments);
        this.localApiClient = null;
        this.firstConnection = null;

        Events.on(this, 'localusersignedout', (_e, logoutInfo) => {
            setUserInfo(null, null);
            // Ensure the updated credentials are persisted to storage
            credentialProvider.credentials(credentialProvider.credentials());

            if (window.NativeShell && typeof window.NativeShell.onLocalUserSignedOut === 'function') {
                window.NativeShell.onLocalUserSignedOut(logoutInfo);
            }
        });
    }

    initApiClient(server) {
        console.debug('creating ApiClient singleton');

        const apiClient = new ServerHandle(server, {
            appName: appHost.appName(),
            appVersion: appHost.appVersion(),
            deviceName: appHost.deviceName(),
            deviceId: appHost.deviceId()
        });

        apiClient.manualAddressOnly = true;

        this.addApiClient(apiClient);

        this.setLocalApiClient(apiClient);

        console.debug('loaded ApiClient singleton');
    }

    /**
     * @returns {Promise<import('./connectResponse').ConnectResponse>} The result of the connection attempt.
     */
    connect(options) {
        return super.connect({
            enableAutoLogin: appSettings.enableAutoLogin(),
            ...options
        });
    }

    setLocalApiClient(apiClient) {
        if (apiClient) {
            this.localApiClient = apiClient;
            window.ApiClient = apiClient;
        }
    }

    getLocalApiClient() {
        return this.localApiClient;
    }

    /**
     * Gets the handle of the server that is currently connected.
     * @returns {import('./serverHandle').default|undefined} The server handle.
     */
    currentApiClient() {
        let apiClient = this.getLocalApiClient();

        if (!apiClient) {
            const server = this.getLastUsedServer();

            if (server) {
                apiClient = this.getApiClient(server.Id);
            }
        }

        return apiClient;
    }

    /**
     * Gets an SDK Api instance for every connected server.
     * @returns {import('@jellyfin/sdk').Api[]} The Api instances.
     */
    getApis() {
        return this.getApiClients().map((apiClient) => apiClient.api);
    }

    /**
     * Ids of every server the app is connected to.
     * @returns {string[]} The server ids.
     */
    getServerIds() {
        return this.getApiClients().map((apiClient) => apiClient.serverId());
    }

    /**
     * Gets the id of the user signed in on a server.
     *
     * Consumers that only talk to the SDK still need the user id for the
     * endpoints that take one, and asking the connection layer keeps them from
     * reaching for an ApiClient just to read it.
     * @param {string} [serverId] The server id; defaults to the last used server.
     * @returns {string|undefined} The signed in user id, if any.
     */
    getCurrentUserId(serverId) {
        const apiClient = serverId ? this.getApiClient(serverId) : this.currentApiClient();
        return apiClient?.getCurrentUserId();
    }

    /**
     * Gets the id of the server currently in use.
     * @returns {string|undefined} The server id, if any.
     */
    getCurrentServerId() {
        return this.currentApiClient()?.serverId() ?? this.getLastUsedServer()?.Id;
    }

    /**
     * Gets the stored details (id, name, address…) of a server.
     *
     * The SDK Api only knows the address, so anything else about the server
     * has to come from here.
     * @param {string} [serverId] The server id; defaults to the current one.
     * @returns {object|undefined} The server info, if known.
     */
    getServerInfo(serverId) {
        const apiClient = serverId ? this.getApiClient(serverId) : this.currentApiClient();
        return apiClient?.serverInfo();
    }

    /**
     * Gets the signed in user of a server, with its avatar url resolved.
     *
     * Replaces `ConnectionManager.user()`: same shape, but asked to the SDK.
     * @param {string} [serverId] The server id; defaults to the current one.
     * @returns {Promise<object>} The user info, or an empty object if nobody is signed in.
     */
    async getUserInfo(serverId) {
        const api = serverId ? this.getApi(serverId) : this.getApi();
        const userId = this.getCurrentUserId(serverId);

        if (!api || !userId) return {};

        const { data: localUser } = await getUserApi(api).getCurrentUser();
        const imageUrl = localUser.PrimaryImageTag ?
            getImageApi(api).getUserImageUrl(localUser, { tag: localUser.PrimaryImageTag }) :
            null;

        return {
            localUser,
            name: localUser?.Name ?? null,
            imageUrl: imageUrl ?? null,
            supportsImageParams: !!imageUrl
        };
    }

    onLocalUserSignedIn(user) {
        const apiClient = this.getApiClient(user.ServerId);
        this.setLocalApiClient(apiClient);
        setTimeout(() => detectBitrate(this.getApi(user.ServerId), true), 6000);
        return setUserInfo(user.Id, user.ServerId).then(() => {
            if (window.NativeShell && typeof window.NativeShell.onLocalUserSignedIn === 'function') {
                return window.NativeShell.onLocalUserSignedIn(user, apiClient.accessToken());
            }
            return Promise.resolve();
        });
    }
}

const credentialProvider = new Credentials();

const capabilities = Dashboard.capabilities(appHost);

export default new ServerConnections(
    credentialProvider,
    () => appHost.appName(),
    () => appHost.appVersion(),
    () => appHost.deviceName(),
    () => appHost.deviceId(),
    capabilities);
