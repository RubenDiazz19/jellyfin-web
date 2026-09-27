// Gradientes de las tarjetas centralizados. Hasta ahora cada componente
// declaraba el suyo con ligeras variaciones; tenerlos aquí evita divergencias
// y facilita ajustarlos desde un solo sitio.

/** Póster estándar vertical: transparente arriba, negro al pie. */
export const posterDefault = 'linear-gradient(180deg, transparent 25%, rgba(0,0,0,0.92))';

/** Póster en rejilla (MovieCard fluid): el texto empieza más abajo. */
export const gridPoster = 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.9))';

/** Tarjeta de temporada: oscuro arriba y abajo, transparente en medio. */
export const seasonCard = 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 30%, transparent 55%, rgba(0,0,0,0.94) 100%)';

/** Tarjeta apaisada (CwCard, EpCard): sombra desde abajo. */
export const landscapeDefault = 'linear-gradient(to top, rgba(0,0,0,0.85), transparent 55%)';

/** Variante de EpCard: sombra desde arriba para el overlay inferior. */
export const episodeCard = 'linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.9))';
