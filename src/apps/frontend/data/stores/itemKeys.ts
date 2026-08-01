// Claves con las que los stores locales (favoritos, "visto") identifican cada
// cosa. NO son ids de Jellyfin: una temporada o un episodio se referencian por
// su posición dentro de la serie, porque esos ids no existían cuando el
// catálogo era proto y los favoritos guardados entonces siguen valiendo.
//
//   película   movie-<movieId>
//   serie      <showId>            (el id crudo, sin prefijo)
//   temporada  <showId>-s<n>
//   episodio   <showId>-s<n>-e<m>
//
// El id de un show es un GUID hex —nunca contiene una 's' literal— así que los
// sufijos desambiguan sin chocar con el propio id.

const MOVIE_PREFIX = 'movie-';
const EPISODE_RE = /^(.+)-s(\d+)-e(\d+)$/;
const SEASON_RE = /^(.+)-s(\d+)$/;

export function movieKey(movieId: string): string {
    return `${MOVIE_PREFIX}${movieId}`;
}

export function seasonKey(showId: string, seasonN: number): string {
    return `${showId}-s${seasonN}`;
}

export function episodeKey(showId: string, seasonN: number, epN: number): string {
    return `${showId}-s${seasonN}-e${epN}`;
}

export type ParsedItemKey =
    | { kind: 'movie'; movieId: string }
    | { kind: 'episode'; showId: string; seasonN: number; epN: number }
    | { kind: 'season'; showId: string; seasonN: number }
    | { kind: 'show'; showId: string };

/**
 * Deshace una clave. Lo que no encaje en ningún patrón es una serie: es el
 * único caso sin marca propia, así que hace de cajón de sastre.
 */
export function parseItemKey(key: string): ParsedItemKey {
    if (key.startsWith(MOVIE_PREFIX)) {
        return { kind: 'movie', movieId: key.slice(MOVIE_PREFIX.length) };
    }
    const episode = EPISODE_RE.exec(key);
    if (episode) {
        const [, showId, seasonN, epN] = episode;
        return { kind: 'episode', showId, seasonN: Number(seasonN), epN: Number(epN) };
    }
    const season = SEASON_RE.exec(key);
    if (season) {
        const [, showId, seasonN] = season;
        return { kind: 'season', showId, seasonN: Number(seasonN) };
    }
    return { kind: 'show', showId: key };
}
