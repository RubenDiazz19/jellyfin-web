import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    fetchFanartMovieLogos,
    fetchFanartTvLogos,
    fetchFanartLogosForItem,
    fetchFanartLogosById,
    FANART_API_KEY
} from '../fanart';

vi.mock('../metadata', () => ({
    getItemRaw: vi.fn()
}));

describe('Fanart.tv API integration', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('has a valid API key configured', () => {
        expect(FANART_API_KEY).toBe('7ec2860187c2b20d6e33c32315ba9327');
    });

    it('fetchFanartMovieLogos maps hdmovielogo and movielogo correctly', async () => {
        const mockResponse = {
            name: 'The Fellowship of the Ring',
            hdmovielogo: [
                { id: '1', lang: 'es', likes: '15', url: 'https://assets.fanart.tv/fanart/lotr-hd-es.png' },
                { id: '2', lang: 'en', likes: '20', url: 'https://assets.fanart.tv/fanart/lotr-hd-en.png' }
            ],
            movielogo: [
                { id: '3', lang: '00', likes: '5', url: 'https://assets.fanart.tv/fanart/lotr-sd.png' }
            ]
        };

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse
        } as Response);

        const logos = await fetchFanartMovieLogos('120');

        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining('/movies/120?api_key=7ec2860187c2b20d6e33c32315ba9327')
        );
        expect(logos).toHaveLength(3);
        // Debe ordenar por likes desc (20 likes primero)
        expect(logos[0].Url).toBe('https://assets.fanart.tv/fanart/lotr-hd-en.png');
        expect(logos[0].ThumbnailUrl).toBe('https://assets.fanart.tv/preview/lotr-hd-en.png');
        expect(logos[0].ProviderName).toBe('Fanart.tv');
        expect(logos[0].Type).toBe('Logo');
        // Idioma '00' se mapea a string vacío (sin idioma específico)
        expect(logos[2].Language).toBe('');
    });

    it('fetchFanartTvLogos maps hdtvlogo and clearlogo correctly', async () => {
        const mockResponse = {
            name: 'Breaking Bad',
            hdtvlogo: [
                { id: '10', lang: 'es', likes: '12', url: 'https://assets.fanart.tv/fanart/bb-hd-es.png' }
            ],
            clearlogo: [
                { id: '11', lang: 'en', likes: '8', url: 'https://assets.fanart.tv/fanart/bb-clear-en.png' }
            ]
        };

        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse
        } as Response);

        const logos = await fetchFanartTvLogos('81189');

        expect(logos).toHaveLength(2);
        expect(logos[0].Url).toBe('https://assets.fanart.tv/fanart/bb-hd-es.png');
        expect(logos[0].Language).toBe('es');
    });

    it('fetchFanartLogosForItem automatically detects Series and uses TVDB ID', async () => {
        const mockItem = {
            Type: 'Series',
            ProviderIds: {
                TheTVDb: '81189',
                TheMovieDb: '1396'
            }
        };

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                hdtvlogo: [{ id: '1', lang: 'es', likes: '10', url: 'https://assets.fanart.tv/fanart/bb.png' }]
            })
        } as Response);

        const logos = await fetchFanartLogosForItem(mockItem);

        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/tv/81189?api_key='));
        expect(logos).toHaveLength(1);
    });

    it('fetchFanartLogosForItem automatically detects Movie and uses TMDB ID', async () => {
        const mockItem = {
            Type: 'Movie',
            ProviderIds: {
                TheMovieDb: '120',
                Imdb: 'tt0120737'
            }
        };

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                hdmovielogo: [{ id: '1', lang: 'es', likes: '10', url: 'https://assets.fanart.tv/fanart/lotr.png' }]
            })
        } as Response);

        const logos = await fetchFanartLogosForItem(mockItem);

        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/movies/120?api_key='));
        expect(logos).toHaveLength(1);
    });

    it('fetchFanartLogosById searches by ID', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                hdmovielogo: [{ id: '1', lang: 'en', likes: '5', url: 'https://assets.fanart.tv/fanart/id-logo.png' }]
            })
        } as Response);

        const logos = await fetchFanartLogosById('tt0120737');

        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/movies/tt0120737?api_key='));
        expect(logos).toHaveLength(1);
    });

    it('returns empty array when API returns error or empty', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
            ok: false,
            status: 404
        } as Response);

        const logos = await fetchFanartMovieLogos('99999999');
        expect(logos).toEqual([]);
    });
});
