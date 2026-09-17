import { describe, it, expect, vi } from 'vitest';
import { getCurrentUser, updateUserConfig, changePassword, getUserViews, getUsers } from '../users';
import * as httpModule from '../http';
import * as sessionModule from '../../session/session';

vi.mock('../http');
vi.mock('../../session/session');

describe('users API', () => {
    it('getCurrentUser gets and formats the current user', async () => {
        vi.mocked(httpModule.apiFetch).mockResolvedValueOnce({
            Id: 'user-1',
            Name: 'Admin',
            Policy: { IsAdministrator: true }
        });

        const user = await getCurrentUser();
        expect(user.id).toBe('user-1');
        expect(user.name).toBe('Admin');
        expect(user.isAdmin).toBe(true);
        expect(user.config.PlayDefaultAudioTrack).toBe(true); // default value filled in
    });

    it('updateUserConfig patches the configuration', async () => {
        vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'user-1' } as any);
        vi.mocked(httpModule.apiFetch).mockResolvedValueOnce({
            Configuration: { PlayDefaultAudioTrack: false }
        });

        const res = await updateUserConfig({ RememberAudioSelections: false });

        expect(httpModule.apiSend).toHaveBeenCalledWith('/Users/user-1/Configuration', 'POST', expect.objectContaining({
            PlayDefaultAudioTrack: false,
            RememberAudioSelections: false,
            SubtitleMode: 'Default' // from defaults
        }));

        expect(res.PlayDefaultAudioTrack).toBe(false);
    });

    it('changePassword sends POST request', async () => {
        vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'user-1' } as any);
        await changePassword('old', 'new');

        expect(httpModule.apiSend).toHaveBeenCalledWith('/Users/user-1/Password', 'POST', {
            CurrentPw: 'old',
            NewPw: 'new'
        });
    });

    it('getUserViews formats the user views', async () => {
        vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'user-1' } as any);
        vi.mocked(httpModule.apiFetch).mockResolvedValueOnce({
            Items: [{ Id: 'view-1', Name: 'Movies' }]
        });

        const views = await getUserViews();
        expect(views).toHaveLength(1);
        expect(views[0].id).toBe('view-1');
        expect(views[0].name).toBe('Movies');
    });

    it('getUsers formats the user list', async () => {
        vi.mocked(httpModule.apiFetch).mockResolvedValueOnce([
            { Id: 'user-1', Name: 'A', Policy: { IsAdministrator: true } },
            { Id: 'user-2', Name: 'B', Policy: { IsDisabled: true } }
        ]);

        const users = await getUsers();
        expect(users).toHaveLength(2);
        expect(users[0].isAdmin).toBe(true);
        expect(users[1].isDisabled).toBe(true);
    });
});
