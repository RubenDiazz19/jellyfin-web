import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSavedServers, saveServer, removeSavedServer, validateServer, getPublicUsers, avatarUrlForUser } from '../auth';
import { ServerConnections } from 'lib/jellyfin-apiclient';

vi.mock('lib/jellyfin-apiclient', () => ({
    ServerConnections: {
        getSavedServers: vi.fn().mockReturnValue([])
    }
}));
vi.mock('lib/globalize', () => ({
    default: { translate: (key: string) => `Translated:${key}` }
}));

describe('auth API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    describe('Servers', () => {
        it('gets saved servers from localStorage', () => {
            localStorage.setItem('jfp-saved-servers', JSON.stringify([{ url: 'http://srv1', name: 'S1' }]));

            const servers = getSavedServers();
            expect(servers).toHaveLength(1);
            expect(servers[0].url).toBe('http://srv1');
        });

        it('gets saved servers from ConnectionManager', () => {
            vi.mocked(ServerConnections.getSavedServers as any).mockReturnValueOnce([{ Address: 'http://srv2', Name: 'S2' }]);

            const servers = getSavedServers();
            expect(servers).toHaveLength(1);
            expect(servers[0].url).toBe('http://srv2');
        });

        it('saves a server', () => {
            saveServer({ url: 'http://srv', name: 'Server' } as any);

            const saved = JSON.parse(localStorage.getItem('jfp-saved-servers') || '[]');
            expect(saved.length).toBeGreaterThanOrEqual(1);
            expect(saved[0].url).toBe('http://srv');
            expect(localStorage.getItem('jfp-server-url')).toBe('http://srv');
        });

        it('removes a saved server', () => {
            saveServer({ url: 'http://srv', name: 'Server' } as any);
            removeSavedServer('http://srv');

            const saved = JSON.parse(localStorage.getItem('jfp-saved-servers') || '[]');
            expect(saved.find((s: any) => s.url === 'http://srv')).toBeUndefined();
            expect(localStorage.getItem('jfp-server-url')).toBeNull();
        });
    });

    describe('validateServer', () => {
        let globalFetch: any;

        beforeEach(() => {
            globalFetch = vi.fn();
            vi.stubGlobal('fetch', globalFetch);
        });

        it('validates a server successfully', async () => {
            globalFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ Id: '123', ServerName: 'Srv', Version: '1.0' })
            });

            const res = await validateServer('http://test');
            expect(res).toEqual({ ok: true, id: '123', name: 'Srv', version: '1.0' });
            expect(globalFetch).toHaveBeenCalledWith('http://test/System/Info/Public', expect.any(Object));
        });

        it('returns error on fetch failure', async () => {
            globalFetch.mockResolvedValueOnce({ ok: false, status: 500 });

            const res = await validateServer('http://test');
            expect(res.ok).toBe(false);
            expect(res.error).toBe('HTTP 500');
        });
    });

    describe('getPublicUsers', () => {
        let globalFetch: any;

        beforeEach(() => {
            globalFetch = vi.fn();
            vi.stubGlobal('fetch', globalFetch);
        });

        it('fetches and maps public users', async () => {
            globalFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ([{ Id: '1', Name: 'U', HasPassword: true }])
            });

            const users = await getPublicUsers('http://test');
            expect(users).toHaveLength(1);
            expect(users[0].name).toBe('U');
            expect(users[0].hasPassword).toBe(true);
        });
    });

    describe('avatarUrlForUser', () => {
        it('formats avatar URL', () => {
            expect(avatarUrlForUser('http://test', 'user1', 'tag1')).toBe('http://test/Users/user1/Images/Primary?tag=tag1');
        });
    });
});
