import type { Api } from '@jellyfin/sdk';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client';
import type ServerHandle from './serverHandle';
import type { ConnectResponse } from './connectResponse';

export interface ServerInfo {
    Id?: string;
    Name?: string;
    Address?: string;
    LocalAddress?: string;
    ManualAddress?: string;
    RemoteAddress?: string;
    LastConnectionMode?: string;
    DateLastAccessed?: number;
    AccessToken?: string;
    UserId?: string;
    [key: string]: unknown;
}

export interface AuthenticationResult {
    AccessToken?: string;
    User?: {
        Id?: string;
        Name?: string;
        [key: string]: unknown;
    };
    ServerId?: string;
    [key: string]: unknown;
}

export default class ConnectionManager {
    constructor(
        credentialProvider: unknown,
        appName: string | (() => string),
        appVersion: string | (() => string),
        deviceName: string | (() => string),
        deviceId: string | (() => string),
        capabilities: unknown
    );
    _apiClients: ServerHandle[];
    _minServerVersion: string;
    appVersion(): string;
    appName(): string;
    capabilities(): unknown;
    deviceName(): string;
    deviceId(): string;
    credentialProvider(): unknown;
    getServerInfo(id?: string): ServerInfo | undefined;
    getLastUsedServer(): ServerInfo | null;
    appInfo(): { appName: string; appVersion: string; deviceName: string; deviceId: string };
    addApiClient(apiClient: ServerHandle): void;
    clearData(): void;
    _getOrAddApiClient(server: unknown, serverUrl: string): ServerHandle;
    getOrCreateApiClient(serverId: string): ServerHandle;
    authenticateUserByName(apiClient: unknown, username: string, password?: string): Promise<AuthenticationResult>;
    authenticateWithQuickConnect(apiClient: unknown, secret: string): Promise<AuthenticationResult>;
    logout(): Promise<void>;
    getSavedServers(): ServerInfo[];
    getAvailableServers(): Promise<ServerInfo[]>;
    connectToServers(servers: ServerInfo[], options?: unknown): Promise<ConnectResponse>;
    connectToServer(server: unknown, options?: unknown): Promise<ConnectResponse>;
    updateSavedServerId(server: unknown): Promise<void>;
    connectToAddress(address: string, options?: unknown): Promise<ConnectResponse>;
    deleteServer(serverId: string | undefined): Promise<void>;
    connect(options?: unknown): Promise<ConnectResponse>;
    getApiClients(): ServerHandle[];
    getApiClient(item: BaseItemDto | string | null | undefined): ServerHandle | undefined;
    getApi(serverId?: string): Api | undefined;
    minServerVersion(val?: string): string;
}
