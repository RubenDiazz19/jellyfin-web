import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchAniListCharacters } from '../anilist';

describe('anilist API', () => {
    let globalFetch: any;

    beforeEach(() => {
        globalFetch = vi.fn();
        vi.stubGlobal('fetch', globalFetch);
    });

    it('searches characters and maps them to AvatarCandidate', async () => {
        globalFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                data: {
                    Page: {
                        characters: [
                            {
                                id: 123,
                                name: { full: 'Char 1' },
                                image: { large: 'http://img1' },
                                media: { nodes: [{ title: { english: 'Anime 1' } }] }
                            },
                            {
                                id: 456,
                                name: { full: 'Char 2' },
                                image: { large: 'http://img2' },
                                media: { nodes: [{ title: { romaji: 'Anime 2' } }] }
                            }
                        ]
                    }
                }
            })
        });

        const res = await searchAniListCharacters('char');
        expect(res).toHaveLength(2);
        expect(res[0].id).toBe('ani-123');
        expect(res[0].name).toBe('Char 1');
        expect(res[0].subtitle).toBe('Anime 1');
        expect(res[0].imageUrl).toBe('http://img1');
        expect(res[0].source).toBe('anilist');

        expect(res[1].subtitle).toBe('Anime 2');
    });

    it('filters out results without image or name', async () => {
        globalFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                data: {
                    Page: {
                        characters: [
                            { id: 1, name: { full: 'No Img' } },
                            { id: 2, image: { large: 'http://img2' } }
                        ]
                    }
                }
            })
        });

        const res = await searchAniListCharacters('char');
        expect(res).toHaveLength(0);
    });

    it('throws error on network failure or graphql errors', async () => {
        globalFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
        await expect(searchAniListCharacters('char')).rejects.toThrow('AniList → HTTP 500');

        globalFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ errors: [{ message: 'Bad request' }] })
        });
        await expect(searchAniListCharacters('char')).rejects.toThrow('AniList → HTTP undefined'); // When status is undefined / fallback
    });
});
