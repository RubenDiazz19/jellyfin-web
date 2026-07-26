import type { DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models/device-profile';
import type { MediaSourceInfo } from '@jellyfin/sdk/lib/generated-client/models/media-source-info';
import { describe, expect, it } from 'vitest';

import {
    enablePlaybackRetryWithTranscoding,
    getDeliveryMethod,
    isAudioStreamSupported
} from './mediaStreams';

const profile = (containers: string, codecs: string): DeviceProfile => ({
    DirectPlayProfiles: [{ Type: 'Video', Container: containers, AudioCodec: codecs }]
} as DeviceProfile);

const source = (over: Partial<MediaSourceInfo> = {}): MediaSourceInfo => ({
    Container: 'mkv',
    MediaStreams: [
        { Type: 'Video', Index: 0, Codec: 'h264' },
        { Type: 'Audio', Index: 1, Codec: 'aac' },
        { Type: 'Audio', Index: 2, Codec: 'truehd' }
    ],
    ...over
});

describe('isAudioStreamSupported', () => {
    it('sí cuando el perfil acepta el contenedor y el códec a la vez', () => {
        expect(isAudioStreamSupported(source(), 1, profile('mkv,mp4', 'aac,mp3'))).toBe(true);
    });

    it('no si el códec de esa pista no está en el perfil', () => {
        expect(isAudioStreamSupported(source(), 2, profile('mkv', 'aac'))).toBe(false);
    });

    it('no si el contenedor no está en el perfil', () => {
        expect(isAudioStreamSupported(source(), 1, profile('mp4', 'aac'))).toBe(false);
    });

    it('no si el índice no corresponde a ninguna pista de audio', () => {
        // El 0 es la de vídeo.
        expect(isAudioStreamSupported(source(), 0, profile('mkv', 'aac'))).toBe(false);
        expect(isAudioStreamSupported(source(), 99, profile('mkv', 'aac'))).toBe(false);
    });

    it('no si la pista no declara códec: no hay nada que comprobar', () => {
        const sinCodec = source({
            MediaStreams: [{ Type: 'Audio', Index: 1, Codec: '' }]
        });
        expect(isAudioStreamSupported(sinCodec, 1, profile('mkv', 'aac'))).toBe(false);
    });

    it('no distingue mayúsculas', () => {
        const mayus = source({
            Container: 'MKV',
            MediaStreams: [{ Type: 'Audio', Index: 1, Codec: 'AAC' }]
        });
        expect(isAudioStreamSupported(mayus, 1, profile('mkv', 'aac'))).toBe(true);
    });

    it('sin perfiles de reproducción directa, no', () => {
        expect(isAudioStreamSupported(source(), 1, {} as DeviceProfile)).toBe(false);
    });
});

describe('getDeliveryMethod', () => {
    it('usa lo que diga el servidor', () => {
        expect(getDeliveryMethod({ DeliveryMethod: 'Hls' })).toBe('Hls');
    });

    it('en los items locales lo deduce: externo = fichero aparte', () => {
        expect(getDeliveryMethod({ IsExternal: true })).toBe('External');
    });

    it('y si no es externo, va dentro del contenedor', () => {
        expect(getDeliveryMethod({ IsExternal: false })).toBe('Embed');
        expect(getDeliveryMethod({})).toBe('Embed');
    });
});

describe('enablePlaybackRetryWithTranscoding', () => {
    it('sí si el servidor transcodifica y aún queda algo que degradar', () => {
        expect(enablePlaybackRetryWithTranscoding({ SupportsTranscoding: true }, false, false))
            .toBe(true);
        expect(enablePlaybackRetryWithTranscoding({ SupportsTranscoding: true }, true, false))
            .toBe(true);
    });

    it('no si ya se recodifican las dos pistas: daría lo mismo', () => {
        expect(enablePlaybackRetryWithTranscoding({ SupportsTranscoding: true }, true, true))
            .toBe(false);
    });

    it('no si el servidor no puede transcodificar', () => {
        expect(enablePlaybackRetryWithTranscoding({ SupportsTranscoding: false }, false, false))
            .toBe(false);
    });

    it('no si no hay fuente de la que hablar', () => {
        expect(enablePlaybackRetryWithTranscoding(undefined, false, false)).toBe(false);
    });
});
