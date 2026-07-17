import React from 'react';
import { T } from '../../theme/tokens';
import { useWatchedVersion } from '../../../domain/hooks/useWatched';
import { MovieWatchedButton } from '../controls/MovieWatchedButton';
import { FavButton } from '../controls/FavButton';
import { Progress } from '../controls/Progress';
import type { Movie } from '../../../data/models';
import type { Navigate } from '../../../app/router';

type Props = { movie: Movie; navigate: Navigate };

// Tarjeta de película en formato póster para el grid de la librería
// (ancho flexible en vez de fila con ancho fijo).
export const LibraryMovieCard = React.memo(function LibraryMovieCard({ movie, navigate }: Props) {
  useWatchedVersion();
  const watched = movie.watched ?? 0;
  const progress = watched > 0 && watched < 1 ? watched : 0;
  const poster = movie.poster || movie.backdrop;
  return (
    <div
      onClick={() => navigate({ page: 'movie', movieId: movie.id })}
      style={{ cursor: 'pointer' }}
      className="jfp-hoverlift"
    >
      <div style={{
        aspectRatio: '2/3', borderRadius: 4, overflow: 'hidden', position: 'relative',
        backgroundImage: `url(${poster})`, backgroundSize: 'cover', backgroundPosition: 'center',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.9))' }} />
        <div style={{ position: 'absolute', top: 10, left: 12 }}>
          <MovieWatchedButton movie={movie} size={16} badge />
        </div>
        <div style={{ position: 'absolute', top: 10, right: 12 }}>
          <FavButton id={`movie-${movie.id}`} size={16} />
        </div>
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
          {movie.logo ? (
            <img
              src={movie.logo}
              alt={movie.title}
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
              {movie.title}
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
        {movie.year} · Película
      </div>
    </div>
  );
});
