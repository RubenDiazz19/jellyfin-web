import React from 'react';
import { T } from '../../theme/tokens';
import { formatRuntime } from '../../theme/format';
import { MovieWatchedButton } from '../controls/MovieWatchedButton';
import { FavButton } from '../controls/FavButton';
import { Progress } from '../controls/Progress';
import { useResponsive } from '../../theme/responsive';
import type { Movie } from '../../../domain/models';
import type { Navigate } from '../../../app/router';

type Props = { movie: Movie; navigate: Navigate };

// Póster vertical de película para las filas de la home.
export const MovieCard = React.memo(function MovieCardBase({ movie, navigate }: Props) {
    const r = useResponsive();
    const w = r.touch ? r.cardW : 230;
    const inProgress = (movie.watched ?? 0) > 0 && (movie.watched ?? 0) < 1;
    const cover = movie.poster || movie.backdrop;
    return (
        <div
            onClick={() => navigate({ page: 'movie', movieId: movie.id })}
            style={{ width: w, flex: `0 0 ${w}px`, cursor: 'pointer' }}
            className='jfp-hoverlift'
        >
            <div className='jfp-card-m3' style={{
                aspectRatio: '2/3', borderRadius: 4, overflow: 'hidden', position: 'relative',
                backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center'
            }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 25%, rgba(0,0,0,0.92))' }} />
                <div style={{ position: 'absolute', top: 10, left: 12 }}>
                    <MovieWatchedButton movie={movie} size={16} badge />
                </div>
                <div style={{ position: 'absolute', top: 10, right: 12 }}>
                    <FavButton id={`movie-${movie.id}`} size={16} />
                </div>
                <div style={{
                    position: 'absolute', left: 16, right: 16, bottom: inProgress ? 22 : 16
                }}>
                    {movie.logo ? (
                        <img
                            src={movie.logo}
                            alt={movie.title}
                            loading='lazy'
                            decoding='async'
                            style={{
                                maxWidth: 140, maxHeight: 44, width: 'auto', height: 'auto',
                                objectFit: 'contain', objectPosition: 'left center',
                                filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.7))'
                            }}
                        />
                    ) : (
                        <div style={{
                            fontFamily: T.display, fontSize: 20, lineHeight: 1.05,
                            textShadow: '0 2px 20px rgba(0,0,0,0.5)'
                        }}>
                            {movie.title}
                        </div>
                    )}
                </div>
                {inProgress && (
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 3 }}>
                        <Progress value={movie.watched as number} height={3} />
                    </div>
                )}
            </div>
            <div style={{
                marginTop: 10, fontFamily: T.ui, fontSize: 11, color: T.dim,
                letterSpacing: 1, textTransform: 'uppercase'
            }}>
                {movie.year} · {formatRuntime(movie.runtime)}
            </div>
        </div>
    );
});
