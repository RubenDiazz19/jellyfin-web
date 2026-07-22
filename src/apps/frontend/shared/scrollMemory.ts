// Memoria de posición de scroll por tab (solo mobile/tablet). Al volver a
// un destino de la navegación inferior/rail se restaura donde estaba; las
// páginas de detalle siempre entran arriba. Vive en memoria: navegar es
// dentro de la misma sesión SPA.

const TAB_PATHS = new Set([
    '/', '/series', '/movies', '/favorites', '/search', '/settings', '/profile'
]);

const positions = new Map<string, number>();

export const SCROLL_MEMORY = {
    /** Guarda la posición si el path es un destino de tab. */
    save(path: string, y: number): void {
        if (TAB_PATHS.has(path)) positions.set(path, Math.max(0, y));
    },
    /** Posición recordada (0 si no hay nada guardado o no es un tab). */
    get(path: string): number {
        return positions.get(path) ?? 0;
    },
    clear(): void {
        positions.clear();
    }
};
