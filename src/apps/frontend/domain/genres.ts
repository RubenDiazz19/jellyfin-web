// Traducción de géneros TMDB / TVDB / IMDb al castellano.
//
// Este módulo gestiona ÚNICAMENTE los géneros del servidor (item.genres).
// Los tags (vocabulario cerrado) viven en domain/tags.ts.

export const GENRE_TRANSLATIONS = new Map<string, string>([
    // Géneros principales TMDB / TVDB / IMDb
    ['action', 'Acción'],
    ['adventure', 'Aventura'],
    ['animation', 'Animación'],
    ['anime', 'Anime'],
    ['comedy', 'Comedia'],
    ['crime', 'Crimen'],
    ['documentary', 'Documental'],
    ['drama', 'Drama'],
    ['family', 'Familiar'],
    ['fantasy', 'Fantasía'],
    ['history', 'Historia'],
    ['horror', 'Terror'],
    ['kids', 'Infantil'],
    ['music', 'Música'],
    ['musical', 'Musical'],
    ['mystery', 'Misterio'],
    ['news', 'Noticias'],
    ['reality', 'Telerrealidad'],
    ['romance', 'Romance'],
    ['sci-fi', 'Ciencia ficción'],
    ['sci fi', 'Ciencia ficción'],
    ['scifi', 'Ciencia ficción'],
    ['science fiction', 'Ciencia ficción'],
    ['soap', 'Telenovela'],
    ['talk', 'Entrevistas'],
    ['thriller', 'Suspense'],
    ['tv movie', 'Película de TV'],
    ['war', 'Bélico'],
    ['western', 'Western'],

    // Temáticas, tropos y etiquetas frecuentes (AniList, TVDB, TMDB keywords)
    ['magic', 'Magia'],
    ['magical girls', 'Magical Girls'],
    ['mahou shoujo', 'Magical Girls'],
    ['slice of life', 'Recuentos de la vida'],
    ['school', 'Escolar'],
    ['high school', 'Escolar'],
    ['school life', 'Vida escolar'],
    ['university', 'Universidad'],
    ['college', 'Universidad'],
    ['coming of age', 'Mayoría de edad'],
    ['adolescence', 'Adolescencia'],
    ['psychological', 'Psicológico'],
    ['supernatural', 'Sobrenatural'],
    ['historical', 'Histórico'],
    ['sports', 'Deportes'],
    ['sport', 'Deportes'],
    ['mecha', 'Mecha'],
    ['military', 'Militar'],
    ['space', 'Espacio'],
    ['vampire', 'Vampiros'],
    ['vampires', 'Vampiros'],
    ['zombie', 'Zombis'],
    ['zombies', 'Zombis'],
    ['time travel', 'Viajes en el tiempo'],
    ['time loop', 'Bucle temporal'],
    ['post-apocalyptic', 'Postapocalíptico'],
    ['post apocalyptic', 'Postapocalíptico'],
    ['dystopia', 'Distopía'],
    ['dystopian', 'Distopía'],
    ['cyberpunk', 'Ciberpunk'],
    ['steampunk', 'Steampunk'],
    ['isekai', 'Isekai'],
    ['parody', 'Parodia'],
    ['super power', 'Superpoderes'],
    ['super powers', 'Superpoderes'],
    ['superpowers', 'Superpoderes'],
    ['superhero', 'Superhéroes'],
    ['superheroes', 'Superhéroes'],
    ['monster', 'Monstruos'],
    ['monsters', 'Monstruos'],
    ['demon', 'Demonios'],
    ['demons', 'Demonios'],
    ['martial arts', 'Artes marciales'],
    ['ecchi', 'Ecchi'],
    ['harem', 'Harén'],
    ['reverse harem', 'Harén inverso'],
    ['survival', 'Supervivencia'],
    ['revenge', 'Venganza'],
    ['police', 'Policial'],
    ['detective', 'Detectives'],
    ['investigation', 'Investigación'],
    ['mythology', 'Mitología'],
    ['alien', 'Extraterrestres'],
    ['aliens', 'Extraterrestres'],
    ['artificial intelligence', 'Inteligencia artificial'],
    ['ai', 'Inteligencia artificial'],
    ['friendship', 'Amistad'],
    ['tragedy', 'Tragedia'],
    ['dark fantasy', 'Fantasía oscura'],
    ['urban fantasy', 'Fantasía urbana'],
    ['based on manga', 'Basado en manga'],
    ['based on light novel', 'Basado en novela ligera'],
    ['based on visual novel', 'Basado en novela visual'],
    ['based on novel', 'Basado en novela'],
    ['based on video game', 'Basado en videojuego'],
    ['based on game', 'Basado en videojuego'],
    ['based on webcomic or webtoon', 'Basado en webcomic'],
    ['based on webcomic', 'Basado en webcomic'],
    ['based on webtoon', 'Basado en webcomic'],
    ['amnesia', 'Amnesia'],
    ['arranged marriage', 'Matrimonio concertado'],
    ['brother sister relationship', 'Relación de hermanos'],
    ['love triangle', 'Triángulo amoroso'],
    ['cohabitation', 'Convivencia'],
    ['reincarnation', 'Reencarnación'],
    ['body swap', 'Intercambio de cuerpos'],
    ['workplace', 'Laboral'],
    ['work', 'Laboral'],
    ['gourmet', 'Cocina'],
    ['food', 'Cocina'],
    ['cooking', 'Cocina'],
    ['shounen', 'Shounen'],
    ['shonen', 'Shounen'],
    ['shoujo', 'Shoujo'],
    ['shojo', 'Shoujo'],
    ['seinen', 'Seinen'],
    ['josei', 'Josei'],
    ['iyashikei', 'Iyashikei'],
    ['short episodes', 'Episodios cortos'],

    // Términos de tono y estilo provenientes del vocabulario de autotag
    ['real life', 'Hechos reales'],
    ['black humor', 'Humor negro'],
    ['surreal', 'Surrealista'],
    ['feel-good', 'Feelgood'],
    ['feelgood', 'Feelgood'],
    ['disturbing', 'Perturbadora'],
    ['violent', 'Violenta'],
    ['melancholy', 'Melancólica'],
    ['thrilling', 'Trepidante']
]);

/**
 * Traduce un género al castellano si existe equivalencia.
 * Si ya está en español o no tiene traducción, devuelve el texto con mayúscula inicial.
 */
export function translateGenre(genre: string | undefined | null): string {
    if (!genre) return '';
    const trimmed = genre.trim();
    const lower = trimmed.toLowerCase();

    // Normalización de géneros compuestos si se pasan como término único
    if (
        lower === 'sci-fi & fantasy'
        || lower === 'sci fi & fantasy'
        || lower === 'scifi & fantasy'
        || lower === 'sci-fi/fantasy'
        || lower === 'science fiction & fantasy'
        || lower === 'ciencia ficción y fantasía'
        || lower === 'ciencia ficcion y fantasia'
    ) {
        return 'Ciencia ficción';
    }
    if (
        lower === 'action & adventure'
        || lower === 'action and adventure'
        || lower === 'action/adventure'
        || lower === 'acción y aventura'
        || lower === 'accion y aventura'
    ) {
        return 'Acción';
    }
    if (
        lower === 'war & politics'
        || lower === 'war and politics'
        || lower === 'war/politics'
        || lower === 'bélico y política'
        || lower === 'belico y politica'
    ) {
        return 'Bélico';
    }

    const translation = GENRE_TRANSLATIONS.get(lower);
    if (translation) return translation;
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

// Mapa inverso (español -> inglés) para búsquedas en el servidor.
const REVERSE_TRANSLATIONS = new Map<string, string>();
for (const [en, es] of GENRE_TRANSLATIONS.entries()) {
    REVERSE_TRANSLATIONS.set(es.toLowerCase(), en);
}

/** Devuelve variantes (español + inglés) de un término para búsquedas en el servidor. */
export function getGenreVariants(subject: string | undefined | null): string[] {
    if (!subject) return [];
    const trimmed = subject.trim();
    const lower = trimmed.toLowerCase();
    const variants = new Set<string>([trimmed]);

    const direct = GENRE_TRANSLATIONS.get(lower);
    if (direct) {
        variants.add(direct);
        variants.add(direct.toLowerCase());
    }

    const reverse = REVERSE_TRANSLATIONS.get(lower);
    if (reverse) {
        variants.add(reverse);
        const capitalized = reverse.replace(/\b\w/g, (c) => c.toUpperCase());
        variants.add(capitalized);
    }

    // Variantes cruzadas para que buscar por un género individual encuentre
    // también los items etiquetados con géneros conjuntos del servidor (TMDB/TVDB).
    if (
        lower === 'acción'
        || lower === 'action'
        || lower === 'aventura'
        || lower === 'adventure'
    ) {
        variants.add('Action & Adventure');
        variants.add('Action and Adventure');
        variants.add('Acción y Aventura');
    } else if (
        lower === 'ciencia ficción'
        || lower === 'ciencia ficcion'
        || lower === 'science fiction'
        || lower === 'sci-fi'
        || lower === 'scifi'
    ) {
        variants.add('Sci-Fi & Fantasy');
        variants.add('Science Fiction');
        variants.add('Sci-Fi');
        variants.add('Ciencia ficción y Fantasía');
    } else if (lower === 'fantasía' || lower === 'fantasia' || lower === 'fantasy') {
        variants.add('Sci-Fi & Fantasy');
        variants.add('Fantasy');
        variants.add('Ciencia ficción y Fantasía');
    } else if (lower === 'bélico' || lower === 'belico' || lower === 'war') {
        variants.add('War & Politics');
        variants.add('War');
        variants.add('Bélico y Política');
    }

    return [...variants];
}

/** Item con campo de géneros. */
export type GenresItem = { genres?: string[] };

/**
 * Descompone géneros compuestos (de TMDB / TVDB como 'Action & Adventure' o
 * 'Sci-Fi & Fantasy') en sus opciones individuales en español.
 */
export function expandGenre(genre: string | undefined | null): string[] {
    if (!genre) return [];
    const trimmed = genre.trim();
    const lower = trimmed.toLowerCase();

    // Acción y Aventura -> Acción, Aventura
    if (
        lower === 'action & adventure'
        || lower === 'action and adventure'
        || lower === 'action/adventure'
        || lower === 'acción y aventura'
        || lower === 'accion y aventura'
    ) {
        return ['Acción', 'Aventura'];
    }

    // Ciencia ficción y Fantasía -> Ciencia ficción, Fantasía
    if (
        lower === 'sci-fi & fantasy'
        || lower === 'sci fi & fantasy'
        || lower === 'scifi & fantasy'
        || lower === 'sci-fi/fantasy'
        || lower === 'science fiction & fantasy'
        || lower === 'ciencia ficción y fantasía'
        || lower === 'ciencia ficcion y fantasia'
    ) {
        return ['Ciencia ficción', 'Fantasía'];
    }

    // Bélico y Política -> Bélico
    if (
        lower === 'war & politics'
        || lower === 'war and politics'
        || lower === 'war/politics'
        || lower === 'bélico y política'
        || lower === 'belico y politica'
    ) {
        return ['Bélico'];
    }

    const clean = translateGenre(trimmed);
    return clean ? [clean] : [];
}

/** Devuelve los géneros del item traducidos al español, deduplicados y ordenados. */
export function getItemGenres(item: GenresItem | null | undefined): string[] {
    if (!item) return [];
    const seen = new Map<string, string>();
    for (const g of item.genres ?? []) {
        for (const clean of expandGenre(g)) {
            if (clean) {
                const key = clean.toLowerCase();
                if (!seen.has(key)) seen.set(key, clean);
            }
        }
    }
    return [...seen.values()];
}

/**
 * Traduce, expande géneros compuestos y deduplica una lista de géneros al español.
 */
export function cleanGenres(genres: readonly string[] | null | undefined): string[] {
    if (!genres || genres.length === 0) return [];
    return getItemGenres({ genres: [...genres] });
}

/** Las primeras N genres (por defecto 3) para el hero de la ficha. */
export function getHeroGenres(item: GenresItem | null | undefined, limit = 3): string[] {
    return getItemGenres(item).slice(0, limit);
}

/**
 * Géneros principales y más frecuentes para sugerencias iniciales en la UI.
 * Ordenados según la relevancia típica de catálogo.
 */
export const PRIMARY_GENRES: readonly string[] = [
    'Acción',
    'Aventura',
    'Animación',
    'Anime',
    'Ciencia ficción',
    'Comedia',
    'Crimen',
    'Documental',
    'Drama',
    'Familiar',
    'Fantasía',
    'Historia',
    'Misterio',
    'Romance',
    'Suspense',
    'Terror',
    'Bélico',
    'Música',
    'Western',
    'Infantil'
];

const COMPOSITE_GENRES = new Set([
    'Acción y Aventura',
    'Ciencia ficción y Fantasía',
    'Bélico y Política'
]);

/**
 * Lista completa de todos los géneros y temáticas conocidos en español,
 * deduplicados y ordenados alfabéticamente para búsqueda en autocompletado.
 */
export const ALL_GENRES: readonly string[] = Array.from(
    new Set(GENRE_TRANSLATIONS.values())
)
    .filter((g) => !COMPOSITE_GENRES.has(g))
    .sort((a, b) => a.localeCompare(b, 'es'));

