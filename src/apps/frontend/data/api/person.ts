// Metadatos consolidados de personas (actores, directores, creadores).
// Cruza en cascada Jellyfin (/Persons/{name}), TMDB y Wikipedia REST API
// para garantizar datos reales de fecha de nacimiento/defunción, edad, lugar de
// nacimiento, biografía y enlaces externos sin depender de SPARQL ni bloquearse.

import { loadSession } from '../session/session';
import { apiFetch, trimSlash } from './http';

export type PersonMetadata = {
    name: string;
    birthDate?: string | null;
    deathDate?: string | null;
    age?: number | null;
    isDeceased?: boolean;
    gender?: string | null;
    placeOfBirth?: string | null;
    country?: string | null;
    countryCode?: string | null;
    bio?: string | null;
    description?: string | null;
    photo?: string | null;
    imdbId?: string | null;
    tmdbId?: string | null;
    wikiUrl?: string | null;
};

type CountryInfo = { code: string; name: string };

const COUNTRY_MAP: Record<string, CountryInfo> = {
    'united states': { code: 'us', name: 'EE. UU.' },
    'united states of america': { code: 'us', name: 'EE. UU.' },
    'usa': { code: 'us', name: 'EE. UU.' },
    'estados unidos': { code: 'us', name: 'EE. UU.' },
    'ee. uu.': { code: 'us', name: 'EE. UU.' },
    'eeuu': { code: 'us', name: 'EE. UU.' },
    'united kingdom': { code: 'gb', name: 'Reino Unido' },
    'great britain': { code: 'gb', name: 'Reino Unido' },
    'uk': { code: 'gb', name: 'Reino Unido' },
    'reino unido': { code: 'gb', name: 'Reino Unido' },
    'england': { code: 'gb', name: 'Reino Unido' },
    'inglaterra': { code: 'gb', name: 'Reino Unido' },
    'scotland': { code: 'gb', name: 'Reino Unido' },
    'escocia': { code: 'gb', name: 'Reino Unido' },
    'wales': { code: 'gb', name: 'Reino Unido' },
    'gales': { code: 'gb', name: 'Reino Unido' },
    'spain': { code: 'es', name: 'España' },
    'españa': { code: 'es', name: 'España' },
    'mexico': { code: 'mx', name: 'México' },
    'méxico': { code: 'mx', name: 'México' },
    'argentina': { code: 'ar', name: 'Argentina' },
    'chile': { code: 'cl', name: 'Chile' },
    'colombia': { code: 'co', name: 'Colombia' },
    'france': { code: 'fr', name: 'Francia' },
    'francia': { code: 'fr', name: 'Francia' },
    'germany': { code: 'de', name: 'Alemania' },
    'alemania': { code: 'de', name: 'Alemania' },
    'italy': { code: 'it', name: 'Italia' },
    'italia': { code: 'it', name: 'Italia' },
    'canada': { code: 'ca', name: 'Canadá' },
    'canadá': { code: 'ca', name: 'Canadá' },
    'australia': { code: 'au', name: 'Australia' },
    'japan': { code: 'jp', name: 'Japón' },
    'japon': { code: 'jp', name: 'Japón' },
    'japón': { code: 'jp', name: 'Japón' },
    'south korea': { code: 'kr', name: 'Corea del Sur' },
    'korea, south': { code: 'kr', name: 'Corea del Sur' },
    'republic of korea': { code: 'kr', name: 'Corea del Sur' },
    'corea del sur': { code: 'kr', name: 'Corea del Sur' },
    'china': { code: 'cn', name: 'China' },
    'india': { code: 'in', name: 'India' },
    'brazil': { code: 'br', name: 'Brasil' },
    'brasil': { code: 'br', name: 'Brasil' },
    'ireland': { code: 'ie', name: 'Irlanda' },
    'irlanda': { code: 'ie', name: 'Irlanda' },
    'sweden': { code: 'se', name: 'Suecia' },
    'suecia': { code: 'se', name: 'Suecia' },
    'norway': { code: 'no', name: 'Noruega' },
    'noruega': { code: 'no', name: 'Noruega' },
    'denmark': { code: 'dk', name: 'Dinamarca' },
    'dinamarca': { code: 'dk', name: 'Dinamarca' },
    'new zealand': { code: 'nz', name: 'Nueva Zelanda' },
    'nueva zelanda': { code: 'nz', name: 'Nueva Zelanda' },
    'austria': { code: 'at', name: 'Austria' },
    'belgium': { code: 'be', name: 'Bélgica' },
    'bélgica': { code: 'be', name: 'Bélgica' },
    'netherlands': { code: 'nl', name: 'Países Bajos' },
    'países bajos': { code: 'nl', name: 'Países Bajos' },
    'holanda': { code: 'nl', name: 'Países Bajos' },
    'poland': { code: 'pl', name: 'Polonia' },
    'polonia': { code: 'pl', name: 'Polonia' },
    'portugal': { code: 'pt', name: 'Portugal' },
    'russia': { code: 'ru', name: 'Rusia' },
    'rusia': { code: 'ru', name: 'Rusia' },
    'cuba': { code: 'cu', name: 'Cuba' },
    'uruguay': { code: 'uy', name: 'Uruguay' },
    'venezuela': { code: 've', name: 'Venezuela' },
    'peru': { code: 'pe', name: 'Perú' },
    'perú': { code: 'pe', name: 'Perú' },
    'south africa': { code: 'za', name: 'Sudáfrica' },
    'sudáfrica': { code: 'za', name: 'Sudáfrica' },
    'greece': { code: 'gr', name: 'Grecia' },
    'grecia': { code: 'gr', name: 'Grecia' },
    'turkey': { code: 'tr', name: 'Turquía' },
    'turquía': { code: 'tr', name: 'Turquía' },
    'israel': { code: 'il', name: 'Israel' },
    'hong kong': { code: 'hk', name: 'Hong Kong' },
    'taiwan': { code: 'tw', name: 'Taiwán' },
    'taiwán': { code: 'tw', name: 'Taiwán' },
    'puerto rico': { code: 'pr', name: 'Puerto Rico' }
};

/** Resuelve país y código ISO a partir de una cadena de ubicación o nacionalidad. */
export function resolveCountry(rawLocation?: string | null): CountryInfo | null {
    if (!rawLocation) return null;
    const clean = rawLocation.trim().toLowerCase();

    // 1. Coincidencia exacta
    if (COUNTRY_MAP[clean]) return COUNTRY_MAP[clean];

    // 2. Si es una lista separada por comas (ej. "London, England, UK" o "Burnley, United Kingdom")
    const parts = clean.split(',').map((p) => p.trim());
    for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i];
        if (COUNTRY_MAP[part]) return COUNTRY_MAP[part];
    }

    // 3. Búsqueda de subcadena en las claves conocidas
    for (const [key, info] of Object.entries(COUNTRY_MAP)) {
        if (clean.includes(key)) return info;
    }

    // Fallback con el último segmento capitalizado si no se encontró código
    const fallbackName = parts[parts.length - 1] || rawLocation;
    return {
        code: '',
        name: fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1)
    };
}

export function calculateAge(birth?: string | null, death?: string | null): number | null {
    if (!birth) return null;
    const b = new Date(birth);
    if (isNaN(b.getTime())) return null;
    const end = death ? new Date(death) : new Date();
    if (isNaN(end.getTime())) return null;
    let age = end.getFullYear() - b.getFullYear();
    const m = end.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && end.getDate() < b.getDate())) {
        age--;
    }
    return age >= 0 && age < 130 ? age : null;
}

type JFPersonDto = {
    Id?: string;
    Name?: string;
    Overview?: string;
    PremiereDate?: string;
    EndDate?: string;
    ProductionLocations?: string[];
    ProviderIds?: Record<string, string>;
    PrimaryImageTag?: string;
};

type WikiSummary = {
    title?: string;
    extract?: string;
    description?: string;
    originalimage?: { source?: string };
    thumbnail?: { source?: string };
    // eslint-disable-next-line @typescript-eslint/naming-convention -- formato de la API de Wikipedia
    content_urls?: { desktop?: { page?: string } };
    // eslint-disable-next-line @typescript-eslint/naming-convention -- QID de Wikidata, presente en la respuesta de la REST API de Wikipedia
    wikibase_item?: string;
};

type WikidataPersonData = {
    birthDate?: string | null;
    deathDate?: string | null;
    placeOfBirth?: string | null;
    countryCode?: string | null;
    gender?: string | null;
};

type TmdbPersonResponse = {
    id?: number;
    birthday?: string | null;
    deathday?: string | null;
    gender?: number | null;
    // eslint-disable-next-line @typescript-eslint/naming-convention -- formato de la API de TMDB
    place_of_birth?: string | null;
    biography?: string;
    // eslint-disable-next-line @typescript-eslint/naming-convention -- formato de la API de TMDB
    profile_path?: string | null;
    // eslint-disable-next-line @typescript-eslint/naming-convention -- formato de la API de TMDB
    imdb_id?: string | null;
    // eslint-disable-next-line @typescript-eslint/naming-convention -- formato de la API de TMDB
    known_for_department?: string;
};

function tmdbApiKey(): string {
    return (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_TMDB_API_KEY ?? '';
}

/**
 * Consulta la API de Jellyfin para la persona.
 */
async function fetchJellyfinPerson(name: string): Promise<JFPersonDto | null> {
    try {
        const session = loadSession();
        if (!session?.userId) return null;
        return await apiFetch<JFPersonDto>(
            `/Persons/${encodeURIComponent(name)}?userId=${session.userId}&fields=ProviderIds,PremiereDate,EndDate,ProductionLocations,Overview,PrimaryImageTag`
        );
    } catch {
        return null;
    }
}

/**
 * Consulta la API de TMDB (si hay clave configurada o id directo).
 */
async function fetchTmdbPerson(name: string, tmdbId?: string): Promise<TmdbPersonResponse | null> {
    const key = tmdbApiKey();
    if (!key) return null;
    try {
        let id = tmdbId;
        if (!id) {
            const searchRes = await fetch(
                `https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(name)}&api_key=${key}&language=es-ES`
            );
            if (!searchRes.ok) return null;
            const searchData = await searchRes.json();
            const first = searchData.results?.[0];
            if (first?.id) id = String(first.id);
        }
        if (!id) return null;

        const res = await fetch(
            `https://api.themoviedb.org/3/person/${id}?api_key=${key}&language=es-ES`
        );
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/**
 * Consulta Wikipedia REST API (primero en español, luego en inglés como fallback).
 * Devuelve también el QID de Wikidata (wikibase_item) cuando está disponible.
 */
async function fetchWikiSummary(name: string): Promise<WikiSummary | null> {
    for (const lang of ['es', 'en']) {
        try {
            const res = await fetch(
                `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
                { headers: { 'Accept': 'application/json' } }
            );
            if (res.ok) {
                const data: WikiSummary = await res.json();
                if (data.extract || data.description) {
                    return data;
                }
            }
        } catch {
            // Intenta el siguiente idioma si falla la red
        }
    }
    return null;
}

/**
 * Consulta la Wikidata Entity API para obtener fechas de nacimiento/defunción
 * y lugar de nacimiento de una persona dado su QID (ej. "Q170587" para Hiroyuki Sanada).
 * No requiere clave de API.
 */
async function fetchWikidataPerson(qid: string): Promise<WikidataPersonData | null> {
    // Propiedades de Wikidata: P569=fecha nacimiento, P570=fecha muerte, P19=lugar nacimiento, P27=nacionalidad
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
    try {
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) return null;
        const data = await res.json();
        const entity = data.entities?.[qid];
        if (!entity) return null;

        const claims = entity.claims ?? {};

        // Fecha de nacimiento (P569)
        const birthSnaks = claims['P569']?.[0]?.mainsnak?.datavalue?.value;
        const birthDate: string | null = birthSnaks?.time ?
            birthSnaks.time.replace(/^\+/, '').substring(0, 10) :
            null;

        // Fecha de defunción (P570)
        const deathSnaks = claims['P570']?.[0]?.mainsnak?.datavalue?.value;
        const deathDate: string | null = deathSnaks?.time ?
            deathSnaks.time.replace(/^\+/, '').substring(0, 10) :
            null;

        // Lugar de nacimiento (P19): obtenemos el QID del lugar y buscamos su etiqueta
        const birthPlaceQid = claims['P19']?.[0]?.mainsnak?.datavalue?.value?.id;
        let placeOfBirth: string | null = null;
        if (birthPlaceQid) {
            try {
                const placeRes = await fetch(
                    `https://www.wikidata.org/wiki/Special:EntityData/${birthPlaceQid}.json`,
                    { headers: { 'Accept': 'application/json' } }
                );
                if (placeRes.ok) {
                    const placeData = await placeRes.json();
                    const placeEntity = placeData.entities?.[birthPlaceQid];
                    placeOfBirth = placeEntity?.labels?.es?.value
                        || placeEntity?.labels?.en?.value
                        || null;
                }
            } catch {
                // Si falla la resolución del lugar, seguimos sin él
            }
        }

        // Nacionalidad / país de ciudadanía (P27)
        const nationalityQid = claims['P27']?.[0]?.mainsnak?.datavalue?.value?.id;
        let countryCode: string | null = null;
        if (nationalityQid) {
            try {
                const natRes = await fetch(
                    `https://www.wikidata.org/wiki/Special:EntityData/${nationalityQid}.json`,
                    { headers: { 'Accept': 'application/json' } }
                );
                if (natRes.ok) {
                    const natData = await natRes.json();
                    const natEntity = natData.entities?.[nationalityQid];
                    // P297 = código ISO 3166-1 alpha-2 del país
                    const isoCode = natEntity?.claims?.['P297']?.[0]?.mainsnak?.datavalue?.value;
                    if (isoCode) countryCode = isoCode.toLowerCase();
                }
            } catch {
                // Si falla la resolución de la nacionalidad, seguimos sin ella
            }
        }

        // Género / Sexo (P21)
        const genderQid = claims['P21']?.[0]?.mainsnak?.datavalue?.value?.id;
        let gender: string | null = null;
        if (genderQid === 'Q6581097') {
            gender = 'Hombre';
        } else if (genderQid === 'Q6581072') {
            gender = 'Mujer';
        } else if (genderQid) {
            gender = 'No binario';
        }

        return { birthDate, deathDate, placeOfBirth, countryCode, gender };
    } catch {
        return null;
    }
}

/**
 * Consulta y consolida todos los metadatos de una persona en paralelo.
 */
export async function getPersonMetadata(name: string): Promise<PersonMetadata> {
    // 1. Lanzamos las consultas en paralelo
    const jfPromise = fetchJellyfinPerson(name);
    const wikiPromise = fetchWikiSummary(name);

    const jfData = await jfPromise;
    const tmdbPromise = fetchTmdbPerson(name, jfData?.ProviderIds?.Tmdb);

    const [wikiData, tmdbData] = await Promise.all([wikiPromise, tmdbPromise]);

    // 2. Si Wikipedia devuelve un QID de Wikidata y aún faltan datos esenciales,
    //    consultamos Wikidata como tercer fallback (sin clave de API)
    const needsWikidata = Boolean(
        wikiData?.wikibase_item
        && (
            (!jfData?.PremiereDate && !tmdbData?.birthday)
            || (!tmdbData?.place_of_birth && !jfData?.ProductionLocations?.length)
            || !tmdbData?.gender
        )
    );
    const wikidataData: WikidataPersonData | null = (needsWikidata && wikiData?.wikibase_item) ?
        await fetchWikidataPerson(wikiData.wikibase_item) :
        null;

    // 3. Extraer fechas de nacimiento y defunción (cascada: JF → TMDB → Wikidata)
    const birthDate = jfData?.PremiereDate?.split('T')[0]
        || tmdbData?.birthday
        || wikidataData?.birthDate
        || null;

    const deathDate = jfData?.EndDate?.split('T')[0]
        || tmdbData?.deathday
        || wikidataData?.deathDate
        || null;

    const isDeceased = !!deathDate;
    const age = calculateAge(birthDate, deathDate);

    // 4. Lugar de nacimiento y país (cascada: TMDB → JF → Wikidata)
    const placeOfBirth = tmdbData?.place_of_birth
        || jfData?.ProductionLocations?.[0]
        || wikidataData?.placeOfBirth
        || null;

    // El código de país de Wikidata (P27 ciudadanía + P297 ISO) es más fiable
    // que inferirlo del lugar de nacimiento; se usa como prioridad si está disponible
    const wikidataCountryCode = wikidataData?.countryCode || null;
    const countryRes = resolveCountry(placeOfBirth || jfData?.ProductionLocations?.[0]);
    const finalCountryCode = wikidataCountryCode || (countryRes?.code ? countryRes.code : null);
    const finalCountryName = finalCountryCode ?
        (Object.values(COUNTRY_MAP).find((c) => c.code === finalCountryCode)?.name || countryRes?.name || null) :
        (countryRes?.name || null);

    // 5. Biografía y descripción
    const bio = wikiData?.extract
        || jfData?.Overview
        || tmdbData?.biography
        || null;

    const description = wikiData?.description
        || (tmdbData?.known_for_department ? `Conocido por: ${tmdbData.known_for_department}` : null);

    // 6. Enlaces externos e IDs
    const imdbId = jfData?.ProviderIds?.Imdb || tmdbData?.imdb_id || null;
    const tmdbId = jfData?.ProviderIds?.Tmdb || (tmdbData?.id ? String(tmdbData.id) : null);
    const wikiUrl = wikiData?.content_urls?.desktop?.page || null;

    // Foto del artista en máxima resolución posible (TMDB original sin reescalar -> Wikipedia original -> Jellyfin nativo)
    const tmdbOriginalPhoto = tmdbData?.profile_path ?
        `https://image.tmdb.org/t/p/original${tmdbData.profile_path}` :
        null;

    let wikiPhoto = wikiData?.originalimage?.source || null;
    if (!wikiPhoto && wikiData?.thumbnail?.source) {
        const thumb = wikiData.thumbnail.source;
        if (thumb.includes('/thumb/')) {
            const noThumb = thumb.replace('/thumb/', '/');
            const lastIdx = noThumb.lastIndexOf('/');
            wikiPhoto = lastIdx > 0 ? noThumb.slice(0, lastIdx) : noThumb;
        } else {
            wikiPhoto = thumb;
        }
    }

    const session = loadSession();
    const jfPhoto = (session?.serverUrl && jfData?.Id && jfData?.PrimaryImageTag) ?
        `${trimSlash(session.serverUrl)}/Items/${jfData.Id}/Images/Primary?tag=${jfData.PrimaryImageTag}&quality=95&format=webp` :
        null;

    const photo = tmdbOriginalPhoto || wikiPhoto || jfPhoto;

    // 7. Género (TMDB o Wikidata)
    const tmdbGender = tmdbData?.gender === 1 ? 'Mujer' :
        tmdbData?.gender === 2 ? 'Hombre' :
            tmdbData?.gender === 3 ? 'No binario' :
                null;
    const finalGender = tmdbGender || wikidataData?.gender || null;

    return {
        name,
        birthDate,
        deathDate,
        age,
        isDeceased,
        gender: finalGender,
        placeOfBirth,
        country: finalCountryName,
        countryCode: finalCountryCode,
        bio,
        description,
        photo,
        imdbId,
        tmdbId,
        wikiUrl
    };
}
