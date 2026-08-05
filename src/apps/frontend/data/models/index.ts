// Domain models shared across data + presentation layers.
// Data lives in Jellyfin; PROTO_DATA is kept as an empty fallback singleton
// so unauthenticated pages don't crash while accessing collections.

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
    // Id real del server (para markPlayed a nivel de temporada).
    jfId?: string;
};

export type Show = {
    id: string;
    title: string;
    year: number;
    runtime: string;
    rating: Rating;
    genres: string[];
    /** Etiquetas del servidor. Ocultas en las tarjetas: solo filtran y ordenan. */
    tags?: string[];
    /**
     * Etiquetas del vocabulario cerrado, generadas por `bun run autotag`.
     * Aparte de `tags` a propósito: viven en un JSON local, no en el servidor,
     * y así el diálogo de etiquetas no puede subirlas sin querer.
     */
    autoTags?: string[];
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
    /**
     * Progreso agregado de la serie en 0..1, según el servidor. 1 = vista
     * entera. Es lo que hidrata la clave de serie del store local (ver
     * `hydrateShowWatched`), igual que `Movie.watched` hace con la suya.
     */
    watched?: number;
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
    /** Etiquetas del servidor. Ocultas en las tarjetas: solo filtran y ordenan. */
    tags?: string[];
    /**
     * Etiquetas del vocabulario cerrado, generadas por `bun run autotag`.
     * Aparte de `tags` a propósito: viven en un JSON local, no en el servidor,
     * y así el diálogo de etiquetas no puede subirlas sin querer.
     */
    autoTags?: string[];
    director: string;
    studio: string;
    country: string;
    premiere: string;
    cast: CastMember[];
    synopsis: string;
    watched?: number;
    remaining?: string;
    backdrop?: string;
    backdrops?: string[];
    poster?: string;
    logo?: string | null;
};

/**
 * Lo que una tarjeta necesita saber de un título, sea serie o película.
 *
 * Existe para que la capa de presentación no tenga que depender del tipo
 * concreto de cada ViewModel: `Show`, `Movie` y los resultados de la búsqueda
 * lo cumplen sin más, así que una tarjeta puede pintar cualquiera de los tres
 * sin conocer de dónde salen.
 */
export type CatalogItem = {
    id: string;
    title: string;
    kind: 'show' | 'movie';
    year: number;
    poster?: string;
    backdrop?: string;
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
    // Todos los fondos del item (con tag), para que el hero rote entre ellos
    // y refleje los cambios de imagen hechos en la ficha.
    backdrops?: string[];
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

export const findSeason = (show: Show | undefined, seasonN: number | string): Season | null => {
    if (!show?.seasons) return null;
    return show.seasons.find((s) => s.n === Number(seasonN)) || null;
};
