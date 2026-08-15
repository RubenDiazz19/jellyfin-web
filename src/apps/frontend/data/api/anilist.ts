// Personajes de ANIME desde la API GraphQL pública de AniList (sin API key,
// con CORS abierto para llamadas desde el navegador).
//
// Es la fuente que de verdad devuelve el DIBUJO del personaje: en la
// biblioteca local un anime trae a los actores de doblaje como reparto, y su
// cara no sirve de avatar. AniList indexa personajes, con su artwork oficial
// y el título del que salen.

import type { AvatarCandidate } from './avatars';

const ENDPOINT = 'https://graphql.anilist.co';

// SEARCH_MATCH primero: sin él AniList ordena por favoritos globales y las
// coincidencias exactas quedan enterradas bajo los personajes populares.
const SEARCH_QUERY = `
query ($search: String, $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
        characters(search: $search, sort: [SEARCH_MATCH, FAVOURITES_DESC]) {
            id
            name { full }
            image { large }
            media(perPage: 1, sort: POPULARITY_DESC) {
                nodes { title { romaji english } }
            }
        }
    }
}`;

type AniListResponse = {
    data?: {
        Page?: {
            characters?: {
                id: number;
                name?: { full?: string };
                image?: { large?: string };
                media?: { nodes?: { title?: { romaji?: string; english?: string } }[] };
            }[];
        };
    };
    errors?: { message: string }[];
};

const SEARCH_LIMIT = 16;

/**
 * Personajes cuyo nombre (o el título de su serie) casa con el texto.
 * Lanza en cualquier fallo —HTTP o `errors` de GraphQL—: quien llama tiene
 * otras fuentes y decide si el hueco se nota.
 */
export async function searchAniListCharacters(term: string): Promise<AvatarCandidate[]> {
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
            query: SEARCH_QUERY,
            variables: { search: term, perPage: SEARCH_LIMIT }
        })
    });
    const body: AniListResponse = await res.json().catch(() => ({}));
    // AniList contesta 200 con `errors` cuando la query no le vale, y 4xx/5xx
    // con rate limit o caída: para el llamante ambas son «esta fuente falla».
    if (!res.ok || body.errors?.length) {
        throw new Error(`AniList → HTTP ${res.status}`);
    }
    return (body.data?.Page?.characters ?? [])
        .filter((c) => c.image?.large && c.name?.full)
        .map((c) => ({
            id: `ani-${c.id}`,
            name: c.name?.full ?? '',
            subtitle: c.media?.nodes?.[0]?.title?.english
                ?? c.media?.nodes?.[0]?.title?.romaji
                ?? '',
            imageUrl: c.image?.large ?? '',
            source: 'anilist' as const
        }));
}
