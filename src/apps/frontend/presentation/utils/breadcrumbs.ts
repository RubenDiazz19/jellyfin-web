import globalize from 'lib/globalize';
import type { Route } from '../../app/router';
import type { Episode, Season, Show } from '../../domain/models';
import { getItemGenres } from '../../domain/genres';

export type Crumb = { label: string; to?: Route };

/**
 * Genera la jerarquía estándar de migas de pan para fichas de series, temporadas y episodios.
 */
export function buildShowBreadcrumbs(
    show: Show,
    season?: Season,
    episode?: Episode
): Crumb[] {
    const root: Crumb = { label: globalize.translate('Shows'), to: { page: 'home' } };

    if (!season) {
        // En la ficha de la serie: [Series] > [Género] > [Título serie]
        const genre = getItemGenres(show)[0] ?? 'General';
        return [
            root,
            { label: genre },
            { label: show.title }
        ];
    }

    const showCrumb: Crumb = { label: show.title, to: { page: 'show', showId: show.id } };

    if (!episode) {
        // En la ficha de la temporada: [Series] > [Título serie] > [Temporada N]
        return [
            root,
            showCrumb,
            { label: `Temporada ${season.n}` }
        ];
    }

    // En la ficha del episodio: [Series] > [Título serie] > [Temporada N] > [Episodio M]
    return [
        root,
        showCrumb,
        {
            label: `Temporada ${season.n}`,
            to: { page: 'season', showId: show.id, seasonN: season.n }
        },
        { label: `Episodio ${episode.n}` }
    ];
}
