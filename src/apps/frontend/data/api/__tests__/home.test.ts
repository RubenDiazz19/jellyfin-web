import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    apiFetch: vi.fn(),
    loadSession: vi.fn(() => ({ userId: 'u1' }))
}));

vi.mock('../http', () => ({
    apiFetch: mocks.apiFetch,
    noSessionError: () => new Error('sin sesión')
}));

vi.mock('../session/session', () => ({ loadSession: mocks.loadSession }));
vi.mock('../../session/session', () => ({ loadSession: mocks.loadSession }));
vi.mock('../playback', () => ({ settlePlaybackReports: () => Promise.resolve() }));

import { getHomeCarousel, getResume } from '../home';
import { invalidateLists } from '../listCache';
import { WATCHED } from '../../stores/watchedStore';

beforeEach(() => {
    vi.clearAllMocks();
    WATCHED._reset();
    invalidateLists();
});

describe('home API - reglas de exclusión y estado de visualización', () => {
    describe('getResume (Seguir viendo)', () => {
        test('solo incluye contenido con progreso activo entre 1% y 95%', async () => {
            mocks.apiFetch.mockResolvedValueOnce({
                Items: [
                    {
                        Id: 'ep1',
                        SeriesId: 's1',
                        SeriesName: 'Serie Activa',
                        Name: 'Episodio 1',
                        RunTimeTicks: 36000000000,
                        UserData: { PlayedPercentage: 50, PlaybackPositionTicks: 18000000000 }
                    },
                    {
                        Id: 'ep2',
                        SeriesId: 's2',
                        SeriesName: 'Serie Muy Inicio',
                        Name: 'Episodio 1',
                        RunTimeTicks: 36000000000,
                        UserData: { PlayedPercentage: 0.5, PlaybackPositionTicks: 180000000 }
                    },
                    {
                        Id: 'ep3',
                        SeriesId: 's3',
                        SeriesName: 'Serie Casi Terminada',
                        Name: 'Episodio 1',
                        RunTimeTicks: 36000000000,
                        UserData: { PlayedPercentage: 96, PlaybackPositionTicks: 34560000000 }
                    },
                    {
                        Id: 'm1',
                        Name: 'Pelicula Terminada',
                        Type: 'Movie',
                        RunTimeTicks: 72000000000,
                        UserData: { Played: true, PlayedPercentage: 100 }
                    },
                    {
                        Id: 'm2',
                        Name: 'Pelicula Activa',
                        Type: 'Movie',
                        RunTimeTicks: 72000000000,
                        UserData: { PlayedPercentage: 35, PlaybackPositionTicks: 25200000000 }
                    }
                ]
            });

            const resume = await getResume(12);

            expect(resume).toHaveLength(2);
            expect(resume[0].id).toBe('s1');
            expect(resume[0].progress).toBe(0.5);
            expect(resume[1].id).toBe('m2');
            expect(resume[1].progress).toBe(0.35);
        });
    });

    describe('getHomeCarousel (Hero)', () => {
        test('solo elige elementos del catálogo con estado de visualización en 0%', async () => {
            mocks.apiFetch.mockImplementation(async (url: string) => {
                if (url.includes('Resume')) {
                    return {
                        Items: [
                            {
                                Id: 'ep_cw',
                                SeriesId: 's_en_progreso',
                                SeriesName: 'En Progreso',
                                Name: 'Ep 1',
                                UserData: { PlayedPercentage: 40 }
                            }
                        ]
                    };
                }
                if (url.includes('IncludeItemTypes=Series')) {
                    return [
                        {
                            Id: 's_en_progreso',
                            Name: 'En Progreso',
                            Type: 'Series',
                            UserData: { PlayedPercentage: 40 }
                        },
                        {
                            Id: 's_vista',
                            Name: 'Serie Vista',
                            Type: 'Series',
                            UserData: { Played: true, PlayedPercentage: 100 }
                        },
                        {
                            Id: 's_nueva',
                            Name: 'Serie Nueva Intacta',
                            Type: 'Series',
                            UserData: { Played: false, PlayedPercentage: 0 }
                        }
                    ];
                }
                if (url.includes('IncludeItemTypes=Movie')) {
                    return [
                        {
                            Id: 'm_a_medias',
                            Name: 'Peli A Medias',
                            Type: 'Movie',
                            UserData: { PlayedPercentage: 20 }
                        },
                        {
                            Id: 'm_nueva',
                            Name: 'Peli Nueva Intacta',
                            Type: 'Movie',
                            UserData: { Played: false }
                        }
                    ];
                }
                return [];
            });

            const slides = await getHomeCarousel();

            expect(slides).toHaveLength(2);
            expect(slides.map((s) => s.id)).toEqual(['s_nueva', 'm_nueva']);
            expect(slides.every((s) => s.type === 'new')).toBe(true);
            expect(slides.every((s) => s.progress === null)).toBe(true);
        });
    });
});
