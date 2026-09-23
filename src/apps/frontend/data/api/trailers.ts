// Resolución y obtención de trailers locales para la capa de datos.
// Solo soporta trailers alojados en el servidor Jellyfin (DirectPlay / HLS).
// Si el item no tiene trailers locales, se devuelve null y el Hero se queda
// en su estado estático habitual.

import { apiFetch, noSessionError } from './http';
import { loadSession } from '../session/session';
import { getPlaybackDecision } from './playback';
import type { JFItem } from './types';
import { logger } from '../../shared/logger';

export type TrailerSource = { type: 'video'; url: string; isHls?: boolean };

export type TrailerTarget = {
    id: string;
    localTrailerCount?: number;
};

/** Caché en memoria para evitar renegociaciones redundantes al rotar slides en el hero. */
const trailerCache = new Map<string, TrailerSource | null>();

/** Limpia la caché de trailers (útil para pruebas y recarga de biblioteca). */
export function clearTrailerCache(): void {
    trailerCache.clear();
}

/** Consulta la lista de trailers locales asociados a un item en Jellyfin. */
export async function getLocalTrailers(itemId: string): Promise<JFItem[]> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    try {
        const res = await apiFetch<JFItem[]>(`/Items/${itemId}/LocalTrailers?userId=${session.userId}`);
        return Array.isArray(res) ? res : [];
    } catch {
        return [];
    }
}

/**
 * Resuelve de forma lazy la fuente reproducible de trailer para un item dado.
 * Solo busca trailers locales alojados en el servidor Jellyfin.
 * Si no hay ninguno, devuelve null y el Hero permanece estático.
 */
export async function resolveTrailerSource(target: TrailerTarget): Promise<TrailerSource | null> {
    if (!target.id) return null;
    if (trailerCache.has(target.id)) {
        return trailerCache.get(target.id) ?? null;
    }

    try {
        // Trailers locales en Jellyfin
        const mightHaveLocal = target.localTrailerCount === undefined || target.localTrailerCount > 0;
        if (mightHaveLocal) {
            const localTrailers = await getLocalTrailers(target.id);
            if (localTrailers.length > 0 && localTrailers[0]?.Id) {
                const trailerItem = localTrailers[0];
                const decision = await getPlaybackDecision(trailerItem.Id);
                const source: TrailerSource = {
                    type: 'video',
                    url: decision.url,
                    isHls: decision.kind === 'hls'
                };
                trailerCache.set(target.id, source);
                return source;
            }
        }

        trailerCache.set(target.id, null);
        return null;
    } catch (err) {
        logger.warn(`[trailers] Error resolviendo trailer para ${target.id}:`, err);
        trailerCache.set(target.id, null);
        return null;
    }
}
