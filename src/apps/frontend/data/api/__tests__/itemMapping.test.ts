import { describe, expect, test } from 'vitest';
import { extractMediaBadges, mapCommonFields } from '../itemMapping';
import { mapMovie } from '../movies';
import { mapShow } from '../shows';
import type { JFItem } from '../types';

describe('itemMapping and detail fields', () => {
    const baseItem: JFItem = {
        Id: 'item-1',
        Name: 'Shōgun',
        ProductionYear: 2024,
        PremiereDate: '2024-02-27T00:00:00.0000000Z',
        Genres: ['Drama', 'War & Politics'],
        Studios: [{ Name: 'FX Productions' }, { Name: 'DNA Films' }],
        ProductionLocations: ['United States', 'Japan'],
        Status: 'Continuing',
        People: [
            { Name: 'Rachel Kondo', Type: 'Creator' },
            { Name: 'Justin Marks', Type: 'Creator' },
            { Name: 'Jonathan van Tulleken', Type: 'Director' },
            { Name: 'Hiroyuki Sanada', Type: 'Actor' }
        ]
    };

    test('mapCommonFields mapea múltiples estudios y países', () => {
        const common = mapCommonFields(baseItem);
        expect(common.studio).toBe('FX Productions, DNA Films');
        expect(common.country).toBe('United States, Japan');
        expect(common.premiere).toBe('2024-02-27T00:00:00.0000000Z');
    });

    test('mapShow mapea creadores y directores correctamente', () => {
        const show = mapShow(baseItem);
        expect(show.creator).toBe('Rachel Kondo, Justin Marks');
        expect(show.directors).toBe('Jonathan van Tulleken');
        expect(show.status).toBe('Continuing');
        expect(show.studio).toBe('FX Productions, DNA Films');
        expect(show.country).toBe('United States, Japan');
    });

    test('mapShow usa guionistas/writers si no hay Type Creator explícito', () => {
        const itemWithWriters: JFItem = {
            ...baseItem,
            People: [
                { Name: 'Vince Gilligan', Type: 'Writer' },
                { Name: 'Peter Gould', Type: 'Writer' }
            ]
        };
        const show = mapShow(itemWithWriters);
        expect(show.creator).toBe('Vince Gilligan, Peter Gould');
    });

    test('mapMovie mapea directores múltiples correctamente', () => {
        const movieItem: JFItem = {
            ...baseItem,
            People: [
                { Name: 'Anthony Russo', Type: 'Director' },
                { Name: 'Joe Russo', Type: 'Director' }
            ]
        };
        const movie = mapMovie(movieItem);
        expect(movie.director).toBe('Anthony Russo, Joe Russo');
        expect(movie.studio).toBe('FX Productions, DNA Films');
        expect(movie.country).toBe('United States, Japan');
    });

    test('extractMediaBadges extrae correctamente 4K UHD, Dolby Vision, Atmos, 5.1 y HEVC', () => {
        const badges = extractMediaBadges([
            {
                Index: 0,
                Type: 'Video',
                Width: 3840,
                Height: 2160,
                Codec: 'hevc',
                VideoRangeType: 'DOVIWithHDR10'
            },
            {
                Index: 1,
                Type: 'Audio',
                Codec: 'truehd',
                Channels: 6,
                ChannelLayout: '5.1',
                AudioSpatialFormat: 'DolbyAtmos',
                IsDefault: true
            }
        ]);

        expect(badges).toContain('4K UHD');
        expect(badges).toContain('Dolby Vision');
        expect(badges).toContain('HEVC');
        expect(badges).toContain('Dolby Atmos');
        expect(badges).toContain('5.1');
    });

    test('extractMediaBadges extrae HDR10+, DTS-HD y 7.1', () => {
        const badges = extractMediaBadges([
            {
                Index: 0,
                Type: 'Video',
                Width: 1920,
                Height: 1080,
                Codec: 'h264',
                VideoRangeType: 'HDR10+'
            },
            {
                Index: 1,
                Type: 'Audio',
                Codec: 'dts-hd',
                Channels: 8,
                ChannelLayout: '7.1',
                IsDefault: true
            }
        ]);

        expect(badges).toContain('1080p');
        expect(badges).toContain('HDR10+');
        expect(badges).toContain('H.264');
        expect(badges).toContain('DTS-HD');
        expect(badges).toContain('7.1');
    });
});
