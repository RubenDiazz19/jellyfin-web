import React from 'react';
import { T } from '../../theme/tokens';
import { WATCHED } from '../../stores/watchedStore';
import { useWatchedVersion } from '../../hooks/useWatched';
import { ShowNavWatchedButton } from '../controls/ShowNavWatchedButton';
import { FavButton } from '../controls/FavButton';
import { Progress } from '../controls/Progress';
import { PROTO_DATA } from '../../data';
import type { Navigate } from '../../router';

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

type Props = { slide: Slide; navigate: Navigate };

// Póster vertical de serie (fila de home y librería).
export const PosterCard = React.memo(function PosterCard({ slide, navigate }: Props) {
  useWatchedVersion();
  const show = PROTO_DATA.shows[slide.id];
  const seasons = show?.seasons || [];
  const totalEps = seasons.reduce((a, s) => a + (s.total || 0), 0);
  const watchedEps = seasons.reduce((a, s) => {
    const ids = (s.episodes || []).map((ep) => `${slide.id}-s${s.n}-e${ep.n}`);
    const live = ids.filter((id) => WATCHED.has(id)).length;
    return a + Math.max(live, s.watched || 0);
  }, 0);
  const progress = totalEps ? Math.min(watchedEps / totalEps, 1) : 0;
  const cover = slide.poster || slide.backdrop;
  return (
    <div
      onClick={() => navigate({ page: 'show', showId: slide.id })}
      style={{ width: 230, flex: '0 0 230px', cursor: 'pointer' }}
      className="jfp-hoverlift"
    >
      <div
        style={{
          aspectRatio: '2/3', borderRadius: 4, overflow: 'hidden', position: 'relative',
          backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 25%, rgba(0,0,0,0.92))' }} />
        <div style={{ position: 'absolute', top: 10, left: 12 }}>
          <ShowNavWatchedButton showId={slide.id} size={16} badge />
        </div>
        <div style={{ position: 'absolute', top: 10, right: 12 }}>
          <FavButton id={slide.id} size={16} />
        </div>
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
          {slide.logo ? (
            <img
              src={slide.logo}
              alt={slide.title}
              loading="lazy"
              decoding="async"
              style={{
                maxWidth: 140, maxHeight: 44, width: 'auto', height: 'auto',
                objectFit: 'contain', objectPosition: 'left center',
                filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.7))',
              }}
            />
          ) : (
            <div style={{
              fontFamily: T.display, fontSize: 20, lineHeight: 1.05,
              textShadow: '0 2px 20px rgba(0,0,0,0.5)',
            }}>
              {slide.title}
            </div>
          )}
        </div>
        {progress > 0 && progress < 1 && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 3 }}>
            <Progress value={progress} height={3} />
          </div>
        )}
      </div>
      <div style={{
        marginTop: 10, fontFamily: T.ui, fontSize: 11, color: T.dim,
        letterSpacing: 1, textTransform: 'uppercase',
      }}>
        {slide.year} · Serie
      </div>
    </div>
  );
});
