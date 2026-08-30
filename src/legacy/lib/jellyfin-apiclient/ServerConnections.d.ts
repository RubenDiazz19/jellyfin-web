import type { Api } from '@jellyfin/sdk';
import ConnectionManager, { type ServerInfo } from './connectionManager';
import type ServerHandle from './serverHandle';
import type { ConnectResponse } from './connectResponse';

export interface UserInfo {
    localUser?: unknown;
    name?: string | null;
    imageUrl?: string | null;
    supportsImageParams?: boolean;
}

export class ServerConnections extends ConnectionManager {
    firstConnection: boolean | null;
    localApiClient: ServerHandle | null;
    initApiClient(server: unknown): void;
    connect(options?: unknown): Promise<ConnectResponse>;
    setLocalApiClient(apiClient?: ServerHandle | null): void;
    getLocalApiClient(): ServerHandle | null;
    currentApiClient(): ServerHandle | undefined;
    getApis(): Api[];
    getServerIds(): (string | undefined)[];
    getCurrentUserId(serverId?: string): string | undefined;
    getCurrentServerId(): string | undefined;
    getServerInfo(serverId?: string): ServerInfo | undefined;
    getUserInfo(serverId?: string): Promise<UserInfo>;
    onLocalUserSignedIn(user: unknown): Promise<void>;
}

declare const serverConnections: ServerConnections;
export default serverConnections;
