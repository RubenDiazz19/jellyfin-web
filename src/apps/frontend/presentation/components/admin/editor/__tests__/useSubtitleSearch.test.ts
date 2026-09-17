import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { useSubtitleSearch, POPULAR_LANGS } from '../useSubtitleSearch';
import { renderHook } from '../../../../../domain/bridge/__tests__/testUtils';
import * as api from '../../../../../domain/api';

const mockToast = vi.fn();
vi.mock('../../../toast/ToastProvider', () => ({
    useToast: () => mockToast
}));

vi.mock('../../../../../domain/api', () => ({
    searchSubtitles: vi.fn(),
    downloadSubtitle: vi.fn(),
    fileToBase64: vi.fn(),
    uploadSubtitle: vi.fn()
}));

describe('useSubtitleSearch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.searchSubtitles).mockResolvedValue([]);
    });

    it('contiene la lista de idiomas populares', () => {
        expect(POPULAR_LANGS.length).toBeGreaterThan(0);
        expect(POPULAR_LANGS.some((l) => l.code === 'spa')).toBe(true);
        expect(POPULAR_LANGS.some((l) => l.code === 'eng')).toBe(true);
    });

    it('busca subtítulos automáticamente al montar con itemId', async () => {
        const mockResults = [
            { id: 'sub-1', name: 'Spanish Sub', format: 'srt', language: 'spa' }
        ];
        vi.mocked(api.searchSubtitles).mockResolvedValue(mockResults as any);

        const hook = renderHook(() => useSubtitleSearch({ itemId: 'item-1' }));

        await act(async () => {
            await hook.result.current.doSearch('spa', false);
        });

        expect(api.searchSubtitles).toHaveBeenCalledWith('item-1', 'spa', undefined);
        expect(hook.result.current.results).toEqual(mockResults);
        hook.unmount();
    });

    it('descarga un subtítulo seleccionado y llama onSubtitleUpdated', async () => {
        const onUpdated = vi.fn();
        vi.mocked(api.downloadSubtitle).mockResolvedValue(undefined as any);

        const hook = renderHook(() => useSubtitleSearch({
            itemId: 'item-1',
            onSubtitleUpdated: onUpdated
        }));

        await act(async () => {
            await hook.result.current.doDownload('sub-42');
        });

        expect(api.downloadSubtitle).toHaveBeenCalledWith('item-1', 'sub-42');
        expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'success');
        expect(onUpdated).toHaveBeenCalled();
        hook.unmount();
    });

    it('sube un archivo de subtítulo y resetea el archivo seleccionado', async () => {
        const onUpdated = vi.fn();
        vi.mocked(api.fileToBase64).mockResolvedValue('base64data');
        vi.mocked(api.uploadSubtitle).mockResolvedValue(undefined as any);

        const hook = renderHook(() => useSubtitleSearch({
            itemId: 'item-1',
            onSubtitleUpdated: onUpdated
        }));

        const dummyFile = new File(['1\n00:00:01,000 --> 00:00:02,000\nHola'], 'test.srt', { type: 'text/plain' });

        act(() => {
            hook.result.current.setFile(dummyFile);
            hook.result.current.setUploadLang('spa');
            hook.result.current.setIsForced(true);
        });

        await act(async () => {
            await hook.result.current.doUpload();
        });

        expect(api.fileToBase64).toHaveBeenCalledWith(dummyFile);
        expect(api.uploadSubtitle).toHaveBeenCalledWith('item-1', {
            language: 'spa',
            format: 'srt',
            isForced: true,
            isHearingImpaired: false,
            data: 'base64data'
        });
        expect(hook.result.current.file).toBeNull();
        expect(onUpdated).toHaveBeenCalled();
        hook.unmount();
    });
});
