// Rutas del app. Este frontend sustituye al modern/legacy oficial, así que
// vive directamente en la raíz del hash router: no hay prefijo que añadir o
// retirar. Se conservan toAppPath/fromAppPath como identidad para no tocar
// los callsites de App.tsx.

export function toAppPath(inner: string): string {
    if (!inner.startsWith('/')) inner = '/' + inner;
    return inner;
}

export function fromAppPath(fullPath: string): string {
    return fullPath || '/';
}

export type Route =
  | { page: 'home' }
  | { page: 'series' }
  | { page: 'movies' }
  | { page: 'favorites' }
  | { page: 'show'; showId: string }
  | { page: 'season'; showId: string; seasonN: number }
  | { page: 'episode'; showId: string; seasonN: number; epN: number }
  | { page: 'movie'; movieId: string }
  | { page: 'search' }
  | { page: 'genre'; genre: string }
  | { page: 'person'; name: string }
  | { page: 'settings' }
  | { page: 'profile' }
  | { page: 'queue' };

export type Navigate = (r: Route) => void;

// Serialización Route → URL. La usamos al hacer pushState.
export function routeToPath(r: Route): string {
    switch (r.page) {
        case 'home': return '/';
        case 'series': return '/series';
        case 'movies': return '/movies';
        case 'favorites': return '/favorites';
        case 'show': return `/show/${encodeURIComponent(r.showId)}`;
        case 'season': return `/show/${encodeURIComponent(r.showId)}/season/${r.seasonN}`;
        case 'episode': return `/show/${encodeURIComponent(r.showId)}/season/${r.seasonN}/episode/${r.epN}`;
        case 'movie': return `/movie/${encodeURIComponent(r.movieId)}`;
        case 'search': return '/search';
        case 'genre': return `/genre/${encodeURIComponent(r.genre)}`;
        case 'person': return `/person/${encodeURIComponent(r.name)}`;
        case 'settings': return '/settings';
        case 'profile': return '/profile';
        case 'queue': return '/queue';
    }
}

// Deserialización URL → Route. La usamos al arrancar y en popstate para
// interpretar la URL actual del navegador. Cualquier URL desconocida cae a
// la Home.
export function pathToRoute(pathname: string): Route {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return { page: 'home' };

    const [head, ...rest] = parts;
    switch (head) {
        case 'series': return { page: 'series' };
        case 'movies': return { page: 'movies' };
        case 'favorites': return { page: 'favorites' };
        case 'search': return { page: 'search' };
        case 'settings': return { page: 'settings' };
        case 'profile': return { page: 'profile' };
        case 'queue': return { page: 'queue' };

        case 'show': {
            const [showId, kw1, seasonS, kw2, epS] = rest;
            if (!showId) return { page: 'home' };
            if (kw1 === 'season' && seasonS) {
                const seasonN = Number(seasonS);
                if (kw2 === 'episode' && epS) {
                    const epN = Number(epS);
                    if (Number.isFinite(seasonN) && Number.isFinite(epN)) {
                        return { page: 'episode', showId: decodeURIComponent(showId), seasonN, epN };
                    }
                }
                if (Number.isFinite(seasonN)) {
                    return { page: 'season', showId: decodeURIComponent(showId), seasonN };
                }
            }
            return { page: 'show', showId: decodeURIComponent(showId) };
        }

        case 'movie': {
            const [movieId] = rest;
            if (!movieId) return { page: 'home' };
            return { page: 'movie', movieId: decodeURIComponent(movieId) };
        }

        case 'genre': {
            const [genre] = rest;
            if (!genre) return { page: 'home' };
            return { page: 'genre', genre: decodeURIComponent(genre) };
        }

        case 'person': {
            const [name] = rest;
            if (!name) return { page: 'home' };
            return { page: 'person', name: decodeURIComponent(name) };
        }

        default:
            return { page: 'home' };
    }
}
