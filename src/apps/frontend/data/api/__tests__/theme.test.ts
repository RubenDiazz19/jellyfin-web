import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getServerThemePrefs, saveServerThemePrefs } from '../theme';
import * as httpModule from '../http';
import * as sessionModule from '../../session/session';

vi.mock('../http');
vi.mock('../../session/session');

describe('theme API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getServerThemePrefs', () => {
        it('devuelve null si no hay sesión activa', async () => {
            vi.mocked(sessionModule.loadSession).mockReturnValue(null);
            const res = await getServerThemePrefs();
            expect(res).toBeNull();
            expect(httpModule.apiFetch).not.toHaveBeenCalled();
        });

        it('devuelve null si la sesión no tiene userId', async () => {
            vi.mocked(sessionModule.loadSession).mockReturnValue({} as any);
            const res = await getServerThemePrefs();
            expect(res).toBeNull();
            expect(httpModule.apiFetch).not.toHaveBeenCalled();
        });

        it('obtiene las preferencias y mapea mode y seed de CustomPrefs', async () => {
            vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'user-1' } as any);
            vi.mocked(httpModule.apiFetch).mockResolvedValueOnce({
                CustomPrefs: {
                    themeMode: 'dark',
                    themeSeed: '#123456'
                }
            });

            const res = await getServerThemePrefs();
            expect(res).toEqual({
                mode: 'dark',
                seed: '#123456'
            });
            expect(httpModule.apiFetch).toHaveBeenCalledWith(
                expect.stringContaining('userId=user-1&client=jfp')
            );
        });

        it('devuelve undefined en campos vacíos de CustomPrefs', async () => {
            vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'user-1' } as any);
            vi.mocked(httpModule.apiFetch).mockResolvedValueOnce({});

            const res = await getServerThemePrefs();
            expect(res).toEqual({
                mode: undefined,
                seed: undefined
            });
        });
    });

    describe('saveServerThemePrefs', () => {
        it('no hace nada si no hay sesión', async () => {
            vi.mocked(sessionModule.loadSession).mockReturnValue(null);
            await saveServerThemePrefs({ mode: 'light', seed: '#ffffff' });
            expect(httpModule.apiFetch).not.toHaveBeenCalled();
            expect(httpModule.apiSend).not.toHaveBeenCalled();
        });

        it('lee el documento actual y escribe el nuevo fusionando CustomPrefs', async () => {
            vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'user-1' } as any);
            vi.mocked(httpModule.apiFetch).mockResolvedValueOnce({
                Id: 'custom-id',
                CustomPrefs: {
                    otherPref: 'preserved'
                }
            });

            await saveServerThemePrefs({ mode: 'dark', seed: '#abcdef' });

            expect(httpModule.apiFetch).toHaveBeenCalledWith(
                expect.stringContaining('userId=user-1&client=jfp')
            );
            expect(httpModule.apiSend).toHaveBeenCalledWith(
                expect.stringContaining('userId=user-1&client=jfp'),
                'POST',
                {
                    Id: 'custom-id',
                    Client: 'jfp',
                    CustomPrefs: {
                        otherPref: 'preserved',
                        themeMode: 'dark',
                        themeSeed: '#abcdef'
                    }
                }
            );
        });

        it('guarda string vacío si seed es null', async () => {
            vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'user-1' } as any);
            vi.mocked(httpModule.apiFetch).mockResolvedValueOnce({});

            await saveServerThemePrefs({ mode: 'dark', seed: null });

            expect(httpModule.apiSend).toHaveBeenCalledWith(
                expect.any(String),
                'POST',
                expect.objectContaining({
                    CustomPrefs: {
                        themeMode: 'dark',
                        themeSeed: ''
                    }
                })
            );
        });
    });
});
