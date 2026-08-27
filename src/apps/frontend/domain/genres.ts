// Mapeo y traducción de géneros oficiales de Jellyfin / TMDB al castellano.
//
// Los scrapers de metadatos de Jellyfin (TMDB, TVDB) a menudo guardan géneros
// en inglés como «Action & Adventure» o «Sci-Fi & Fantasy». Esta utilidad
// asegura que en la interfaz siempre se visualicen en español consistente.

const GENRE_TRANSLATIONS = new Map<string, string>([
    ['action & adventure', 'Acción y Aventura'],
    ['action', 'Acción'],
    ['adventure', 'Aventura'],
    ['animation', 'Animación'],
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
    ['sci-fi & fantasy', 'Ciencia ficción y Fantasía'],
    ['science fiction', 'Ciencia ficción'],
    ['soap', 'Telenovela'],
    ['talk', 'Entrevistas'],
    ['thriller', 'Suspense'],
    ['tv movie', 'Película de TV'],
    ['war & politics', 'Bélico y Política'],
    ['war', 'Bélico'],
    ['western', 'Western']
]);

/**
 * Traduce un género de Jellyfin / TMDB al castellano si existe equivalencia.
 * Si ya está en español o no tiene traducción conocida, devuelve el texto original.
 */
export function translateGenre(genre: string | undefined | null): string {
    if (!genre) return '';
    const trimmed = genre.trim();
    return GENRE_TRANSLATIONS.get(trimmed.toLowerCase()) ?? trimmed;
}
