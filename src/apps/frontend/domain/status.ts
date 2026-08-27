// Mapeo y traducción de estados de emisión de series de Jellyfin / TMDB al castellano.
//
// Jellyfin expone el estado en inglés ('Continuing', 'Ended', 'Upcoming',
// 'Canceled'...). Esta utilidad asegura una representación natural y legible
// en español ('En emisión', 'Finalizada', 'Próximamente', 'Cancelada').

const STATUS_TRANSLATIONS = new Map<string, string>([
    ['continuing', 'En emisión'],
    ['ended', 'Finalizada'],
    ['upcoming', 'Próximamente'],
    ['unaired', 'Próximamente'],
    ['in production', 'En producción'],
    ['inproduction', 'En producción'],
    ['canceled', 'Cancelada'],
    ['cancelled', 'Cancelada'],
    ['pilot', 'Piloto']
]);

/**
 * Traduce el estado de emisión de una serie al castellano.
 * Si ya está en español o no tiene traducción conocida, devuelve el texto original.
 */
export function translateStatus(status: string | undefined | null): string {
    if (!status) return '';
    const trimmed = status.trim();
    return STATUS_TRANSLATIONS.get(trimmed.toLowerCase()) ?? trimmed;
}
