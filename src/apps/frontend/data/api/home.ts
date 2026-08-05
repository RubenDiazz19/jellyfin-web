// Home hero slides: half-watched items (/Items/Resume — episodes and movies)
// first, then latest added series and movies. Falls back to library series if
// everything is empty so the hero always has something to show.

import type { CarouselSlide, Show } from '../models';
import { loadSession } from '../session/session';
import { apiFetch, noSessionError } from './http';
import { imageUrl } from './images';
import { backdropUrls, logoUrl, posterUrl } from './itemMapping';
import { cachedList } from './listCache';
import { emitListsRefreshed } from './mutations';
import { settlePlaybackReports } from './playback';
import { getShows } from './shows';
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

/** Los slides del hero. Cacheada igual que los listados; ver `listCache`. */
export function getHomeCarousel(): Promise<CarouselSlide[]> {
    return cachedList('home-carousel', fetchHomeCarousel, emitListsRefreshed);
}

async function fetchHomeCarousel(): Promise<CarouselSlide[]> {
    // El stop del reproductor puede seguir en vuelo al aterrizar aquí; sin
    // esperar, /Items/Resume devuelve la posición vieja.
    await settlePlaybackReports();
    const session = loadSession();
    if (!session?.userId) throw noSessionError();
    const uid = session.userId;
    const [resume, latestSeries, latestMovies] = await Promise.all([
        apiFetch<{ Items: JFItem[] }>(
            // ImageTags/BackdropImageTags explícitos: sin ellos no podemos
            // construir URLs con tag y el hero se queda con imágenes cacheadas.
            `/Users/${uid}/Items/Resume?Limit=4&MediaTypes=Video&Fields=ProductionYear,RunTimeTicks,ParentId,ImageTags,BackdropImageTags,ParentBackdropImageTags`
        ).catch(() => ({ Items: [] as JFItem[] })),
        // /Items/Latest returns a bare array, not { Items }.
        apiFetch<JFItem[]>(
            `/Users/${uid}/Items/Latest?IncludeItemTypes=Series&Limit=5&Fields=${FIELDS_LIST}`
        ).catch(() => [] as JFItem[]),
        apiFetch<JFItem[]>(
            `/Users/${uid}/Items/Latest?IncludeItemTypes=Movie&Limit=5&Fields=${FIELDS_LIST}`
        ).catch(() => [] as JFItem[])
    ]);

    const slides: CarouselSlide[] = [];

    for (const it of resume.Items ?? []) {
        const pct = (it.UserData?.PlayedPercentage ?? 0) / 100;
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
                logo: logoUrl(it.ParentLogoItemId, it.ParentLogoImageTag),
                jfEpisodeId: it.Id,
                positionTicks: it.UserData?.PlaybackPositionTicks
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
                positionTicks: it.UserData?.PlaybackPositionTicks
            });
        }
    }

    const seen = new Set(slides.map((s) => s.id));
    // Intercala series y películas recientes para que el hero no sea
    // monotemático cuando hay de ambas.
    const latest: { it: JFItem; kind: 'show' | 'movie' }[] = [];
    const maxLen = Math.max(latestSeries.length, latestMovies.length);
    for (let i = 0; i < maxLen; i++) {
        if (latestSeries[i]) latest.push({ it: latestSeries[i], kind: 'show' });
        if (latestMovies[i]) latest.push({ it: latestMovies[i], kind: 'movie' });
    }
    for (const { it, kind } of latest) {
        if (seen.has(it.Id)) continue;
        seen.add(it.Id);
        const backdrops = backdropsOf(it.Id, it.BackdropImageTags, it.ImageTags?.Primary);
        slides.push({
            type: 'new',
            id: it.Id,
            kind,
            title: it.Name,
            season: null,
            episode: null,
            episodeTitle: '',
            year: it.ProductionYear ?? 0,
            progress: null,
            remaining: '',
            backdrop: backdrops[0] ?? '',
            backdrops,
            poster: posterUrl(it.Id, it.ImageTags?.Primary),
            logo: logoUrl(it.Id, it.ImageTags?.Logo)
        });
    }

    if (slides.length === 0) {
        const shows = await getShows().catch(() => [] as Show[]);
        for (const s of shows.slice(0, 6)) {
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
                logo: s.logo ?? null
            });
        }
    }

    return slides.slice(0, 6);
}
