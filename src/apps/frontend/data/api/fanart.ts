// Servicio de integración con Fanart.tv para búsqueda de logos oficiales (clearlogo / hdlogo)
// para películas, colecciones y series de televisión.

import type { JFRemoteImage } from './remote-images';
import { getItemRaw, type JFRawItem } from './metadata';

export const FANART_API_KEY =
    (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_FANART_API_KEY)
    || '7ec2860187c2b20d6e33c32315ba9327';

const FANART_BASE = 'https://webservice.fanart.tv/v3';

export type FanartLogoItem = {
    id: string;
    url: string;
    lang: string;
    likes: string;
};

export type FanartMovieResponse = {
    name?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    tmdb_id?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    imdb_id?: string;
    hdmovielogo?: FanartLogoItem[];
    movielogo?: FanartLogoItem[];
};

export type FanartTvResponse = {
    name?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    thetvdb_id?: string;
    hdtvlogo?: FanartLogoItem[];
    clearlogo?: FanartLogoItem[];
};

function mapFanartLogo(item: FanartLogoItem, isHd: boolean): JFRemoteImage {
    return {
        Url: item.url,
        // Fanart.tv ofrece miniaturas ultrarrápidas sustituyendo /fanart/ por /preview/
        ThumbnailUrl: item.url.replace('/fanart/', '/preview/'),
        Width: isHd ? 800 : 400,
        Height: isHd ? 310 : 155,
        Language: item.lang === '00' ? '' : item.lang,
        CommunityRating: Number(item.likes) || 0,
        VoteCount: Number(item.likes) || 0,
        ProviderName: 'Fanart.tv',
        Type: 'Logo'
    };
}

/**
 * Ordena logos por cantidad de votos/likes descendente, desduplicando URLs idénticas.
 */
function sortFanartLogos(logos: JFRemoteImage[]): JFRemoteImage[] {
    const seen = new Set<string>();
    const unique: JFRemoteImage[] = [];
    for (const logo of logos) {
        if (!seen.has(logo.Url)) {
            seen.add(logo.Url);
            unique.push(logo);
        }
    }
    return unique.sort((a, b) => (b.CommunityRating ?? 0) - (a.CommunityRating ?? 0));
}

/**
 * Obtiene los logos de una película o colección desde Fanart.tv mediante su ID de TMDB o IMDb.
 */
export async function fetchFanartMovieLogos(id: string): Promise<JFRemoteImage[]> {
    if (!id || !FANART_API_KEY) return [];
    try {
        const res = await fetch(`${FANART_BASE}/movies/${encodeURIComponent(id)}?api_key=${FANART_API_KEY}`);
        if (!res.ok) return [];
        const data: FanartMovieResponse = await res.json();
        const results: JFRemoteImage[] = [];

        // Los logos HD tienen prioridad
        if (Array.isArray(data.hdmovielogo)) {
            for (const l of data.hdmovielogo) {
                if (l.url) results.push(mapFanartLogo(l, true));
            }
        }
        if (Array.isArray(data.movielogo)) {
            for (const l of data.movielogo) {
                if (l.url) results.push(mapFanartLogo(l, false));
            }
        }

        return sortFanartLogos(results);
    } catch {
        return [];
    }
}

/**
 * Obtiene los logos de una serie de televisión desde Fanart.tv mediante su ID de TheTVDB.
 */
export async function fetchFanartTvLogos(tvdbId: string): Promise<JFRemoteImage[]> {
    if (!tvdbId || !FANART_API_KEY) return [];
    try {
        const res = await fetch(`${FANART_BASE}/tv/${encodeURIComponent(tvdbId)}?api_key=${FANART_API_KEY}`);
        if (!res.ok) return [];
        const data: FanartTvResponse = await res.json();
        const results: JFRemoteImage[] = [];

        if (Array.isArray(data.hdtvlogo)) {
            for (const l of data.hdtvlogo) {
                if (l.url) results.push(mapFanartLogo(l, true));
            }
        }
        if (Array.isArray(data.clearlogo)) {
            for (const l of data.clearlogo) {
                if (l.url) results.push(mapFanartLogo(l, false));
            }
        }

        return sortFanartLogos(results);
    } catch {
        return [];
    }
}

/**
 * Obtiene automáticamente los logos de Fanart.tv correspondientes a un elemento de Jellyfin,
 * inspeccionando sus ProviderIds (TheTVDb, TheMovieDb, Imdb) y tipo de contenido.
 */
export async function fetchFanartLogosForItem(item: JFRawItem): Promise<JFRemoteImage[]> {
    if (!item) return [];

    let providerIds = item.ProviderIds || {};

    // Si es un episodio o temporada sin IDs propios, buscar los de la serie padre
    if ((!providerIds.TheTVDb && !providerIds.Tvdb && !providerIds.TheMovieDb && !providerIds.Imdb) && item.SeriesId) {
        try {
            const seriesItem = await getItemRaw(item.SeriesId as string);
            if (seriesItem?.ProviderIds) {
                providerIds = seriesItem.ProviderIds;
            }
        } catch {
            // Silencioso
        }
    }

    const tvdbId = providerIds.TheTVDb || providerIds.Tvdb || providerIds.thetvdb;
    const tmdbId = providerIds.TheMovieDb || providerIds.Tmdb || providerIds.themoviedb;
    const imdbId = providerIds.Imdb || providerIds.imdb;

    const isTv = item.Type === 'Series' || item.Type === 'Season' || item.Type === 'Episode';

    if (isTv && tvdbId) {
        const tvLogos = await fetchFanartTvLogos(tvdbId);
        if (tvLogos.length > 0) return tvLogos;
    }

    // Para películas, colecciones (BoxSet) o si es serie y se tiene TMDB/IMDb
    if (tmdbId) {
        const movieLogos = await fetchFanartMovieLogos(tmdbId);
        if (movieLogos.length > 0) return movieLogos;
    }

    if (imdbId) {
        const movieLogos = await fetchFanartMovieLogos(imdbId);
        if (movieLogos.length > 0) return movieLogos;
    }

    // Si no se clasificó como TV pero tiene TVDB id, intentar TV
    if (tvdbId) {
        return fetchFanartTvLogos(tvdbId);
    }

    return [];
}

/**
 * Búsqueda manual por ID (útil para items no identificados donde el usuario introduce el ID).
 */
export async function fetchFanartLogosById(id: string, kind?: 'movie' | 'tv'): Promise<JFRemoteImage[]> {
    const trimmed = id.trim();
    if (!trimmed) return [];

    if (kind === 'tv') {
        return fetchFanartTvLogos(trimmed);
    }
    if (kind === 'movie' || trimmed.startsWith('tt')) {
        return fetchFanartMovieLogos(trimmed);
    }

    // Si no se especifica, probar primero película/colección y luego serie
    const movieResults = await fetchFanartMovieLogos(trimmed);
    if (movieResults.length > 0) return movieResults;

    return fetchFanartTvLogos(trimmed);
}
