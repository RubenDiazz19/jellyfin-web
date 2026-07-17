// Domain models shared across data + presentation layers.
// Data lives in Jellyfin; PROTO_DATA is kept as an empty fallback singleton
// so unauthenticated pages don't crash while accessing collections.

import { useState } from 'react';

export type Rating = { imdb: number; rt: number; age: string };
export type CastMember = { name: string; role: string; photo?: string | null };

export type Episode = {
    n: number;
    title?: string;
    date?: string;
    runtime?: number;
    synopsis?: string;
    thumb?: string;
    thumbHD?: string;
    watched: number;
    current?: boolean;
    jfId?: string;
    video?: string;
    audio?: string;
    subtitles?: string;
    container?: string;
};

export type Season = {
    n: number;
    year?: number | string;
    total: number;
    watched: number;
    synopsis?: string;
    backdrop?: string;
    episodes: Episode[];
};

export type Show = {
    id: string;
    title: string;
    year: number;
    runtime: string;
    rating: Rating;
    genres: string[];
    creator: string;
    directors: string;
    studio: string;
    country: string;
    premiere: string;
    status: string;
    cast: CastMember[];
    synopsis: string;
    defaultSeason: number;
    cont: { seasonN: number; epN: number; progress: number; remaining: string };
    seasons: Season[];
    backdrop?: string;
    backdrops?: string[];
    poster?: string;
    logo?: string | null;
};

export type Movie = {
    id: string;
    title: string;
    year: number;
    runtime: string;
    rating: Rating;
    genres: string[];
    director: string;
    studio: string;
    country: string;
    premiere: string;
    cast: CastMember[];
    synopsis: string;
    watched?: number;
    remaining?: string;
    backdrop?: string;
    poster?: string;
    logo?: string | null;
};

export type CarouselSlide = {
    type: 'continue' | 'new';
    id: string;
    kind: string;
    title: string;
    season: number | null;
    episode: number | null;
    episodeTitle: string;
    year: number;
    progress: number | null;
    remaining: string;
    backdrop: string;
    poster: string;
    logo?: string | null;
    jfEpisodeId?: string;
    positionTicks?: number;
};

export type ProtoData = {
    shows: Record<string, Show>;
    movies: Record<string, Movie>;
    carousel: CarouselSlide[];
};

export const PROTO_DATA: ProtoData = { shows: {}, movies: {}, carousel: [] };

// Legacy hook kept as identity: pages read from PROTO_DATA as a fallback while
// the Jellyfin API is not authenticated. It used to subscribe to a TMDb hydrate
// event that no longer fires.
export function useProtoData(): ProtoData {
    useState(0);
    return PROTO_DATA;
}

export const findSeason = (show: Show | undefined, seasonN: number | string): Season | null => {
    if (!show?.seasons) return null;
    return show.seasons.find((s) => s.n === Number(seasonN)) || null;
};
