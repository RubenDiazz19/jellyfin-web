import type { CastMember, Movie } from '../models';
import { loadSession } from '../session/session';
import { apiFetch } from './http';
import { imageUrl } from './images';
import { settlePlaybackReports } from './playback';
import { FIELDS_DETAIL, ticksToMinutes, type JFItem } from './types';

function mapCast(item: JFItem): CastMember[] {
    return (item.People ?? [])
        .filter((p) => p.Type === 'Actor')
        .slice(0, 14)
        .map((p) => ({
            name: p.Name,
            role: p.Role || '',
            photo: p.PrimaryImageTag && p.Id ?
                imageUrl(p.Id, 'Primary', { tag: p.PrimaryImageTag, maxHeight: 320 }) :
                null
        }));
}

function mapMovie(item: JFItem): Movie {
    const runtimeMin = ticksToMinutes(item.RunTimeTicks);
    const backdrops = (item.BackdropImageTags ?? [])
        .map((tag, i) => imageUrl(item.Id, 'Backdrop', { tag, maxWidth: 2560, index: i }) ?? '')
        .filter(Boolean);
    const played = item.UserData?.Played ?? false;
    const pct = item.UserData?.PlayedPercentage;
    return {
        id: item.Id,
        title: item.Name,
        year: item.ProductionYear ?? 0,
        runtime: runtimeMin ? `${runtimeMin} min` : '—',
        rating: {
            imdb: item.CommunityRating ?? 0,
            rt: 0,
            age: item.OfficialRating ?? 'N/A'
        },
        genres: item.Genres ?? [],
        director: (item.People ?? []).find((p) => p.Type === 'Director')?.Name ?? '',
        studio: item.Studios?.[0]?.Name ?? '',
        country: '',
        premiere: item.PremiereDate ?? '',
        cast: mapCast(item),
        synopsis: item.Overview ?? '',
        watched: played ? 1 : pct != null ? pct / 100 : 0,
        remaining: '',
        backdrop: backdrops[0] ?? '',
        poster: imageUrl(item.Id, 'Primary', { maxHeight: 900 }) ?? '',
        logo: item.ImageTags?.Logo ?
            imageUrl(item.Id, 'Logo', { tag: item.ImageTags.Logo, maxHeight: 400 }) ?? null :
            null
    };
}

export async function getMovie(id: string): Promise<Movie> {
    await settlePlaybackReports();
    const session = loadSession();
    if (!session?.userId) throw new Error('Sin sesión');
    const item = await apiFetch<JFItem>(
        `/Users/${session.userId}/Items/${id}?Fields=${FIELDS_DETAIL}`
    );
    return mapMovie(item);
}
