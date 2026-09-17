import { describe, it, expect } from 'vitest';
import * as apiFacade from '../api';
import * as realApi from '../../data/api';

describe('api facade', () => {
    it('re-exports specific api functions to presentation layer', () => {
        expect(apiFacade.getCurrentUser).toBe(realApi.getCurrentUser);
        expect(apiFacade.getSystemInfo).toBe(realApi.getSystemInfo);
        expect(apiFacade.refreshLibrary).toBe(realApi.refreshLibrary);
        expect(apiFacade.uploadAvatar).toBe(realApi.uploadAvatar);
        expect(apiFacade.remoteSearch).toBe(realApi.remoteSearch);
        expect(apiFacade.getPlaylists).toBe(realApi.getPlaylists);
        expect(apiFacade.createPlaylist).toBe(realApi.createPlaylist);
        expect(apiFacade.imageUrl).toBe(realApi.imageUrl);
        expect(apiFacade.searchSubtitles).toBe(realApi.searchSubtitles);
    });
});
