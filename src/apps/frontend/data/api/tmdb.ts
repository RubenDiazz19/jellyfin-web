// Fallback opcional para personajes de series/películas de imagen real que
// NO están en la biblioteca local: TMDB. Requiere una API key gratuita
// (https://www.themoviedb.org/settings/api) en `VITE_TMDB_API_KEY` — ver
// .env.example. Sin clave el servicio se queda callado: devuelve [] y no
// estorba a las demás fuentes.
//
// TMDB no indexa personajes directamente: se busca la película/serie por su
// título y los personajes salen de sus créditos (campo `character`).

import type { AvatarCandidate } from './avatars';

const API = 'https://api.themoviedb.org/3';
// h632: los tamaños de perfil de TMDB son w45/w185/h632/original, y el avatar
// final se compone a 512px — w185 se vería borroso y original puede ser enorme.
const IMG = 'https://image.tmdb.org/t/p/h632';

/** Cuántos títulos se peinan por búsqueda, y cuánto reparto de cada uno. */
const SHOWS_PER_SEARCH = 3;
const CAST_PER_SHOW = 8;

function apiKey(): string {
    return import.meta.env.VITE_TMDB_API_KEY ?? '';
}

export function isTmdbConfigured(): boolean {
    return !!apiKey();
}

type TmdbMultiResult = {
    results?: {
        id: number;
        // eslint-disable-next-line @typescript-eslint/naming-convention -- nombre fijado por la API de TMDB
        media_type?: string;
        /** Película / serie, según el tipo. */
        title?: string;
        name?: string;
    }[];
};

type TmdbCredits = {
    cast?: {
        id: number;
        name?: string;
        /** El nombre del PERSONAJE; lo que se quiere de etiqueta. */
        character?: string;
        // eslint-disable-next-line @typescript-eslint/naming-convention -- nombre fijado por la API de TMDB
        profile_path?: string | null;
    }[];
};

async function charactersOf(
    show: {
        id: number;
        // eslint-disable-next-line @typescript-eslint/naming-convention -- nombre fijado por la API de TMDB
        media_type: string;
        title: string;
    },
    key: string
): Promise<AvatarCandidate[]> {
    const res = await fetch(`${API}/${show.media_type}/${show.id}/credits?api_key=${key}`);
    if (!res.ok) throw new Error(`TMDB → HTTP ${res.status}`);
    const data: TmdbCredits = await res.json();
    return (data.cast ?? [])
        .slice(0, CAST_PER_SHOW)
        .filter((c) => c.profile_path && (c.character || c.name))
        .map((c) => ({
            id: `tmdb-${show.id}-${c.id}`,
            name: c.character || c.name || '',
            // «Título · intérprete»: el nombre grande ya es el personaje.
            subtitle: c.character ? `${show.title} · ${c.name ?? ''}` : show.title,
            imageUrl: `${IMG}${c.profile_path}`,
            source: 'tmdb' as const
        }));
}

export async function searchTmdbCharacters(term: string): Promise<AvatarCandidate[]> {
    const key = apiKey();
    if (!key) return [];
    const search = await fetch(
        `${API}/search/multi?api_key=${key}&query=${encodeURIComponent(term)}&include_adult=false`
    );
    if (!search.ok) throw new Error(`TMDB → HTTP ${search.status}`);
    const found: TmdbMultiResult = await search.json();
    const shows = (found.results ?? [])
        .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
        .slice(0, SHOWS_PER_SEARCH)
        .map((r) => ({
            id: r.id,
            // eslint-disable-next-line @typescript-eslint/naming-convention -- nombre fijado por la API de TMDB
            media_type: r.media_type as string,
            title: r.title ?? r.name ?? ''
        }));
    // Un título cuyos créditos fallen no tumba al resto.
    const groups = await Promise.all(
        shows.map((s) => charactersOf(s, key).catch(() => [] as AvatarCandidate[]))
    );
    return groups.flat();
}
