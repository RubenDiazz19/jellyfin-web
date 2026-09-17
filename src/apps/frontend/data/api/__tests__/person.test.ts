import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPersonMetadata, calculateAge, resolveCountry } from '../person';
import * as httpModule from '../http';
import * as sessionModule from '../../session/session';

vi.mock('../http');
vi.mock('../../session/session');

describe('person API', () => {
    let globalFetch: any;

    beforeEach(() => {
        globalFetch = vi.fn();
        vi.stubGlobal('fetch', globalFetch);
        vi.stubEnv('VITE_TMDB_API_KEY', 'my-key');
        vi.mocked(sessionModule.loadSession).mockReturnValue({ userId: 'u1' } as any);
        vi.clearAllMocks();
    });

    describe('calculateAge', () => {
        it('calculates age correctly', () => {
            const currentYear = new Date().getFullYear();
            expect(calculateAge('2000-01-01', '2010-01-01')).toBe(10);
            expect(calculateAge('2000-01-01', null)).toBeGreaterThanOrEqual(currentYear - 2000 - 1); // rough estimation
            expect(calculateAge(null)).toBeNull();
        });
    });

    describe('resolveCountry', () => {
        it('resolves standard names', () => {
            expect(resolveCountry('españa')).toEqual({ code: 'es', name: 'España' });
            expect(resolveCountry('united states of america')).toEqual({ code: 'us', name: 'EE. UU.' });
            expect(resolveCountry('london, england, uk')).toEqual({ code: 'gb', name: 'Reino Unido' });
        });

        it('falls back to capitalized name for unknown', () => {
            expect(resolveCountry('Unknown City, Mars')).toEqual({ code: '', name: 'Mars' });
        });
    });

    describe('getPersonMetadata', () => {
        it('consolidates from Jellyfin, Wiki, TMDB, and Wikidata', async () => {
            // JF mock
            vi.mocked(httpModule.apiFetch).mockResolvedValueOnce({
                Id: 'jf1', ProviderIds: { Tmdb: '123' }, PremiereDate: '1980-01-01T00:00:00Z', PrimaryImageTag: 'tag1', ProductionLocations: ['London, UK']
            });

            globalFetch.mockImplementation(async (url: string) => {
                if (url.includes('wikipedia.org')) {
                    return {
                        ok: true,
                        // eslint-disable-next-line @typescript-eslint/naming-convention -- formato de la API de Wikipedia
                        json: async () => ({ extract: 'Wiki bio', wikibase_item: 'Q1' })
                    };
                }
                if (url.includes('api.themoviedb.org/3/person/123')) {
                    return {
                        ok: true,
                        json: async () => ({
                            id: 123,
                            birthday: '1980-01-01',
                            // eslint-disable-next-line @typescript-eslint/naming-convention -- formato de la API de TMDB
                            place_of_birth: 'London, UK',
                            biography: 'TMDB bio'
                        })
                    };
                }
                if (url.includes('wikidata.org') && url.includes('Q1')) {
                    return {
                        ok: true,
                        json: async () => ({
                            entities: {
                                'Q1': {
                                    claims: {
                                        'P21': [{ mainsnak: { datavalue: { value: { id: 'Q6581072' } } } }]
                                    }
                                }
                            }
                        })
                    };
                }
                return { ok: false, json: async () => ({}) };
            });

            const meta = await getPersonMetadata('Actor Name');

            expect(meta.name).toBe('Actor Name');
            expect(meta.birthDate).toBe('1980-01-01');
            expect(meta.bio).toBe('Wiki bio');
            expect(meta.gender).toBe('Mujer'); // From wikidata Q6581072
            expect(meta.countryCode).toBe('gb'); // Resolved from London, UK
        });
    });
});
