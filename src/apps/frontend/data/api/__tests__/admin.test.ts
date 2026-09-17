import { describe, it, expect, vi } from 'vitest';
import { getSystemInfo, refreshLibrary } from '../admin';
import * as httpModule from '../http';

vi.mock('../http');
vi.mock('lib/globalize', () => ({
    default: { translate: (key: string) => `Translated:${key}` }
}));

describe('admin', () => {
    it('getSystemInfo formats the system info', async () => {
        vi.mocked(httpModule.apiFetch).mockResolvedValueOnce({
            ServerName: 'MyServer',
            Version: '1.2.3',
            OperatingSystem: 'Linux',
            Id: 'server-id'
        });

        const info = await getSystemInfo();
        expect(info).toEqual({
            serverName: 'MyServer',
            version: '1.2.3',
            operatingSystem: 'Linux',
            id: 'server-id'
        });
        expect(httpModule.apiFetch).toHaveBeenCalledWith('/System/Info');
    });

    it('refreshLibrary calls apiSend and handles HttpError', async () => {
        vi.mocked(httpModule.apiSend).mockResolvedValueOnce(new Response());

        await refreshLibrary();
        expect(httpModule.apiSend).toHaveBeenCalledWith('/Library/Refresh', 'POST');

        // Test error handling
        vi.mocked(httpModule.apiSend).mockRejectedValueOnce(new httpModule.HttpError(500, 'Error'));
        await expect(refreshLibrary()).rejects.toThrow('Translated:MessageRefreshFailed');
    });
});
