import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isQuickConnectEnabled, startQuickConnect, waitForQuickConnect, authenticateWithQuickConnect } from '../quickConnect';
import * as authModule from '../auth';
import { getAuthenticationApi } from '@jellyfin/sdk/lib/utils/api/authentication-api';
import { ServerConnections } from 'lib/jellyfin-apiclient';

vi.mock('../auth');
vi.mock('@jellyfin/sdk/lib/utils/api/authentication-api');
vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        authenticateWithQuickConnect: vi.fn()
    }
}));
vi.mock('lib/globalize', () => ({
    default: { translate: (key: string) => `T:${key}` }
}));

describe('quickConnect API', () => {
    let mockAuthApi: any;

    beforeEach(() => {
        mockAuthApi = {
            getQuickConnectEnabled: vi.fn(),
            initiateQuickConnect: vi.fn(),
            getQuickConnectState: vi.fn()
        };
        vi.mocked(getAuthenticationApi).mockReturnValue(mockAuthApi);
        vi.mocked(authModule.connectTo).mockResolvedValue({ api: {} } as any);
        vi.clearAllMocks();
    });

    it('isQuickConnectEnabled returns true if server supports it', async () => {
        mockAuthApi.getQuickConnectEnabled.mockResolvedValueOnce({ data: true });
        expect(await isQuickConnectEnabled('http://srv')).toBe(true);
    });

    it('startQuickConnect returns code and secret', async () => {
        mockAuthApi.initiateQuickConnect.mockResolvedValueOnce({ data: { Code: '123', Secret: 'abc' } });
        const res = await startQuickConnect('http://srv');
        expect(res).toEqual({ code: '123', secret: 'abc' });
    });

    it('waitForQuickConnect polls until authenticated', async () => {
        vi.useFakeTimers();
        const signal = new AbortController().signal;

        mockAuthApi.getQuickConnectState
            .mockResolvedValueOnce({ data: { Authenticated: false } })
            .mockResolvedValueOnce({ data: { Authenticated: true } });

        const p = waitForQuickConnect('http://srv', 'abc', signal);

        await vi.advanceTimersByTimeAsync(2000);
        await vi.advanceTimersByTimeAsync(2000);

        expect(await p).toBe(true);
        vi.useRealTimers();
    });

    it('authenticateWithQuickConnect exchanges secret for token', async () => {
        vi.mocked(ServerConnections.authenticateWithQuickConnect as any).mockResolvedValueOnce({
            AccessToken: 'token1', User: { Id: 'u1', Name: 'User 1' }, ServerId: 'srv1'
        });

        const res = await authenticateWithQuickConnect('http://srv', 'abc');
        expect(res.accessToken).toBe('token1');
        expect(res.userId).toBe('u1');
    });
});
