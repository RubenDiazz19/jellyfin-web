import { describe, it, expect, vi, beforeEach } from 'vitest';
import { playsHlsNatively, attachHlsSource } from '../hlsSource';

vi.mock('hls.js', () => {
    class HlsMock {
        on = vi.fn();
        startLoad = vi.fn();
        recoverMediaError = vi.fn();
        loadSource = vi.fn();
        attachMedia = vi.fn();
        static readonly isSupported = vi.fn().mockReturnValue(true);
        static readonly Events = { ERROR: 'ERROR' };
    }
    return { default: HlsMock };
});

describe('hlsSource', () => {
    describe('playsHlsNatively', () => {
        it('returns true if browser supports apple mpegurl natively', () => {
            const video = { canPlayType: vi.fn().mockReturnValue('probably') } as any;
            expect(playsHlsNatively(video)).toBe(true);

            video.canPlayType.mockReturnValue('');
            expect(playsHlsNatively(video)).toBe(false);
        });
    });

    describe('attachHlsSource', () => {
        let video: HTMLVideoElement;

        beforeEach(async () => {
            video = document.createElement('video');
            vi.clearAllMocks();
            const HlsMod = (await import('hls.js')).default;
            vi.mocked(HlsMod.isSupported).mockReturnValue(true);
        });

        it('returns aborted if isClosed is true before loading', async () => {
            const result = await attachHlsSource(video, 'url', { isClosed: () => true, onUnrecoverable: vi.fn() });
            expect(result.status).toBe('aborted');
        });

        it('returns unsupported if HLS.js is not supported', async () => {
            const HlsMod = (await import('hls.js')).default;
            vi.mocked(HlsMod.isSupported).mockReturnValueOnce(false);

            const result = await attachHlsSource(video, 'url', { isClosed: () => false, onUnrecoverable: vi.fn() });
            expect(result.status).toBe('unsupported');
        });

        it('creates an HLS instance and binds events', async () => {
            const result = await attachHlsSource(video, 'url', { isClosed: () => false, onUnrecoverable: vi.fn() });

            expect(result.status).toBe('attached');
            if (result.status === 'attached') {
                expect(result.hls.loadSource).toHaveBeenCalledWith('url');
                expect(result.hls.attachMedia).toHaveBeenCalledWith(video);
            }
        });

        it('handles network errors by starting load again', async () => {
            const onUnrecoverable = vi.fn();
            const result = await attachHlsSource(video, 'url', { isClosed: () => false, onUnrecoverable });

            expect(result.status).toBe('attached');
            if (result.status === 'attached') {
                const onError = (result.hls.on as any).mock.calls.find((c: any) => c[0] === 'ERROR')?.[1];

                // Trigger fatal network error
                onError?.('ERROR', { fatal: true, type: 'networkError' });
                expect(result.hls.startLoad).toHaveBeenCalled();
                expect(onUnrecoverable).not.toHaveBeenCalled();
            }
        });

        it('handles media errors by recovering', async () => {
            const onUnrecoverable = vi.fn();
            const result = await attachHlsSource(video, 'url', { isClosed: () => false, onUnrecoverable });

            expect(result.status).toBe('attached');
            if (result.status === 'attached') {
                const onError = (result.hls.on as any).mock.calls.find((c: any) => c[0] === 'ERROR')?.[1];

                onError?.('ERROR', { fatal: true, type: 'mediaError' });
                expect(result.hls.recoverMediaError).toHaveBeenCalled();
                expect(result.hls.startLoad).toHaveBeenCalled();
                expect(onUnrecoverable).not.toHaveBeenCalled();
            }
        });

        it('triggers onUnrecoverable for other fatal errors', async () => {
            const onUnrecoverable = vi.fn();
            const result = await attachHlsSource(video, 'url', { isClosed: () => false, onUnrecoverable });

            expect(result.status).toBe('attached');
            if (result.status === 'attached') {
                const onError = (result.hls.on as any).mock.calls.find((c: any) => c[0] === 'ERROR')?.[1];

                onError?.('ERROR', { fatal: true, type: 'otherError' });
                expect(onUnrecoverable).toHaveBeenCalled();
            }
        });
    });
});
