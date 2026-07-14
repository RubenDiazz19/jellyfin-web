import React from 'react';
import { T } from '../../theme/tokens';
import { SeasonWatchedButton } from '../controls/SeasonWatchedButton';
import { FavButton } from '../controls/FavButton';
import { Progress } from '../controls/Progress';
import type { Show, Season } from '../../data';
import type { Navigate } from '../../router';

type Props = { show: Show; season: Season; navigate: Navigate };

export const SeasonCard = React.memo(function SeasonCard({ show, season, navigate }: Props) {
  const pct = season.total ? season.watched / season.total : 0;
  return (
    <div
      onClick={() => navigate({ page: 'season', showId: show.id, seasonN: season.n })}
      style={{ cursor: 'pointer', width: 230, flex: '0 0 230px' }}
      className="jfp-hoverlift"
    >
      <div style={{
        aspectRatio: '2/3', borderRadius: 4, overflow: 'hidden', position: 'relative',
        backgroundImage: `url(${season.backdrop})`, backgroundSize: 'cover', backgroundPosition: 'center',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 30%, transparent 55%, rgba(0,0,0,0.94) 100%)',
        }} />

        <div style={{
          position: 'absolute', top: 14, left: 14, right: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div style={{
            fontFamily: T.ui, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.78)', fontWeight: 500,
          }}>
            Temporada
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SeasonWatchedButton show={show} season={season} size={15} />
            <FavButton id={`${show.id}-s${season.n}`} size={15} />
          </div>
        </div>

        <div style={{
          position: 'absolute', left: 14, right: 14, bottom: 0, padding: '0 0 18px 0',
        }}>
          <div style={{
            fontFamily: T.display, fontStyle: 'italic', fontSize: 40, lineHeight: 0.9,
            margin: 0, fontWeight: 300, letterSpacing: -0.5,
            textShadow: '0 2px 16px rgba(0,0,0,0.5)',
            color: 'rgba(255,255,255,0.92)',
          }}>
            {String(season.n).padStart(2, '0')}
          </div>
          <div style={{
            marginTop: 6,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontFamily: T.ui, fontSize: 10, color: 'rgba(255,255,255,0.78)',
            letterSpacing: 1, textTransform: 'uppercase', fontWeight: 500,
          }}>
            <span>{season.total} episodios</span>
            <span>{season.year}</span>
          </div>

          {pct > 0 && (
            <div style={{ marginTop: 10 }}>
              <Progress value={pct} height={2} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
