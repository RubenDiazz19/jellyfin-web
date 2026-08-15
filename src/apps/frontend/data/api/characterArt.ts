// El DIBUJO del personaje, no la foto del intérprete. La biblioteca local trae
// a los actores de doblaje como reparto —su cara no sirve de avatar, ver
// anilist.ts— y Jellyfin no guarda arte de personajes: AniList es quien lo
// indexa. Aquí se busca la serie por su título, se bajan sus personajes y se
// devuelve `rol → arte oficial` para que quien llame cruce con los `Role` de
// sus items.
//
// Un solo paso por serie y no uno por personaje a propósito: AniList es una
// API pública con rate-limit, y una serie de 50 personajes serían 50 peticiones
// sueltas frente a una `Media.search`. La caché y el pool de concurrencia
// hacen el resto: abrir el selector dos veces no vuelve a preguntar lo mismo.

const ENDPOINT = 'https://graphql.anilist.co';
/** Cuántas peticiones a AniList en paralelo como mucho. */
const MAX_IN_FLIGHT = 3;

const SERIES_QUERY = `
query ($search: String) {
    Media(search: $search, type: ANIME) {
        characters(perPage: 50, sort: [FAVOURITES_DESC]) {
            nodes {
                name { full }
                image { large }
            }
        }
    }
}`;

type AniListMediaResponse = {
    data?: {
        Media?: {
            characters?: {
                nodes?: {
                    name?: { full?: string };
                    image?: { large?: string };
                }[];
            };
        };
    };
    errors?: { message: string }[];
};

/** Caché por serie normalizada; el valor es el mapa rol → arte (quizá vacío). */
const cache = new Map<string, Map<string, string>>();
/** Series con una petición en vuelo: los llamantes concurrentes comparten la misma. */
const pending = new Map<string, Promise<Map<string, string>>>();

/**
 * Clave de comparación para nombres: sin mayúsculas ni acentos, porque la
 * metadata de Jellyfin y el índice de AniList rara vez coinciden al pie de la
 * letra («Naruto Uzumaki» ≈ «naruto uzumaki»).
 */
export function normalizeName(name: string): string {
    return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

let inFlight = 0;
const waiters: (() => void)[] = [];

/** La petición entra si hay hueco en el pool; si no, espera su turno. */
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (inFlight >= MAX_IN_FLIGHT) {
        await new Promise<void>((resolve) => { waiters.push(resolve); });
    }
    inFlight += 1;
    try {
        return await fn();
    } finally {
        inFlight -= 1;
        waiters.shift()?.();
    }
}

/**
 * Arte de los personajes de una serie, como `rol → imagen`. Devuelve siempre
 * un mapa (vacío si AniList no la conoce o falla): quien llama decide qué
 * hacer con los roles sin arte. En la caché, `undefined` significa «aún no se
 * ha intentado»; un mapa vacío sí se recuerda, para no repetir el intento.
 */
export function resolveSeriesArt(seriesName: string): Promise<Map<string, string>> {
    const trimmed = seriesName.trim();
    const key = normalizeName(trimmed);
    if (!key) return Promise.resolve(new Map());
    const cached = cache.get(key);
    if (cached !== undefined) return Promise.resolve(cached);
    const inFlightRequest = pending.get(key);
    if (inFlightRequest) return inFlightRequest;
    const task = withSlot(async () => {
        // Si entre que se encoló y cogió el hueco ya se pidió y terminó,
        // devolver eso en vez de repetir la petición.
        const done = cache.get(key);
        if (done !== undefined) return done;
        const art = await fetchSeriesArt(trimmed);
        cache.set(key, art);
        return art;
    }).finally(() => { pending.delete(key); });
    pending.set(key, task);
    return task;
}

async function fetchSeriesArt(seriesName: string): Promise<Map<string, string>> {
    try {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query: SERIES_QUERY, variables: { search: seriesName } })
        });
        const body: AniListMediaResponse = await res.json().catch(() => ({}));
        // 200 con `errors` o HTTP roto cuentan como «no hay arte»; el hueco se
        // nota menos que un error que corte el flujo del selector.
        if (!res.ok || body.errors?.length) return new Map();
        const out = new Map<string, string>();
        for (const node of body.data?.Media?.characters?.nodes ?? []) {
            if (!node.name?.full || !node.image?.large) continue;
            const name = normalizeName(node.name.full);
            // El primer personaje para un nombre se queda; el orden de AniList
            // (por favoritos) deja delante el más reconocible.
            if (!out.has(name)) out.set(name, node.image.large);
        }
        return out;
    } catch {
        return new Map();
    }
}
