import React from 'react';
import { episodeKey, WATCHED } from '../../../domain/stores';
import { useWatchedVersion } from '../../../domain/bridge/useWatched';
import { ShowNavWatchedButton } from '../controls/ShowNavWatchedButton';
import { FavButton } from '../controls/FavButton';
import { PROTO_DATA } from '../../../domain/models';
import { useResponsive } from '../../theme/responsive';
import { PosterShell } from './PosterShell';
import { useCardInteractions } from './useCardInteractions';
import type { Navigate } from '../../../app/router';

// El "slide" mínimo que necesita esta card. Encaja tanto con un show
// (PROTO_DATA.shows[...]) como con una entrada de carousel.
type Slide = {
    id: string;
    title: string;
    year: number;
    logo?: string | null;
    poster?: string;
    backdrop?: string;
};

type Props = {
    slide: Slide;
    navigate: Navigate;
    /** En grids (librería touch) la card llena su columna en vez de fijar ancho. */
    fluid?: boolean;
};

// Póster vertical de serie (fila de home y librería).
export const PosterCard = React.memo(function PosterCardBase({ slide, navigate, fluid }: Props) {
    const r = useResponsive();
    // 130/160 en mobile/tablet (spec 4.1); desktop conserva 230.
    const w = r.touch ? r.cardW : 230;
    useWatchedVersion();
    const show = PROTO_DATA.shows[slide.id];
    const seasons = show?.seasons || [];
    const totalEps = seasons.reduce((a, s) => a + (s.total || 0), 0);
    const watchedEps = seasons.reduce((a, s) => {
        const ids = (s.episodes || []).map((ep) => episodeKey(slide.id, s.n, ep.n));
        const live = ids.filter((id) => WATCHED.has(id)).length;
        return a + Math.max(live, s.watched || 0);
    }, 0);
    const progress = totalEps ? Math.min(watchedEps / totalEps, 1) : 0;
    const card = useCardInteractions(
        { id: slide.id, title: slide.title, kind: 'show', poster: slide.poster, year: slide.year },
        navigate
    );
    return (
        <PosterShell
            {...card}
            cover={slide.poster || slide.backdrop}
            width={fluid ? null : w}
            watchedButton={<ShowNavWatchedButton showId={slide.id} size={16} badge />}
            favButton={<FavButton id={slide.id} size={16} />}
            logo={slide.logo}
            title={slide.title}
            progress={progress}
            caption={`${slide.year} · Serie`}
        />
    );
});
