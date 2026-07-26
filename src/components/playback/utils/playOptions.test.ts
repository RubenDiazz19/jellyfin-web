import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { describe, expect, it } from 'vitest';

import {
    createStreamInfoFromUrlItem,
    normalizePlayOptions,
    truncatePlayOptions
} from './playOptions';

describe('normalizePlayOptions', () => {
    it('pantalla completa es lo que se hace por defecto', () => {
        const options = {};
        normalizePlayOptions(options);
        expect(options).toEqual({ fullscreen: true });
    });

    it('solo se desactiva pidiéndolo explícitamente', () => {
        const options = { fullscreen: false };
        normalizePlayOptions(options);
        expect(options.fullscreen).toBe(false);
    });

    it('muta el objeto recibido: quien llama sigue usando esa referencia', () => {
        const options: { fullscreen?: boolean } = {};
        const same = options;
        normalizePlayOptions(options);
        expect(same.fullscreen).toBe(true);
    });
});

describe('truncatePlayOptions', () => {
    it('conserva cómo se está viendo', () => {
        const kept = truncatePlayOptions({
            aspectRatio: 'cover',
            fullscreen: true,
            mediaSourceId: 'ms-1',
            audioStreamIndex: 2,
            subtitleStreamIndex: 3,
            startPositionTicks: 500
        });

        expect(kept).toEqual({
            aspectRatio: 'cover',
            fullscreen: true,
            mediaSourceId: 'ms-1',
            audioStreamIndex: 2,
            subtitleStreamIndex: 3,
            startPositionTicks: 500
        });
    });

    it('descarta lo que solo valía para el item anterior', () => {
        const kept = truncatePlayOptions({
            fullscreen: true,
            items: [{ Id: 'a' }],
            startIndex: 4,
            serverId: 'srv-1'
        });

        expect(kept).not.toHaveProperty('items');
        expect(kept).not.toHaveProperty('startIndex');
        expect(kept).not.toHaveProperty('serverId');
    });
});

describe('createStreamInfoFromUrlItem', () => {
    it('reproduce en directo lo que ya trae su URL', () => {
        const item: BaseItemDto & { Url?: string } = {
            Id: 'x', MediaType: 'Video', Url: 'https://srv/a.mkv'
        };

        expect(createStreamInfoFromUrlItem(item)).toMatchObject({
            url: 'https://srv/a.mkv',
            playMethod: 'DirectPlay',
            mediaType: 'Video',
            textTracks: []
        });
    });

    it('los items locales traen la ruta en Path en vez de Url', () => {
        const item: BaseItemDto = { Id: 'x', MediaType: 'Video', Path: '/media/a.mkv' };

        expect(createStreamInfoFromUrlItem(item).url).toBe('/media/a.mkv');
    });

    it('Url gana a Path cuando están las dos', () => {
        const item = { Id: 'x', Url: 'https://srv/a.mkv', Path: '/media/a.mkv' };

        expect(createStreamInfoFromUrlItem(item).url).toBe('https://srv/a.mkv');
    });

    it('lleva el item dentro para el resto del sistema', () => {
        const item = { Id: 'x', Url: 'https://srv/a.mkv' };

        expect(createStreamInfoFromUrlItem(item).item).toBe(item);
    });
});
