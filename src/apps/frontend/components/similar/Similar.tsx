import { T } from '../../theme/tokens';
import { PROTO_DATA } from '../../data';
import type { Show, Movie } from '../../data';
import { PosterCard } from '../cards/PosterCard';
import { MovieCard } from '../cards/MovieCard';
import type { Navigate } from '../../router';

type Props = {
  currentId: string;
  currentGenres: string[];
  kind: 'show' | 'movie';
  navigate: Navigate;
};

// "Más como esto": otros títulos de la misma biblioteca que comparten al
// menos un género con el actual. Se mezclan series y películas ordenadas
// por número de géneros coincidentes (mayor a menor).
export function Similar({ currentId, currentGenres, kind, navigate }: Props) {
  const genreSet = new Set(currentGenres.map((g) => g.toLowerCase()));

  const score = (genres: string[]) =>
    genres.reduce((n, g) => (genreSet.has(g.toLowerCase()) ? n + 1 : n), 0);

  const shows: (Show & { _score: number })[] = Object.values(PROTO_DATA.shows)
    .filter((s) => !(kind === 'show' && s.id === currentId))
    .map((s) => ({ ...s, _score: score(s.genres) }))
    .filter((s) => s._score > 0);

  const movies: (Movie & { _score: number })[] = Object.values(PROTO_DATA.movies)
    .filter((m) => !(kind === 'movie' && m.id === currentId))
    .map((m) => ({ ...m, _score: score(m.genres) }))
    .filter((m) => m._score > 0);

  const combined = [
    ...shows.map((s) => ({ item: s as Show, _score: s._score, kind: 'show' as const })),
    ...movies.map((m) => ({ item: m as Movie, _score: m._score, kind: 'movie' as const })),
  ]
    .sort((a, b) => b._score - a._score)
    .slice(0, 8);

  if (combined.length === 0) return null;

  return (
    <div style={{ marginTop: 88 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 24 }}>
        <h3 style={{
          fontFamily: T.display, fontStyle: 'italic', fontSize: 30, fontWeight: 300, margin: 0,
        }}>
          Más como esto
        </h3>
        <div style={{ fontFamily: T.ui, fontSize: 12, color: T.dim }}>
          Basado en los géneros del título
        </div>
      </div>
      <div style={{ display: 'flex', gap: 24, overflowX: 'auto' }}>
        {combined.map(({ item, kind: k }) =>
          k === 'show'
            ? <PosterCard key={`s-${item.id}`} slide={item as Show} navigate={navigate} />
            : <MovieCard  key={`m-${item.id}`} movie={item as Movie} navigate={navigate} />,
        )}
      </div>
    </div>
  );
}
