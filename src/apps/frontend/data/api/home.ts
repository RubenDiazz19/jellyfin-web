// Home hero slides: half-watched episodes (/Items/Resume) first, then latest
// added series. Falls back to library series if both endpoints are empty so
// the hero always has something to show.

import type { CarouselSlide, Show } from '../models';
import { loadSession } from '../session/session';
import { apiFetch } from './http';
import { imageUrl } from './images';
import { getShows } from './shows';
import { FIELDS_LIST, type JFItem, type JFResumeItem } from './types';

export async function getHomeCarousel(): Promise<CarouselSlide[]> {
    const session = loadSession();
    if (!session?.userId) throw new Error('Sin sesión');
    const uid = session.userId;
    const [resume, latest] = await Promise.all([
        apiFetch<{ Items: JFResumeItem[] }>(
            `/Users/${uid}/Items/Resume?Limit=4&MediaTypes=Video&Fields=ProductionYear,RunTimeTicks,ParentId`
        ).catch(() => ({ Items: [] as JFResumeItem[] })),
        // /Items/Latest returns a bare array, not { Items }.
        apiFetch<JFItem[]>(
            `/Users/${uid}/Items/Latest?IncludeItemTypes=Series&Limit=5&Fields=${FIELDS_LIST}`
        ).catch(() => [] as JFItem[])
    ]);

    const slides: CarouselSlide[] = [];

    for (const it of resume.Items ?? []) {
        // Only series episodes (the hero links to the series card).
        if (!it.SeriesId) continue;
        const pct = (it.UserData?.PlayedPercentage ?? 0) / 100;
        const runtimeMin = it.RunTimeTicks ? it.RunTimeTicks / 10_000_000 / 60 : 0;
        const backdrop =
            (it.ParentBackdropItemId && it.ParentBackdropImageTags?.[0]
                ? imageUrl(it.ParentBackdropItemId, 'Backdrop', {
                    tag: it.ParentBackdropImageTags[0],
                    maxWidth: 2560
                })
                : undefined)
            ?? imageUrl(it.SeriesId, 'Backdrop', { maxWidth: 2560 })
            ?? '';
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
            remaining: runtimeMin ? String(Math.max(1, Math.round((1 - pct) * runtimeMin))) : '',
            backdrop,
            poster: imageUrl(it.SeriesId, 'Primary', { maxHeight: 900 }) ?? '',
            logo: it.ParentLogoItemId
                ? imageUrl(it.ParentLogoItemId, 'Logo', {
                    tag: it.ParentLogoImageTag,
                    maxHeight: 400
                })
                : null,
            jfEpisodeId: it.Id,
            positionTicks: it.UserData?.PlaybackPositionTicks
        });
    }

    const seen = new Set(slides.map((s) => s.id));
    for (const it of latest ?? []) {
        if (seen.has(it.Id)) continue;
        seen.add(it.Id);
        const backdrop = it.BackdropImageTags?.[0]
            ? imageUrl(it.Id, 'Backdrop', { tag: it.BackdropImageTags[0], maxWidth: 2560 })
            : imageUrl(it.Id, 'Primary', { maxHeight: 1440 });
        slides.push({
            type: 'new',
            id: it.Id,
            kind: 'show',
            title: it.Name,
            season: null,
            episode: null,
            episodeTitle: '',
            year: it.ProductionYear ?? 0,
            progress: null,
            remaining: '',
            backdrop: backdrop ?? '',
            poster: imageUrl(it.Id, 'Primary', { maxHeight: 900 }) ?? '',
            logo: it.ImageTags?.Logo
                ? imageUrl(it.Id, 'Logo', { tag: it.ImageTags.Logo, maxHeight: 400 })
                : null
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
                poster: s.poster ?? '',
                logo: s.logo ?? null
            });
        }
    }

    return slides.slice(0, 6);
}
