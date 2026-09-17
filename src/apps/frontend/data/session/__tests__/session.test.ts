import { describe, it, expect, vi, beforeEach } from 'vitest';
import { restoreSession, loadSession, clearSession, setSessionDisplayName, setSessionUser, wireServerConnectionsEvents, SESSION_EVENT } from '../session';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import events from 'utils/events';

vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        connect: vi.fn(),
        getApi: vi.fn(),
        getCurrentUserId: vi.fn(),
        getCurrentServerId: vi.fn(),
        logout: vi.fn()
    }
}));

vi.mock('utils/events', () => ({
    default: {
        on: vi.fn()
    }
}));

describe('session module', () => {
    let dispatchEventSpy: any;

    beforeEach(() => {
        vi.clearAllMocks();
        dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
    });

    it('restoreSession connects and reads from ServerConnections', async () => {
        vi.spyOn(ServerConnections, 'connect').mockResolvedValue(undefined as any);
        vi.spyOn(ServerConnections, 'getApi').mockReturnValue({ accessToken: 'token', basePath: 'http://server' } as any);
        vi.spyOn(ServerConnections, 'getCurrentUserId').mockReturnValue('user-1');
        vi.spyOn(ServerConnections, 'getCurrentServerId').mockReturnValue('server-1');

        const session = await restoreSession();

        expect(ServerConnections.connect).toHaveBeenCalled();
        expect(session).toEqual({
            serverUrl: 'http://server',
            username: '',
            displayName: '',
            createdAt: 0,
            accessToken: 'token',
            userId: 'user-1',
            serverId: 'server-1',
            avatarTag: undefined
        });
    });

    it('loadSession reads synchronously without connecting', () => {
        const connectSpy = vi.spyOn(ServerConnections, 'connect');
        vi.spyOn(ServerConnections, 'getApi').mockReturnValue({ accessToken: 'token2', basePath: 'http://server2' } as any);
        vi.spyOn(ServerConnections, 'getCurrentUserId').mockReturnValue('user-2');

        const session = loadSession();
        expect(connectSpy).not.toHaveBeenCalled();
        expect(session?.userId).toBe('user-2');
    });

    it('clearSession logouts and resets cached data', () => {
        vi.spyOn(ServerConnections, 'getApi').mockReturnValue({ accessToken: 'token' } as any);
        vi.spyOn(ServerConnections, 'logout').mockResolvedValue(undefined);

        clearSession();

        expect(ServerConnections.logout).toHaveBeenCalled();
        expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));
        expect((dispatchEventSpy.mock.calls[0][0] as Event).type).toBe(SESSION_EVENT);
    });

    it('setSessionDisplayName updates name and dispatches event', () => {
        setSessionDisplayName('Ruben');
        expect(dispatchEventSpy).toHaveBeenCalled();
    });

    it('setSessionUser updates name and avatar tag and dispatches event', () => {
        setSessionUser('Ruben', 'tag123');
        expect(dispatchEventSpy).toHaveBeenCalled();
    });

    it('wireServerConnectionsEvents binds to apiclient events', () => {
        wireServerConnectionsEvents();
        expect(events.on).toHaveBeenCalledWith(ServerConnections, 'localusersignedin', expect.any(Function));
        expect(events.on).toHaveBeenCalledWith(ServerConnections, 'localusersignedout', expect.any(Function));
    });
});
