// Home hero slides y filas curadas: half-watched items (/Items/Resume),
// últimos añadidos (/Items/Latest series y películas), y fallback al catálogo
// si todo está vacío para que la Home siempre tenga qué mostrar.

import type { CarouselSlide, CatalogItem, Show } from '../models';
import { loadSession } from '../session/session';
import { apiFetch, noSessionError } from './http';
import { imageUrl } from './images';
import { backdropUrls, logoUrl, mapCatalogItem, posterUrl } from './itemMapping';
import { cachedList } from './listCache';
import { emitListsRefreshed } from './mutations';
import { settlePlaybackReports } from './playback';
import { getShows } from './shows';
import { WATCHED } from '../stores/watchedStore';
import { FIELDS_LIST, ticksToExactMinutes, type JFItem } from './types';

/**
 * Los fondos del item y, si no tiene ninguno, el póster como sustituto: el
 * hero ocupa la pantalla entera y quedarse sin imagen se nota mucho más que
 * usar una con la proporción equivocada.
 */
function backdropsOf(
    itemId: string | undefined,
    backdropTags: string[] | undefined,
    primaryTag?: string
): string[] {
    if (!itemId) return [];
    const backdrops = backdropUrls(itemId, backdropTags);
    if (backdrops.length > 0) return backdrops;
    const primary = imageUrl(itemId, 'Primary', { maxHeight: 1440, tag: primaryTag });
    return primary ? [primary] : [];
}

/**
 * Títulos a medias del usuario (películas y episodios de series).
 * Alimenta la fila "Continuar viendo" de la Home y el carrusel del hero.
 */
export function getResume(limit = 12): Promise<CarouselSlide[]> {
    return cachedList(`home-resume-${limit}`, () => fetchResume(limit), emitListsRefreshed);
}

async function fetchResume(limit: number): Promise<CarouselSlide[]> {
    // El stop del reproductor puede seguir en vuelo al aterrizar aquí; sin
    // esperar, /Items/Resume devuelve la posición vieja.
    await settlePlaybackReports();
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const uid = session.userId;
    const resume = await apiFetch<{ Items: JFItem[] }>(
        // ImageTags/BackdropImageTags explícitos: sin ellos no podemos
        // construir URLs con tag y el hero se queda con imágenes cacheadas.
        `/Users/${uid}/Items/Resume?Limit=${limit * 2}&MediaTypes=Video&Fields=Genres,ProductionYear,RunTimeTicks,ParentId,ImageTags,BackdropImageTags,ParentBackdropImageTags,ParentLogoItemId,ParentLogoImageTag&EnableImageTypes=Primary,Backdrop,Logo`
    ).catch(() => ({ Items: [] as JFItem[] }));

    const slides: CarouselSlide[] = [];

    for (const it of resume.Items ?? []) {
        let pct = (it.UserData?.PlayedPercentage ?? 0) / 100;
        if (!pct && it.UserData?.PlaybackPositionTicks && it.RunTimeTicks) {
            pct = it.UserData.PlaybackPositionTicks / it.RunTimeTicks;
        }
        // Seguir viendo: limitado únicamente a contenido con progreso activo (entre 1% y 95%).
        if (pct < 0.01 || pct > 0.95 || it.UserData?.Played) {
            continue;
        }
        const runtimeMin = ticksToExactMinutes(it.RunTimeTicks);
        const remaining = runtimeMin ? String(Math.max(1, Math.round((1 - pct) * runtimeMin))) : '';
        if (it.SeriesId) {
            // Episodio a medias: el slide enlaza a la serie, así que las
            // imágenes son las de la serie padre.
            const backdrops = backdropsOf(
                it.ParentBackdropItemId ?? it.SeriesId,
                it.ParentBackdropImageTags,
                it.SeriesPrimaryImageTag
            );
            const backdrop = backdrops[0] ?? '';
            slides.push({
                type: 'continue',
                id: it.SeriesId,
                kind: 'show',
                title: it.SeriesName ?? it.Name,
                season: it.ParentIndexNumber ?? null,
                episode: it.IndexNumber ?? null,
                episodeTitle: it.Name,
                year: it.ProductionYear ?? 0,
                progress: pct,
                remaining,
                backdrop,
                backdrops,
                poster: posterUrl(it.SeriesId, it.SeriesPrimaryImageTag),
                logo: logoUrl(it.ParentLogoItemId ?? it.SeriesId, it.ParentLogoImageTag),
                jfEpisodeId: it.Id,
                positionTicks: it.UserData?.PlaybackPositionTicks,
                genres: it.Genres ?? []
            });
        } else {
            // Película a medias: se reanuda directamente en el reproductor.
            const backdrops = backdropsOf(it.Id, it.BackdropImageTags, it.ImageTags?.Primary);
            slides.push({
                type: 'continue',
                id: it.Id,
                kind: 'movie',
                title: it.Name,
                season: null,
                episode: null,
                episodeTitle: '',
                year: it.ProductionYear ?? 0,
                progress: pct,
                remaining,
                backdrop: backdrops[0] ?? '',
                backdrops,
                poster: posterUrl(it.Id, it.ImageTags?.Primary),
                logo: logoUrl(it.Id, it.ImageTags?.Logo),
                jfEpisodeId: it.Id,
                positionTicks: it.UserData?.PlaybackPositionTicks,
                genres: it.Genres ?? []
            });
        }
        if (slides.length >= limit) break;
    }

    return slides;
}

/**
 * Títulos añadidos recientemente a la biblioteca.
 * Si se omite kind, devuelve series y películas intercaladas para la fila "Añadidos recientemente".
 */
export function getLatest(kind?: 'show' | 'movie', limit = 12): Promise<CatalogItem[]> {
    return cachedList(`latest-${kind ?? 'all'}-${limit}`, () => fetchLatest(kind, limit), emitListsRefreshed);
}

async function fetchLatest(kind?: 'show' | 'movie', limit = 12): Promise<CatalogItem[]> {
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const uid = session.userId;

    if (kind === 'show') {
        const items = await apiFetch<JFItem[]>(
            `/Users/${uid}/Items/Latest?IncludeItemTypes=Series&Limit=${limit}&Fields=${FIELDS_LIST}`
        ).catch(() => [] as JFItem[]);
        return items.map((it) => mapCatalogItem(it, 'show'));
    }

    if (kind === 'movie') {
        const items = await apiFetch<JFItem[]>(
            `/Users/${uid}/Items/Latest?IncludeItemTypes=Movie&Limit=${limit}&Fields=${FIELDS_LIST}`
        ).catch(() => [] as JFItem[]);
        return items.map((it) => mapCatalogItem(it, 'movie'));
    }

    // Sin kind: intercala series y películas recientes
    const [latestSeries, latestMovies] = await Promise.all([
        getLatest('show', limit),
        getLatest('movie', limit)
    ]);
    const merged: CatalogItem[] = [];
    const maxLen = Math.max(latestSeries.length, latestMovies.length);
    for (let i = 0; i < maxLen; i++) {
        if (latestSeries[i]) merged.push(latestSeries[i]);
        if (latestMovies[i]) merged.push(latestMovies[i]);
    }
    return merged.slice(0, limit);
}

/** Los slides del hero. Cacheada igual que los listados; ver `listCache`. */
export function getHomeCarousel(): Promise<CarouselSlide[]> {
    return cachedList('home-carousel', fetchHomeCarousel, emitListsRefreshed);
}

async function fetchHomeCarousel(): Promise<CarouselSlide[]> {
    // El hero se dedica exclusivamente a títulos no empezados (0% de progreso).
    // Su función es invitar a empezar algo nuevo o destacar estrenos que aún no has tocado.
    const [latestSeries, latestMovies, resume] = await Promise.all([
        getLatest('show', 12).catch(() => [] as CatalogItem[]),
        getLatest('movie', 12).catch(() => [] as CatalogItem[]),
        getResume().catch(() => [] as CarouselSlide[])
    ]);

    const resumeIds = new Set(resume.map((s) => s.id));
    const isUnstarted = (it: CatalogItem) => {
        if (resumeIds.has(it.id)) return false;
        if (it.watched && it.watched > 0) return false;
        if (WATCHED.has(it.id)) return false;
        return true;
    };

    const unstartedSeries = latestSeries.filter(isUnstarted);
    const unstartedMovies = latestMovies.filter(isUnstarted);

    const slides: CarouselSlide[] = [];
    const seen = new Set<string>();

    // Intercala series y películas recientes para que el hero no sea
    // monotemático cuando hay de ambas.
    const latest: CatalogItem[] = [];
    const maxLen = Math.max(unstartedSeries.length, unstartedMovies.length);
    for (let i = 0; i < maxLen; i++) {
        if (unstartedSeries[i]) latest.push(unstartedSeries[i]);
        if (unstartedMovies[i]) latest.push(unstartedMovies[i]);
    }
    for (const it of latest) {
        if (seen.has(it.id)) continue;
        seen.add(it.id);
        slides.push({
            type: 'new',
            id: it.id,
            kind: it.kind,
            title: it.title,
            season: null,
            episode: null,
            episodeTitle: '',
            year: it.year,
            progress: null,
            remaining: '',
            backdrop: it.backdrop ?? '',
            backdrops: it.backdrops,
            poster: it.poster ?? '',
            logo: it.logo,
            jfEpisodeId: it.kind === 'movie' ? it.id : undefined,
            genres: it.genres
        });
        if (slides.length >= 6) break;
    }

    if (slides.length === 0) {
        const shows = await getShows().catch(() => [] as Show[]);
        for (const s of shows) {
            if (resumeIds.has(s.id) || (s.watched && s.watched > 0) || WATCHED.has(s.id)) continue;
            slides.push({
                type: 'new',
                id: s.id,
                kind: 'show',
                title: s.title,
                season: null,
                episode: null,
                episodeTitle: '',
                year: s.year ?? 0,
                progress: null,
                remaining: '',
                backdrop: s.backdrop || s.poster || '',
                // mapShow() ya construye los backdrops con tag.
                backdrops: s.backdrops?.length ? s.backdrops : undefined,
                poster: s.poster ?? '',
                logo: s.logo ?? null,
                genres: s.genres
            });
            if (slides.length >= 6) break;
        }
    }

    return slides;
}
